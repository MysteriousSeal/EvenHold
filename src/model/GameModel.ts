// Model: owns game state and rules. No rendering, no input handling.
// World generation lives in worldgen/; this class holds the generated world
// and everyone in it, and runs each frame: the hero's movement and blows,
// the enemies (enemyDirector.ts), wildlife, the hero's focus and health.
// What blocks movement and sight is kept in obstacles.ts.

import {
  EDGE_MARGIN,
  HERO_SPEED,
  HERO_RADIUS,
  ATTACK_DURATION,
  ATTACK_KNOCKBACK,
  ATTACK_REACH,
  ATTACK_STRIKE,
  ENEMY_STATS,
  HERO_DAMAGE,
  FOCUS_RANGE,
  FOCUS_TURN_RANGE,
  TILE_HEIGHT,
  ROAD_SURFACE_HEIGHT,
} from './constants';
import { DEFAULT_MAP_SIZE, spawnOf, toCellX, toCellZ, type MapSize } from './grid';
import type { Building, Bush, Camp, Enemy, Field, GameEvent, Hero, Tree, House, Surface, Village } from './types';
import { bumpsEnemy, spawnEnemies } from './enemies/enemies';
import { EnemyDirector } from './enemies/enemyDirector';
import { FRESH_HERO_STATS, HERO_NAME, gainXp, hurt, maxHpAt, recover } from './hero/heroStats';
import { HERO_LOOK } from './human/humanoid';
import type { Obstacles } from './obstacles';
import { addCampObstacles, worldObstacles } from './blockers';
import { stepHop, type Hop } from './hero/hop';
import { PICKUP_RANGE, rollDrop, type GroundLoot } from './loot/loot';
import { addToBag, takeFromBag, type BagItem } from './hero/bag';
import { coinDrop, collectCoins, type GroundCoins } from './hero/money';
import { ITEMS, wear, type EquipSlot, type ItemId } from './human/equipment';
import { spawnWildlife, stepWildlife, type Wildlife } from './wildlife/wildlife';
import { generateWorld, solidCells } from './worldgen/world';
import { onPaving } from './roads';
import { ENTER_RANGE, entrancesOf, type Entrance } from './interiors/interiors';
import type { Seat } from './interiors/furniture';
import { layoutOf, seatInReach, sitDown, standUp, walkInside, type Inside } from './interiors/indoors';
import { bumpsNpc, spawnNpcs, type Npc } from './npcs/npcs';
import { stepNpcs } from './npcs/npcRoutine';
import type { Shop } from './npcs/tavernShop';
import { PROVISIONS, isProvision } from './loot/provisions';

const DROP_AHEAD = 0.45; // how far in front of the hero things dropped from the bag land
const TALK_RANGE = 2.2; // room tiles: across the bar from the barmaid
const DEATH_TOLL = 0.2; // of their coins, lost in a fall

export class GameModel {
  readonly seed: number;
  readonly size: MapSize;
  readonly heightMap: number[][];
  readonly lakeMap: boolean[][];
  readonly surfaceMap: Surface[][];
  readonly trails: Array<Array<[number, number]>>;
  readonly villages: Village[];
  readonly houses: House[];
  readonly buildings: Building[];
  readonly fields: Field[];
  readonly trees: Tree[];
  readonly bushes: Bush[];
  readonly hero: Hero;
  readonly enemies: Enemy[];
  readonly camps: Camp[];
  readonly loot: GroundLoot[] = []; // on the ground, until picked up
  readonly coins: GroundCoins[] = []; // dropped coins, picked up by walking near them
  readonly slain = new Set<number>(); // foes killed, by id (a saved world is made again without them)
  readonly shops = new Map<number, Shop>(); // each inn's, by its door's index (npcs/tavernShop.ts)
  lastInn: Entrance | null = null; // the last inn entered, where the hero wakes after a fall
  private nextLootId = 0;
  readonly entrances: Entrance[]; // every door that can be gone through
  readonly npcs: Npc[]; // the villagers, one to a house (npcs/)
  // Where the hero is while indoors (indoors.ts); null outdoors.
  inside: Inside | null = null;
  readonly wildlife: Wildlife[]; // peaceful animals: they never block and can't be hurt
  // The enemy the hero has focused (clicked, or the first to hit them since
  // focus last cleared), shown in the HUD; null when none.
  private focusedId: number | null = null;

  private readonly obstacles: Obstacles;
  private readonly director: EnemyDirector;
  private hop: Hop | null = null;
  // Time into the current attack, or null when not attacking; whether the
  // current blow has landed yet (each blow hits at most once).
  private attackElapsed: number | null = null;
  private attackLanded = false;

  // Dev cheats: movement speed factor (1 = normal); walking through
  // everything; god mode (enemies' blows don't hurt); enemies standing
  // still (enemiesFrozen, below).
  speedMultiplier = 1;
  noclip = false;
  godMode = false;

  // `size` defaults to the game's map; tests pass small worlds.
  constructor(seed: number, size: MapSize = DEFAULT_MAP_SIZE) {
    this.seed = seed;

    const world = generateWorld(seed, size);
    this.size = world.size;
    this.heightMap = world.heightMap;
    this.lakeMap = world.lakeMap;
    this.surfaceMap = world.surfaceMap;
    this.trails = world.trails;
    this.villages = world.villages;
    this.houses = world.houses;
    this.buildings = world.buildings;
    this.fields = world.fields;
    this.trees = world.trees;
    this.bushes = world.bushes;
    this.obstacles = worldObstacles(this, solidCells(this)); // what blocks the way (blockers.ts)

    const spawn = spawnOf(this.size);
    this.hero = { name: HERO_NAME, x: spawn.x, z: spawn.z, y: 0, facing: 0, look: { ...HERO_LOOK }, equipment: {}, bag: {}, bagOrder: [], money: 0, ...FRESH_HERO_STATS }; // starts naked
    this.hero.y = this.getGroundY(this.hero.x, this.hero.z);
    const { enemies, camps } = spawnEnemies(this);
    this.enemies = enemies;
    this.camps = camps;
    addCampObstacles(this.obstacles, camps);
    for (const enemy of this.enemies) enemy.y = this.getGroundY(enemy.x, enemy.z);
    this.director = new EnemyDirector(this.enemies, this.hero, this.obstacles, this.size, (x, z) => this.getGroundY(x, z), (e) => this.enemyStrikes(e));
    this.wildlife = spawnWildlife(this);
    this.entrances = entrancesOf(this.houses, this.buildings);
    this.npcs = spawnNpcs(this.seed, this.entrances, this.villages, this.fields);
  }

  // Height of whatever the hero would stand on at (x, z), in world units:
  // the tile's tier, plus the road/cobble paving where there is some.
  getGroundY(x: number, z: number): number {
    const tile = this.heightMap[toCellX(this.size, x)][toCellZ(this.size, z)] * TILE_HEIGHT;
    return onPaving(this.surfaceMap, x, z) ? tile + ROAD_SURFACE_HEIGHT : tile;
  }

  // Starts a blow unless one is already under way (returns whether it did),
  // turned to face the focused enemy if it's close by.
  startAttack(): boolean {
    if (this.attackElapsed !== null || this.inside?.seated) return false;
    this.attackElapsed = 0;
    this.attackLanded = false;
    const focus = this.focused;
    if (focus && focus.state !== 'dead' && Math.hypot(focus.x - this.hero.x, focus.z - this.hero.z) <= FOCUS_TURN_RANGE) {
      this.hero.facing = Math.atan2(focus.x - this.hero.x, focus.z - this.hero.z);
    }
    return true;
  }

  // How far through the current attack the hero is, 0..1, or null.
  get attackProgress(): number | null {
    return this.attackElapsed === null ? null : Math.min(1, this.attackElapsed / ATTACK_DURATION);
  }

  // Moves the hero straight to (x, z), standing on the ground there
  // (outdoors, leaving any room they were in).
  teleport(x: number, z: number): void {
    this.inside = null;
    this.hero.x = x;
    this.hero.z = z;
    this.hero.y = this.getGroundY(x, z);
    this.hop = null;
  }

  // Whether a walker of half-width r can't stand at (x, z) (wildlife walk by it).
  isBlocked(x: number, z: number, r: number): boolean {
    return this.obstacles.isBlocked(x, z, r);
  }

  // A tile the hero can stand in the middle of: on the map, dry, and free
  // of buildings, wells, trees, bushes and lamp posts.
  isOpenTile(x: number, z: number): boolean {
    return this.obstacles.isOpenTile(x, z);
  }

  get enemiesFrozen(): boolean {
    return this.director.frozen;
  }

  set enemiesFrozen(frozen: boolean) {
    this.director.frozen = frozen;
  }

  // Advances the hero one frame. dirX/dirZ: world-space input direction
  // (not necessarily normalized, zero when idle); dt: seconds.
  update(dirX: number, dirZ: number, dt: number): void {
    if (dt <= 0) return;
    if (this.inside) {
      // The world outside stands still while the hero's indoors.
      this.moveInside(dirX, dirZ, dt);
      this.advanceAttack(dt);
      stepNpcs(this.npcs, this, dt);
      recover(this.hero, dt, !!this.inside?.seated?.seat.lying); // asleep in a bed, the only rest that heals
      return;
    }
    this.moveHorizontally(dirX, dirZ, dt);
    this.advanceAttack(dt);
    this.director.update(dt);
    stepNpcs(this.npcs, this, dt);
    this.scoopCoins();
    recover(this.hero, dt);
    this.keepFocus();
    stepWildlife(this.wildlife, this, this.hero, dt);
    // Runs even with no input, so a hop started just before the player let
    // go still finishes instead of freezing mid-air.
    ({ hop: this.hop, y: this.hero.y } = stepHop(this.hop, this.hero.y, this.getGroundY(this.hero.x, this.hero.z), dt));
  }

  // Moves the current blow along; outdoors it lands partway through (there's
  // no one to hit indoors, so there the swing just plays out).
  private advanceAttack(dt: number): void {
    if (this.attackElapsed === null) return;
    this.attackElapsed += dt;
    if (!this.inside && !this.attackLanded && this.attackElapsed >= ATTACK_STRIKE * ATTACK_DURATION) {
      this.attackLanded = true;
      this.landBlow();
    }
    if (this.attackElapsed >= ATTACK_DURATION) this.attackElapsed = null;
  }

  private moveHorizontally(dirX: number, dirZ: number, dt: number): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return;

    const dist = HERO_SPEED * this.speedMultiplier * dt;
    const candidateX = Math.min(this.size.width - 1 - EDGE_MARGIN, Math.max(EDGE_MARGIN, this.hero.x + (dirX / len) * dist));
    const candidateZ = Math.min(this.size.depth - 1 - EDGE_MARGIN, Math.max(EDGE_MARGIN, this.hero.z + (dirZ / len) * dist));

    // Axis-separated so the hero slides along an obstacle's edge instead of
    // stopping dead the instant either component alone would move into it.
    const free = (x: number, z: number) =>
      this.noclip || (!this.obstacles.isBlocked(x, z, HERO_RADIUS) && !bumpsEnemy(this.enemies, this.hero, x, z, HERO_RADIUS) && !bumpsNpc(this.npcs, null, this.hero, x, z, HERO_RADIUS));
    if (free(candidateX, this.hero.z)) this.hero.x = candidateX;
    if (free(this.hero.x, candidateZ)) this.hero.z = candidateZ;
    this.hero.facing = Math.atan2(dirX, dirZ);
  }

  // The blow lands on the nearest living enemy within reach and roughly in
  // front of the hero (within 70 degrees of facing): one hit point off, a
  // shove away, and a brief flash. At zero it dies.
  private landBlow(): void {
    const fx = Math.sin(this.hero.facing);
    const fz = Math.cos(this.hero.facing);
    let target: Enemy | null = null;
    let best = Infinity;
    for (const enemy of this.enemies) {
      if (enemy.state === 'dead') continue;
      const dx = enemy.x - this.hero.x;
      const dz = enemy.z - this.hero.z;
      const d = Math.hypot(dx, dz);
      if (d > ATTACK_REACH + ENEMY_STATS[enemy.kind].radius || d >= best) continue;
      if (d > 1e-6 && (dx * fx + dz * fz) / d < Math.cos((70 * Math.PI) / 180)) continue;
      target = enemy;
      best = d;
    }
    // The focused enemy takes the blow whenever it's within reach.
    const focus = this.focused;
    if (focus && focus.state !== 'dead' && Math.hypot(focus.x - this.hero.x, focus.z - this.hero.z) <= ATTACK_REACH + ENEMY_STATS[focus.kind].radius) {
      target = focus;
      best = Math.hypot(focus.x - this.hero.x, focus.z - this.hero.z);
    }
    if (!target) return;
    target.hp -= HERO_DAMAGE;
    this.events.push({ kind: 'hit', on: target.kind, amount: HERO_DAMAGE, x: target.x, y: target.y, z: target.z });
    target.hurtFor = 0.25;
    target.swingFor = null; // a hit interrupts its own blow
    target.state = target.hp <= 0 ? 'dead' : 'chase';
    if (target.state === 'dead') {
      this.slain.add(target.id);
      gainXp(this.hero, target.xp);
      const item = rollDrop(ENEMY_STATS[target.kind].family, target.id);
      if (item) this.dropLoot(item, target.x, target.z);
      const amount = coinDrop(target);
      if (amount > 0) this.dropCoins(amount, target.x + 0.25, target.z + 0.15);
    }
    const d = Math.max(best, 1e-6);
    this.director.move(target, ((target.x - this.hero.x) / d) * ATTACK_KNOCKBACK, ((target.z - this.hero.z) / d) * ATTACK_KNOCKBACK);
  }

  // Puts an item on the ground at (x, z).
  dropLoot(item: BagItem, x: number, z: number): void {
    this.loot.push({ id: this.nextLootId++, item, x, z, y: this.getGroundY(x, z) });
  }

  // Puts `amount` copper in coins on the ground at (x, z).
  dropCoins(amount: number, x: number, z: number): void {
    this.coins.push({ id: this.nextLootId++, amount, x, z, y: this.getGroundY(x, z) });
  }

  // The loot nearest the hero within reach to pick up, or null.
  get lootInReach(): GroundLoot | null {
    if (this.inside) return null; // loot lies outdoors
    let best: GroundLoot | null = null;
    let bestDistance = PICKUP_RANGE;
    for (const loot of this.loot) {
      const d = Math.hypot(loot.x - this.hero.x, loot.z - this.hero.z);
      if (d <= bestDistance) {
        best = loot;
        bestDistance = d;
      }
    }
    return best;
  }

  // Takes one `item` out of the hero's bag and puts it on the ground just in
  // front of them; returns whether they had one.
  dropFromBag(item: BagItem): boolean {
    if (this.inside) return false; // nothing's dropped indoors (for now)
    if (!takeFromBag(this.hero.bag, item)) return false;
    this.dropLoot(item, this.hero.x + Math.sin(this.hero.facing) * DROP_AHEAD, this.hero.z + Math.cos(this.hero.facing) * DROP_AHEAD);
    return true;
  }

  // Takes off what's worn in `slot`, into the bag; returns whether there was something.
  unequip(slot: EquipSlot): boolean {
    const item = this.hero.equipment[slot];
    if (!item) return false;
    delete this.hero.equipment[slot];
    addToBag(this.hero.bag, item);
    return true;
  }

  // Takes off what's worn in `slot` and puts it on the ground in front of the hero.
  dropEquipped(slot: EquipSlot): boolean {
    const item = this.hero.equipment[slot];
    return !!item && this.unequip(slot) && this.dropFromBag(item);
  }

  // Wears `item` from the bag, putting what was in its slot back in the bag;
  // returns whether the bag had one.
  equipFromBag(item: ItemId): boolean {
    if (!takeFromBag(this.hero.bag, item)) return false;
    this.unequip(ITEMS[item].slot);
    wear(this.hero.equipment, item);
    return true;
  }

  // The door the hero can use right now: outdoors, one whose spot they stand
  // on; indoors, the room's own door when they're by it. Null otherwise.
  get doorInReach(): Entrance | null {
    const { hero } = this;
    if (this.inside) {
      const { room, entrance } = this.inside;
      return Math.abs(hero.x - room.door) < 0.6 && hero.z > room.depth - 1.4 ? entrance : null;
    }
    let best: Entrance | null = null;
    let bestDistance = ENTER_RANGE;
    for (const entrance of this.entrances) {
      const d = Math.hypot(entrance.x - hero.x, entrance.z - hero.z);
      if (d <= bestDistance) {
        best = entrance;
        bestDistance = d;
      }
    }
    return best;
  }

  // Goes through the door in reach: in, onto the room's floor just inside
  // it; or out, onto the spot outside it, facing away. Returns whether it did.
  useDoor(): boolean {
    const entrance = this.doorInReach;
    if (!entrance) return false;
    const { hero } = this;
    this.hop = null;
    if (this.inside) {
      this.inside = null;
      hero.x = entrance.x;
      hero.z = entrance.z;
      hero.y = this.getGroundY(hero.x, hero.z);
      hero.facing = Math.atan2(entrance.outX, entrance.outZ);
      return true;
    }
    this.enterRoom(entrance);
    return true;
  }

  // In through a building's door, onto the floor just inside it, facing in.
  private enterRoom(entrance: Entrance): void {
    const { room, furniture } = layoutOf(this.seed, entrance);
    this.inside = { entrance, room, furniture, seated: null };
    if (entrance.type === 'inn') this.lastInn = entrance; // to wake in, after a fall
    this.focusedId = null;
    this.hop = null;
    Object.assign(this.hero, { x: room.door, z: room.depth - 1, y: 0, facing: Math.PI }); // into the room (-Z)
  }

  // Indoors: the hero walks the room's floor (getting up first if seated);
  // walking out through the door goes back outside.
  private moveInside(dirX: number, dirZ: number, dt: number): void {
    const inside = this.inside!;
    if (Math.hypot(dirX, dirZ) < 1e-6) return;
    standUp(inside, this.hero);
    const bumps = (x: number, z: number, r: number) => bumpsNpc(this.npcs, inside.entrance, this.hero, x, z, r);
    if (walkInside(inside, this.hero, dirX, dirZ, HERO_SPEED * this.speedMultiplier * dt, bumps) === 'door') this.useDoor();
  }

  // The seat the hero could sit on right now, or null (outdoors, or seated).
  get seatInReach(): Seat | null {
    return this.inside ? seatInReach(this.inside, this.hero, (piece) => this.npcs.some((n) => n.seat?.piece === piece)) : null;
  }

  // Sits down on the seat in reach, or gets up if seated; returns whether either happened.
  sitOrStand(): boolean {
    const inside = this.inside;
    if (!inside) return false;
    if (inside.seated) {
      standUp(inside, this.hero);
      return true;
    }
    const seat = this.seatInReach;
    if (seat) sitDown(inside, this.hero, seat);
    return !!seat;
  }

  // What's happened since takeEvents() was last asked (for floating text).
  private events: GameEvent[] = [];
  takeEvents(): GameEvent[] {
    const events = this.events;
    this.events = [];
    return events;
  }

  // Coins near the hero go into their purse (no need to stop for them).
  private scoopCoins(): void {
    const amount = collectCoins(this.coins, this.hero.x, this.hero.z);
    this.hero.money += amount;
    if (amount > 0) this.events.push({ kind: 'coins', amount });
  }

  // The barmaid, when the hero's at her bar (in her inn, close by); else null.
  get barmaidInReach(): Npc | null {
    const inside = this.inside;
    return (inside && this.npcs.find((n) => n.role === 'barkeep' && n.where === inside.entrance && Math.hypot(n.x - this.hero.x, n.z - this.hero.z) < TALK_RANGE)) ?? null;
  }

  // Eats or drinks one of `item` from the bag, for the health it gives back; returns whether they did.
  consume(item: BagItem): boolean {
    if (!isProvision(item) || !takeFromBag(this.hero.bag, item)) return false;
    this.hero.hp = Math.min(maxHpAt(this.hero.level), this.hero.hp + PROVISIONS[item].heal);
    return true;
  }

  // Picks up the loot in reach into the hero's bag; returns what it was, or null.
  pickUp(): BagItem | null {
    const loot = this.lootInReach;
    if (!loot) return null;
    this.loot.splice(this.loot.indexOf(loot), 1);
    addToBag(this.hero.bag, loot.item);
    return loot.item;
  }

  get focused(): Enemy | null {
    return this.enemies.find((e) => e.id === this.focusedId) ?? null;
  }

  // Focuses a living enemy by id; null (or a dead one) clears the focus.
  focus(id: number | null): void {
    const enemy = this.enemies.find((e) => e.id === id);
    this.focusedId = enemy && enemy.state !== 'dead' ? enemy.id : null;
  }

  // Drops the focus the moment its enemy dies (so the next to strike takes
  // it), or once it's gone or far off.
  private keepFocus(): void {
    const enemy = this.focused;
    if (!enemy || enemy.state === 'dead' || Math.hypot(enemy.x - this.hero.x, enemy.z - this.hero.z) > FOCUS_RANGE) this.focusedId = null;
  }

  // An enemy's blow lands if the hero is still within its reach (a step
  // back in time dodges it). Out of health, the hero wakes at spawn, healed.
  private enemyStrikes(enemy: Enemy): void {
    if (Math.hypot(enemy.x - this.hero.x, enemy.z - this.hero.z) > ENEMY_STATS[enemy.kind].stop + 0.25) return;
    if (this.focusedId === null) this.focusedId = enemy.id; // whoever hits first gets the hero's attention
    if (this.godMode) return;
    this.events.push({ kind: 'hit', on: 'hero', amount: enemy.damage, x: this.hero.x, y: this.hero.y, z: this.hero.z });
    if (!hurt(this.hero, enemy.damage)) return;
    // Fallen: a share of their coins lost, they wake in the last inn they
    // entered (or at spawn, before any), healed; the foes lose interest.
    this.hero.money -= Math.floor(this.hero.money * DEATH_TOLL);
    const spawn = spawnOf(this.size);
    if (this.lastInn) this.enterRoom(this.lastInn);
    else this.teleport(spawn.x, spawn.z);
    this.hero.hp = maxHpAt(this.hero.level);
    for (const e of this.enemies) if (e.state === 'chase') e.state = 'wander';
  }
}
