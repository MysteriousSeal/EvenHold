// Model: owns game state and rules. No rendering, no input handling.
// World generation lives in worldgen/; this class holds the generated world
// and everyone in it, and runs each frame: the hero's movement and blows,
// the enemies (enemyDirector.ts), wildlife, the hero's focus and health.
// What blocks movement and sight is kept in obstacles.ts.

import {
  EDGE_MARGIN,
  HERO_SPEED,
  HERO_RADIUS,
  INDOOR_SCALE,
  BUSH_COLLISION_HALF,
  TREE_COLLISION_HALF,
  ATTACK_DURATION,
  ATTACK_KNOCKBACK,
  ATTACK_REACH,
  ATTACK_STRIKE,
  CAMPFIRE_COLLISION_HALF,
  CAMP_PROP_COLLISION_HALF,
  PALISADE_THICKNESS,
  ENEMY_STATS,
  HERO_DAMAGE,
  FOCUS_RANGE,
  FOCUS_TURN_RANGE,
  LANTERN_COLLISION_HALF,
  FENCE_THICKNESS,
  HOP_DURATION,
  HOP_HEIGHT,
  TILE_HEIGHT,
  ROAD_SURFACE_HEIGHT,
} from './constants';
import { DEFAULT_MAP_SIZE, spawnOf, toCellX, toCellZ, type MapSize } from './grid';
import type { Building, Bush, Camp, Enemy, Field, Hero, Tree, House, Surface, Village } from './types';
import { campPalisade, campPieces, spawnEnemies } from './enemies/enemies';
import { EnemyDirector } from './enemies/enemyDirector';
import { FRESH_HERO_STATS, HERO_NAME, gainXp, hurt, maxHpAt, recover } from './heroStats';
import { HERO_LOOK } from './human/humanoid';
import { Obstacles } from './obstacles';
import { PICKUP_RANGE, rollDrop, type GroundLoot } from './loot/loot';
import { addToBag, takeFromBag, type BagItem } from './bag';
import { ITEMS, wear, type EquipSlot, type ItemId } from './human/equipment';
import { spawnWildlife, stepWildlife, type Wildlife } from './wildlife/wildlife';
import { generateWorld, solidCells } from './worldgen/world';
import { fenceEdges } from './worldgen/fields';
import { squareLanterns } from './worldgen/villages';
import { onPaving } from './roads';
import { ENTER_RANGE, entrancesOf, roomFor, type Entrance, type Room } from './interiors/interiors';
import { bumpsFurniture, furnish, type Furniture } from './interiors/furniture';

const DROP_AHEAD = 0.45; // how far in front of the hero things dropped from the bag land

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
  private nextLootId = 0;
  readonly entrances: Entrance[]; // every door that can be gone through
  // Where the hero is while indoors: the building's door and its room (the
  // hero's x/z are then room coordinates); null outdoors.
  inside: { entrance: Entrance; room: Room; furniture: Furniture[] } | null = null;
  readonly wildlife: Wildlife[]; // peaceful animals: they never block and can't be hurt
  // The enemy the hero has focused (clicked, or the first to hit them since
  // focus last cleared), shown in the HUD; null when none.
  private focusedId: number | null = null;

  private readonly obstacles: Obstacles;
  private readonly director: EnemyDirector;
  private hop: { fromY: number; toY: number; elapsed: number } | null = null;
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
    // Houses and wells nearly fill their tile, so they block all of it;
    // bushes, tree trunks and lamp posts are much smaller, so they get
    // their own footprint; field fences run along tile edges.
    this.obstacles = new Obstacles(this.size, this.lakeMap, new Set(solidCells(this)));
    for (const b of this.bushes) this.obstacles.addProp(b.x, b.z, BUSH_COLLISION_HALF);
    for (const t of this.trees) this.obstacles.addProp(t.x, t.z, TREE_COLLISION_HALF);
    for (const v of this.villages) for (const [x, z] of squareLanterns(v)) this.obstacles.addProp(x, z, LANTERN_COLLISION_HALF);
    for (const field of this.fields) {
      for (const { x, z, side } of fenceEdges(field)) this.obstacles.addFenceStrip(x, z, side, FENCE_THICKNESS);
    }

    const spawn = spawnOf(this.size);
    this.hero = { name: HERO_NAME, x: spawn.x, z: spawn.z, y: 0, facing: 0, look: { ...HERO_LOOK }, equipment: {}, bag: {}, ...FRESH_HERO_STATS }; // starts naked
    this.hero.y = this.getGroundY(this.hero.x, this.hero.z);
    const { enemies, camps } = spawnEnemies(this);
    this.enemies = enemies;
    this.camps = camps;
    // Tents block their tile; the fire (too low to hide anyone), crates and
    // rack a square in the middle of theirs; the palisade a strip along its
    // edges. The loot pile and log seats don't block.
    for (const camp of camps) {
      for (const piece of campPieces(camp)) {
        if (piece.kind === 'tent') this.obstacles.addSolid(piece.x, piece.z);
        else if (piece.kind === 'fire') this.obstacles.addProp(piece.x, piece.z, CAMPFIRE_COLLISION_HALF, true);
        else if (piece.kind !== 'loot') this.obstacles.addProp(piece.x, piece.z, CAMP_PROP_COLLISION_HALF);
      }
      for (const edge of campPalisade(camp)) this.obstacles.addFenceStrip(edge.x, edge.z, edge.side, PALISADE_THICKNESS);
    }
    for (const enemy of this.enemies) enemy.y = this.getGroundY(enemy.x, enemy.z);
    this.director = new EnemyDirector(this.enemies, this.hero, this.obstacles, this.size, (x, z) => this.getGroundY(x, z), (e) => this.enemyStrikes(e));
    this.wildlife = spawnWildlife(this);
    this.entrances = entrancesOf(this.houses, this.buildings);
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
    if (this.attackElapsed !== null) return false;
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
      recover(this.hero, dt);
      return;
    }
    this.moveHorizontally(dirX, dirZ, dt);
    this.advanceAttack(dt);
    this.director.update(dt);
    recover(this.hero, dt);
    this.keepFocus();
    stepWildlife(this.wildlife, this, this.hero, dt);
    // Runs even with no input, so a hop started just before the player let
    // go still finishes instead of freezing mid-air.
    this.updateHop(dt);
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
    const free = (x: number, z: number) => this.noclip || (!this.obstacles.isBlocked(x, z, HERO_RADIUS) && !this.bumpsEnemy(x, z));
    if (free(candidateX, this.hero.z)) this.hero.x = candidateX;
    if (free(this.hero.x, candidateZ)) this.hero.z = candidateZ;
    this.hero.facing = Math.atan2(dirX, dirZ);
  }

  // Living enemies are solid to the hero: a step is refused if it would
  // overlap one and bring the two closer. Stepping away from an enemy
  // already pressed against the hero is always allowed, so the hero can't
  // get pinned.
  private bumpsEnemy(x: number, z: number): boolean {
    return this.enemies.some((enemy) => {
      const reach = HERO_RADIUS + ENEMY_STATS[enemy.kind].radius;
      if (enemy.state === 'dead' || Math.abs(enemy.x - x) >= reach || Math.abs(enemy.z - z) >= reach) return false;
      return Math.hypot(enemy.x - x, enemy.z - z) < Math.hypot(enemy.x - this.hero.x, enemy.z - this.hero.z);
    });
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
    target.hurtFor = 0.25;
    target.swingFor = null; // a hit interrupts its own blow
    target.state = target.hp <= 0 ? 'dead' : 'chase';
    if (target.state === 'dead') {
      gainXp(this.hero, target.xp);
      const item = rollDrop(ENEMY_STATS[target.kind].family, target.id);
      if (item) this.dropLoot(item, target.x, target.z);
    }
    const d = Math.max(best, 1e-6);
    this.director.move(target, ((target.x - this.hero.x) / d) * ATTACK_KNOCKBACK, ((target.z - this.hero.z) / d) * ATTACK_KNOCKBACK);
  }

  // Puts an item on the ground at (x, z).
  dropLoot(item: BagItem, x: number, z: number): void {
    this.loot.push({ id: this.nextLootId++, item, x, z, y: this.getGroundY(x, z) });
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
    const room = roomFor(this.seed, entrance);
    this.inside = { entrance, room, furniture: furnish(this.seed, entrance, room) };
    this.focusedId = null;
    hero.x = room.door;
    hero.z = room.depth - 1;
    hero.y = 0;
    hero.facing = Math.PI; // into the room (-Z)
    return true;
  }

  // Indoors: the hero walks the room's floor, walled in but for the door;
  // walking out through it goes back outside.
  private moveInside(dirX: number, dirZ: number, dt: number): void {
    const { room, furniture } = this.inside!;
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return;
    const dist = HERO_SPEED * this.speedMultiplier * dt;
    const r = HERO_RADIUS * INDOOR_SCALE; // drawn bigger indoors, so bigger to bump into things too
    const hero = this.hero;
    hero.facing = Math.atan2(dirX, dirZ);
    // Axis by axis, so the hero slides along furniture instead of sticking to it.
    const nx = Math.min(room.width - 0.5 - r, Math.max(-0.5 + r, hero.x + (dirX / len) * dist));
    if (!bumpsFurniture(furniture, nx, hero.z, r)) hero.x = nx;
    const inDoorway = Math.abs(hero.x - room.door) < 0.5 - r;
    const nz = hero.z + (dirZ / len) * dist;
    if (inDoorway && nz >= room.depth - 0.5 - r) {
      this.useDoor(); // out through the door
      return;
    }
    const clampedZ = Math.min(room.depth - 0.5 - r, Math.max(-0.5 + r, nz));
    if (!bumpsFurniture(furniture, hero.x, clampedZ, r)) hero.z = clampedZ;
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
    if (!hurt(this.hero, enemy.damage)) return;
    const spawn = spawnOf(this.size);
    this.teleport(spawn.x, spawn.z);
    this.hero.hp = maxHpAt(this.hero.level);
    for (const e of this.enemies) if (e.state === 'chase') e.state = 'wander';
  }

  // Whenever the ground height under the hero changes, move to it over a
  // short time: a straight line from the old height to the new one, plus —
  // for a real terrain step — a parabola peaking HOP_HEIGHT above that line
  // halfway through. A new change mid-move restarts from the current
  // height, so rapid multi-step climbs stay continuous.
  private updateHop(dt: number): void {
    const groundY = this.getGroundY(this.hero.x, this.hero.z);
    const currentTarget = this.hop ? this.hop.toY : this.hero.y;
    if (groundY !== currentTarget) {
      this.hop = { fromY: this.hero.y, toY: groundY, elapsed: 0 };
    }
    if (!this.hop) return;

    // Small height changes (stepping onto a road's paving) just ease up or
    // down quickly; only a real terrain step gets the full arcing hop. The
    // cut-off sits between the paving height (0.08) and a tier (0.15).
    const { fromY, toY } = this.hop;
    const isStep = Math.abs(toY - fromY) >= TILE_HEIGHT * 0.75;
    const duration = isStep ? HOP_DURATION : HOP_DURATION / 2;
    const arc = isStep ? HOP_HEIGHT : 0;

    this.hop.elapsed += dt;
    const p = Math.min(1, this.hop.elapsed / duration);
    this.hero.y = fromY + (toY - fromY) * p + arc * 4 * p * (1 - p);

    if (p >= 1) this.hop = null;
  }
}
