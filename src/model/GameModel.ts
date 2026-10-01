// Model: owns game state and rules. No rendering, no input handling.
// World generation lives in worldgen/; this class holds the generated world
// and everyone in it, and runs each frame: the hero's movement and blows,
// the enemies (enemyDirector.ts), wildlife, the hero's focus and health.
// What blocks movement and sight is kept in obstacles.ts.

import {
  EDGE_MARGIN,
  HERO_SPEED,
  INDOOR_HERO_SPEED,
  HERO_RADIUS,
  ATTACK_DURATION,
  ATTACK_STRIKE,
  FOCUS_RANGE,
  FOCUS_TURN_RANGE,
  TILE_HEIGHT,
  ROAD_SURFACE_HEIGHT,
  ENEMY_ACTIVE_RADIUS,
} from './constants';
import { Nearby } from '../util/nearby';
import { DEFAULT_MAP_SIZE, spawnOf, toCellX, toCellZ, type MapSize } from './map/grid';
import type { World, Building, Bush, Enemy, Field, GameEvent, Hero, Tree, House, Surface, Village } from './types';
import { bumpsEnemy, spawnEnemies } from './enemies/enemies';
import { EnemyDirector } from './enemies/enemyDirector';
import { FRESH_HERO_STATS, HERO_NAME, tiredPace } from './hero/heroStats';
import { untrained } from './hero/training';
import { HERO_LOOK } from './human/humanoid';
import type { Obstacles } from './map/obstacles';
import { worldObstacles } from './map/blockers';
import { stepHop, type Hop } from './hero/hop';
import type { GroundLoot } from './loot/loot';
import { addToBag, eatOrDrink, takeFromBag, type BagItem } from './hero/bag';
import { Ground } from './loot/ground';
import type { EquipSlot, ItemId } from './human/equipment';
import { putOn, takeOff } from './hero/wearing';
import { spawnWildlife, stepWildlife, type Wildlife } from './wildlife/wildlife';
import { generateWorld, solidCells } from './worldgen/world';
import { onPaving } from './map/roads';
import { entrancesOf, type Entrance } from './interiors/interiors';
import type { Seat } from './interiors/furniture';
import { doorInReach, layoutOf, seatInReach, sitDown, standUp, walkInside, type Inside, type Seated } from './interiors/indoors';
import { stepYard, toggleYard, type YardStay } from './interiors/furnitureYard';
import { benchSeatInReach, squareBenches } from './worldgen/benches';
import { bumpsNpc, spawnNpcs, type Npc } from './npcs/npcs';
import { stepNpcs } from './npcs/npcRoutine';
import { makeWay } from './npcs/npcWalk';
import type { Shop } from './inn/tavernShop';
import { BLESSINGS, tickBlessing, tossCoin, walkFactor, wellInReach, type BlessingKind } from './hero/blessing';
import { QuestBook } from './quests/questBook';
import { takeSpeech } from './npcs/speech';
import { START_MINUTES } from './clock';
import { fall, liveOn } from './hero/setbacks';
import { addRuinObstacles, type Ruin } from './ruins/ruins';
import { addCryptObstacles, cryptBlocks, cryptInside, placeCrypts, registerCrypts, type Crypt, type CryptInside } from './crypts/crypts';
import { CRYPT_FOE_ID, CryptFoes, cryptKey, guardCount } from './crypts/cryptFoes';
import { SUMMONED, clearedShare } from './crypts/cryptLord';
import { CHILL_PACE } from './crypts/frostBreath';
import { cryptHooks, foeStrikes, landBlow } from './hero/fighting';
import { addCampObstacles, type Camp } from './camps/camps';

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
  readonly ruins: Ruin[]; // old keeps and chapels out in the wilds (ruins/ruins.ts)
  readonly crypts: Crypt[]; // under them (crypts/crypts.ts)
  readonly ground = new Ground((x, z) => this.getGroundY(x, z)); // loot and coins lying about (loot/ground.ts)
  readonly loot = this.ground.loot; // on the ground, until picked up
  readonly coins = this.ground.coins; // dropped coins, picked up by walking near them
  readonly slain = new Set<number>(); // foes killed, by id (a saved world is made again without them)
  readonly shops = new Map<number, Shop>(); // each inn's, by its door's index (inn/tavernShop.ts)
  lastInn: Entrance | null = null; // the last inn entered, where the hero wakes after a fall
  minutes = START_MINUTES; // the game's clock (clock.ts): a minute to each second played
  fullWalls = false; // the pause menu's option: rooms' inner walls full height, else cut low (upstairs.ts innerWalls)
  readonly quests: QuestBook; // the notice boards' quests, and those taken (quests/)
  readonly entrances: Entrance[]; // every door that can be gone through
  readonly npcs: Npc[]; // the villagers, one to a house (npcs/)
  // Where the hero is while indoors (indoors.ts); null outdoors.
  inside: Inside | null = null;
  yard: YardStay | null = null; // dev cheat: flat grass off the map, every furniture on it
  readonly outdoors: { seated: Seated } = { seated: null }; // on a bench, on a village square
  readonly wildlife: Wildlife[]; // peaceful animals: they never block and can't be hurt
  private readonly nearNpcs: Nearby<Npc>; // the villagers round the hero (of villages near enough to act, or be in the way), kept to hand
  private readonly nearWildlife: Nearby<Wildlife>; // and the animals (the full map has tens of thousands of each)
  // The enemy the hero has focused (clicked, or the first to hit them since
  // focus last cleared), shown in the HUD; null when none.
  private focusedId: number | null = null;
  private below: { key: string; run: CryptFoes; ground: Ground } | null = null; // down in a crypt: its guards, and its floor's loot
  readonly cryptsCleared = new Map<string, Set<number>>(); // each crypt's guards slain for good, by post (saved)

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
  random: () => number = Math.random; // the rolls of chance in a fight: a dodge, a critical blow (tests set their own)

  // `size` defaults to the game's map; tests pass small worlds.
  // `world`: the seed's, made already (kept from an earlier visit: controller/storage/worldCache.ts), else made now.
  constructor(seed: number, size: MapSize = DEFAULT_MAP_SIZE, world: World = generateWorld(seed, size)) {
    this.seed = seed;

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
    this.ruins = world.ruins;
    this.camps = world.camps;
    addRuinObstacles(this.obstacles, this.ruins); // (before the foes, to stand clear of them)
    addCampObstacles(this.obstacles, this.camps);
    this.crypts = placeCrypts(this); // a stairway down in each ruin (its tile blocked: down with E)
    addCryptObstacles(this.obstacles, this.crypts);
    registerCrypts(this.crypts);

    const spawn = spawnOf(this.size);
    this.hero = { name: HERO_NAME, x: spawn.x, z: spawn.z, y: 0, facing: 0, look: { ...HERO_LOOK }, equipment: {}, bag: {}, bagOrder: [], money: 0, ...FRESH_HERO_STATS, trained: untrained() }; // starts naked
    this.hero.y = this.getGroundY(this.hero.x, this.hero.z);
    this.enemies = spawnEnemies(this); // (bandits in their camps)
    for (const enemy of this.enemies) enemy.y = this.getGroundY(enemy.x, enemy.z);
    this.director = new EnemyDirector(this.enemies, this.hero, this.obstacles, this.size, (x, z) => this.getGroundY(x, z), (e) => foeStrikes(this, e));
    this.wildlife = spawnWildlife(this);
    this.entrances = entrancesOf(this.houses, this.buildings);
    this.npcs = spawnNpcs(this.seed, this.entrances, this.villages, this.fields);
    this.entrances.push(...this.crypts.map((c) => c.entrance)); // (the crypts' ways in, after the buildings' doors: they keep their places)
    this.nearNpcs = new Nearby(this.npcs, (npc) => npc.village, ENEMY_ACTIVE_RADIUS + 40); // (+40: as far from their village as a villager goes, out to a field)
    this.nearWildlife = new Nearby(this.wildlife, (animal) => animal, ENEMY_ACTIVE_RADIUS);
    this.quests = new QuestBook(this);
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
    if (this.attackElapsed !== null || this.seated) return false;
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
    this.yard = null;
    this.outdoors.seated = null;
    this.hero.x = x;
    this.hero.z = z;
    this.hero.y = this.getGroundY(x, z);
    this.hop = null;
  }

  // Dev cheat: the flat grass yard, or back to where the hero was.
  toggleFurnitureYard(): string {
    this.hop = null;
    this.focusedId = null;
    return toggleYard(this);
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
    this.minutes += dt; // a second played, a minute on the clock
    tickBlessing(this.hero, dt); // a well's, wearing off
    if (Math.hypot(dirX, dirZ) > 1e-6 && !this.seated) makeWay(this.folk, this, dirX, dirZ, dt); // (folk stood in the way step aside)
    if (this.inside) {
      // The world outside stands still while the hero's indoors.
      this.moveInside(dirX, dirZ, dt);
      this.advanceAttack(dt);
      if (this.below) [this.below.run.update(dt), this.scoopCoins(), this.keepFocus()]; // down in a crypt: its guards
      stepNpcs(this.folk, this, dt);
      liveOn(this, dt); // energy: spent, kept sat down, slept back (out of it: to the nearest inn's hearth)
      return;
    }
    if (this.yard) {
      stepYard(this.hero, this.yard.furniture, dirX, dirZ, HERO_SPEED * this.speedMultiplier * walkFactor(this.hero) * tiredPace(this.hero) * dt);
      this.advanceAttack(dt);
      return;
    }
    if (this.outdoors.seated && Math.hypot(dirX, dirZ) > 1e-6) this.sitOrStand(); // up off the bench to walk
    if (!this.outdoors.seated) this.moveHorizontally(dirX, dirZ, dt);
    this.advanceAttack(dt);
    this.director.update(dt);
    this.quests.update(dt);
    stepNpcs(this.folk, this, dt);
    this.scoopCoins();
    if (liveOn(this, dt)) return; // out of energy: to the nearest inn's hearth
    this.keepFocus();
    stepWildlife(this.nearWildlife.near(this.hero), this, this.hero, dt);
    // Runs even with no input, so a hop started just before the player let
    // go still finishes instead of freezing mid-air.
    if (!this.outdoors.seated) ({ hop: this.hop, y: this.hero.y } = stepHop(this.hop, this.hero.y, this.getGroundY(this.hero.x, this.hero.z), dt));
  }

  // The villagers round the hero (where they are on the map: a building, if in one).
  private get folk(): readonly Npc[] { return this.nearNpcs.near(this.inside?.entrance ?? this.hero); }

  // Moves the current blow along; outdoors it lands partway through (there's
  // no one to hit indoors, so there the swing just plays out).
  private advanceAttack(dt: number): void {
    if (this.attackElapsed === null) return;
    this.attackElapsed += dt;
    if ((!this.inside || this.below) && !this.yard && !this.attackLanded && this.attackElapsed >= ATTACK_STRIKE * ATTACK_DURATION) {
      this.attackLanded = true;
      landBlow(this);
    }
    if (this.attackElapsed >= ATTACK_DURATION) this.attackElapsed = null;
  }

  private moveHorizontally(dirX: number, dirZ: number, dt: number): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return;

    const dist = HERO_SPEED * this.speedMultiplier * walkFactor(this.hero) * tiredPace(this.hero) * dt;
    const candidateX = Math.min(this.size.width - 1 - EDGE_MARGIN, Math.max(EDGE_MARGIN, this.hero.x + (dirX / len) * dist));
    const candidateZ = Math.min(this.size.depth - 1 - EDGE_MARGIN, Math.max(EDGE_MARGIN, this.hero.z + (dirZ / len) * dist));

    // Axis-separated so the hero slides along an obstacle's edge instead of
    // stopping dead the instant either component alone would move into it.
    const free = (x: number, z: number) =>
      this.noclip || (!this.obstacles.isBlocked(x, z, HERO_RADIUS) && !bumpsEnemy(this.enemies, this.hero, x, z, HERO_RADIUS) && !bumpsNpc(this.folk, null, this.hero, x, z, HERO_RADIUS));
    if (free(candidateX, this.hero.z)) this.hero.x = candidateX;
    if (free(this.hero.x, candidateZ)) this.hero.z = candidateZ;
    this.hero.facing = Math.atan2(dirX, dirZ);
  }

  // An item, or `amount` copper in coins, put on the ground at (x, z).
  dropLoot = (item: BagItem, x: number, z: number): void => this.groundHere.drop(item, x, z);
  dropCoins = (amount: number, x: number, z: number): void => this.groundHere.dropCoins(amount, x, z);

  // The foes about: a crypt's guards down there (crypts/cryptFoes.ts), else the world's; and the ground's loot here.
  get foes(): Enemy[] { return this.below?.run.foes ?? this.enemies; }
  get groundHere(): Ground { return this.below?.ground ?? this.ground; }
  // A crypt's guards, its arrows in flight (while the hero's down in it), or null.
  get crypt(): CryptFoes | null { return this.below?.run ?? null; }
  shove = (enemy: Enemy, dx: number, dz: number): void => void (this.below?.run.director ?? this.director).move(enemy, dx, dz);
  report = (event: GameEvent): void => void this.events.push(event);
  slayGuard = (enemy: Enemy): void => {
    const post = CryptFoes.postOf(enemy);
    if (!this.below || enemy.id < CRYPT_FOE_ID || post >= SUMMONED || !this.inside) return; // (those the lord calls up aren't the crypt's)
    this.cleared(this.below.key).add(post);
    if (this.below.run.share === 1) this.events.push({ kind: 'cleared', name: cryptInside(this.seed, this.inside.entrance).crypt.name });
  };
  // How much of a crypt is cleared (0..1): its guards slain and its lord, of all of them (by its way in).
  clearedShare = (entrance: Entrance): number => {
    const crypt = cryptInside(this.seed, entrance);
    return clearedShare(this.cleared(cryptKey(crypt.crypt)), guardCount(this.seed, crypt));
  };
  // A crypt's guards slain for good, by its key (its ruin's corner), by post.
  cleared = (key: string): Set<number> => this.cryptsCleared.get(key) ?? this.cryptsCleared.set(key, new Set()).get(key)!;

  // The loot nearest the hero within reach to pick up (outdoors), or null.
  get lootInReach(): GroundLoot | null {
    return (this.inside && !this.below) || this.yard ? null : this.groundHere.nearest(this.hero.x, this.hero.z);
  }

  // Takes one `item` out of the hero's bag and puts it on the ground just in
  // front of them; returns whether they had one.
  dropFromBag(item: BagItem): boolean {
    if (this.inside || this.yard) return false; // nothing's dropped indoors, or in the furniture yard
    if (!takeFromBag(this.hero.bag, item)) return false;
    this.dropLoot(item, this.hero.x + Math.sin(this.hero.facing) * DROP_AHEAD, this.hero.z + Math.cos(this.hero.facing) * DROP_AHEAD);
    return true;
  }

  // Gear taken off into the bag, or worn from it (hero/wearing.ts); each returns whether it was.
  unequip = (slot: EquipSlot): boolean => takeOff(this.hero, slot);
  equipFromBag = (item: ItemId): boolean => putOn(this.hero, item);

  // Takes off what's worn in `slot` and puts it on the ground in front of the hero.
  dropEquipped(slot: EquipSlot): boolean {
    const item = this.hero.equipment[slot];
    return !!item && this.unequip(slot) && this.dropFromBag(item);
  }

  // The door the hero can use right now (indoors.ts), or null.
  get doorInReach(): Entrance | null {
    return this.yard ? null : doorInReach(this.inside, this.entrances, this.hero);
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
      this.below = null;
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
  enterRoom(entrance: Entrance): void {
    this.yard = null;
    const { room, furniture } = layoutOf(this.seed, entrance);
    const crypt = entrance.type === 'crypt' ? cryptInside(this.seed, entrance) : null;
    this.inside = { entrance, room, furniture, seated: null, ...(crypt && { walls: (x: number, z: number, r: number) => cryptBlocks(crypt, x, z, r) }) };
    if (crypt) this.events.push({ kind: 'arrive', name: crypt.crypt.name, level: crypt.crypt.level }); // (its name and level, as the hero comes down)
    this.below = crypt && this.goDown(crypt);
    this.outdoors.seated = null;
    if (entrance.type === 'inn') this.lastInn = entrance; // to wake in, after a fall
    this.focusedId = null;
    this.hop = null;
    Object.assign(this.hero, { x: room.door, z: room.depth - 1, y: 0, facing: Math.PI }); // into the room (-Z)
  }

  // Down into a crypt: its guards not yet slain at their posts, its own floor for what they leave.
  private goDown(crypt: CryptInside): NonNullable<GameModel['below']> {
    const key = cryptKey(crypt.crypt);
    const run = new CryptFoes(this.seed, crypt, this.cleared(key), this.hero, cryptHooks(this));
    return { key, run, ground: new Ground(() => 0) };
  }

  // Indoors: the hero walks the room's floor (getting up first if seated);
  // out only through the door, with E (useDoor).
  private moveInside(dirX: number, dirZ: number, dt: number): void {
    const inside = this.inside!;
    if (Math.hypot(dirX, dirZ) < 1e-6) return;
    standUp(inside, this.hero);
    const bumps = (x: number, z: number, r: number) => bumpsNpc(this.folk, inside.entrance, this.hero, x, z, r) || (!!this.below && bumpsEnemy(this.below.run.foes, this.hero, x, z, r));
    walkInside(inside, this.hero, dirX, dirZ, INDOOR_HERO_SPEED * this.speedMultiplier * walkFactor(this.hero) * tiredPace(this.hero) * (this.hero.chilledFor ? CHILL_PACE : 1) * dt, bumps); // (out only with E at the door)
  }

  // Where the hero sits (indoors, or on a bench outdoors), or null standing.
  get seated(): Seated {
    return (this.inside ?? this.outdoors).seated;
  }

  // The free seat the hero could sit on right now (in the room, or a bench's), or null (seated).
  get seatInReach(): Seat | null {
    if (this.yard) return null;
    const taken = (piece: Seat['piece']) => this.npcs.some((n) => n.seat?.piece === piece);
    if (this.inside) return seatInReach(this.inside, this.hero, taken);
    return this.outdoors.seated ? null : benchSeatInReach(squareBenches(this), this.hero, (seat) => taken(seat.piece)); // the squares' benches
  }

  // Sits down on the seat in reach, or gets up if seated; returns whether either happened.
  sitOrStand(): boolean {
    const at = this.inside ?? this.outdoors;
    if (at.seated) {
      standUp(at, this.hero, this.inside ? 0 : this.getGroundY(at.seated.from.x, at.seated.from.z));
      return true;
    }
    const seat = this.seatInReach;
    if (seat) sitDown(at, this.hero, seat);
    return !!seat;
  }

  // What's happened since takeEvents() was last asked (for floating text).
  private events: GameEvent[] = [];
  private seenLevel: number | null = null; // the hero's level when events were last taken (null: not yet: whatever it is, it's not news)
  takeEvents(): GameEvent[] {
    if (this.seenLevel !== null && this.hero.level > this.seenLevel) this.events.push({ kind: 'levelUp', level: this.hero.level, points: this.hero.statPoints });
    this.seenLevel = this.hero.level;
    const events = [...this.events, ...this.quests.events.splice(0), ...takeSpeech()];
    this.events = [];
    return events;
  }

  // Coins near the hero go into their purse (no need to stop for them).
  private scoopCoins(): void {
    const amount = this.groundHere.scoop(this.hero.x, this.hero.z);
    this.hero.money += amount;
    if (amount > 0) this.events.push({ kind: 'coins', amount });
  }

  // The notice board the hero's at (outdoors), by its village's index; else null.
  get boardInReach(): number | null {
    return this.inside || this.yard ? null : this.quests.boardInReach();
  }

  // Eats or drinks one of `item` from the bag, for the health it gives back (hero/bag.ts); returns whether they did.
  consume = (item: BagItem): boolean => eatOrDrink(this.hero, item);

  // The village well the hero's beside (outdoors), by its village's index; else null.
  get wellInReach(): number | null {
    return this.inside || this.yard ? null : wellInReach(this.villages, this.hero);
  }

  // A silver coin into the well in reach, for a blessing (blessing.ts); returns it, or null (none in reach, or no silver).
  tossCoin(roll = Math.random()): BlessingKind | null {
    const kind = this.wellInReach === null ? null : tossCoin(this.hero, roll);
    this.events.push(kind ? { kind: 'blessing', name: BLESSINGS[kind].name } : { kind: 'poor', text: 'Not a silver coin to toss' });
    return kind;
  }

  // Picks up the loot in reach into the hero's bag; returns what it was, or null.
  pickUp(): BagItem | null {
    const loot = this.lootInReach;
    if (!loot) return null;
    this.groundHere.take(loot);
    addToBag(this.hero.bag, loot.item);
    this.quests.onPickUp(loot.item);
    return loot.item;
  }

  get focused(): Enemy | null {
    return this.foes.find((e) => e.id === this.focusedId) ?? null;
  }

  // Focuses a living enemy by id; null (or a dead one) clears the focus.
  focus(id: number | null): void {
    const enemy = this.foes.find((e) => e.id === id);
    this.focusedId = enemy && enemy.state !== 'dead' ? enemy.id : null;
  }

  // Drops the focus the moment its enemy dies (so the next to strike takes
  // it), or once it's gone or far off.
  private keepFocus(): void {
    const enemy = this.focused;
    if (!enemy || enemy.state === 'dead' || Math.hypot(enemy.x - this.hero.x, enemy.z - this.hero.z) > FOCUS_RANGE) this.focusedId = null;
  }

  // Out of health: fallen, waking at an inn (hero/setbacks.ts).
  fall(): void {
    fall(this);
  }
}
