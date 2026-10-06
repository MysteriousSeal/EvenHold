// Model: owns game state and rules. No rendering, no input handling.
// World generation lives in worldgen/; this class holds the generated world
// and everyone in it, and runs each frame: the hero's movement and blows,
// the enemies (enemyDirector.ts), travellers on the roads, wildlife, the hero's focus and health.
// What blocks movement and sight is kept in obstacles.ts.

import { CombatMoves, GUARD_PACE } from './hero/combatMoves';
import { stepOutdoors } from './hero/walkOutdoors';
import { HERO_SPEED, INDOOR_HERO_SPEED, HERO_RADIUS, FOCUS_TURN_RANGE, ENEMY_ACTIVE_RADIUS } from './constants';
import { Nearby } from '../util/nearby';
import { DEFAULT_MAP_SIZE, spawnOf, wholeMap, type Area, type MapSize } from './map/grid';
import type { World, Building, Bush, Enemy, Field, GameEvent, Hero, Tree, House, Village } from './types';
import { TilePatch, type Tiles } from './map/tiles';
import { bumpsEnemy } from './enemies/enemies';
import { EnemyDirector } from './enemies/enemyDirector';
import type { TravellerCrowd } from './travellers/travellerCrowd';
import { LiveWorld } from './world/liveWorld';
import { SyncSource, WorldStreamer, type RegionSource } from './world/worldStreamer';
import { bagRoom, canCarry } from './hero/bagSlots';
import { takeFromSlot } from './hero/bagStacks';
import { type Scenery } from './scenery/scenery';
import { freshHero, tiredPace } from './hero/heroStats';
import type { Obstacles } from './map/obstacles';
import { stepHop, type Hop } from './hero/hop';
import type { GroundLoot } from './loot/loot';
import { addToBag, drinkPotion, eatOrDrink, takeFromBag, type BagItem } from './hero/bag';
import { Ground } from './loot/ground';
import type { EquipSlot } from './human/equipment';
import type { GearKey } from './human/items/gear';
import { gearPace, regenerate } from './hero/gearEffects';
import { putOn, takeOff } from './hero/wearing';
import { stepWildlife, type Wildlife } from './wildlife/wildlife';
import { generateWorld } from './worldgen/world';
import { type Entrance } from './interiors/interiors';
import type { Seat } from './interiors/furniture';
import { armsSheathed, doorInReach, layoutOf, seatInReach, sitDown, standUp, walkInside, type Inside, type Seated } from './interiors/indoors';
import { stepYard, toggleYard, type YardStay } from './interiors/furnitureYard';
import { benchSeatInReach, squareBenches } from './worldgen/benches';
import { bumpsNpc, type Npc } from './npcs/npcs';
import { stepNpcs } from './npcs/npcRoutine';
import { makeWay } from './npcs/npcWalk';
import type { Shop } from './inn/tavernShop';
import { BLESSINGS, tickBlessing, tossCoin, walkFactor, wellInReach, type BlessingKind } from './hero/blessing';
import { QuestBook } from './quests/questBook';
import { takeSpeech } from './npcs/speech';
import { START_MINUTES } from './clock';
import { fall, liveOn } from './hero/setbacks';
import { type Ruin } from './ruins/ruins';
import { checkOut } from './inn/roomLetting';
import { type Crypt } from './crypts/crypts';
import { CryptFoes } from './crypts/cryptFoes';
import { type Cave } from './caves/caves';
import { CaveRun } from './caves/caveFoes';
import { dungeonAt, dungeonBlocks, dungeonRun, dungeonShare } from './dungeons/dungeons';
import { goesUnder, type DungeonRun } from './dungeons/dungeonTypes';
import { dungeonHooks, foeStrikes, knockedOn, landBlow } from './hero/fighting';
import { WildMoves } from './enemies/wildMoves';
import { CampLife } from './camps/campLife';
import { VillageWelcome } from './villages/villageWelcome';
import { Work } from './jobs/work';
import { Focus, cycleFocus as turnFocus } from './hero/focus';
import { type Camp } from './camps/camps';
import { Lumber } from './skills/lumber';

export const CLASSIC_MOST = 4096; // tiles a side, at most, of a world made whole (larger: streamed)
const DROP_AHEAD = 0.45; // how far in front of the hero things dropped from the bag land

export class GameModel {
  readonly seed: number;
  readonly size: MapSize;
  readonly tiles: Tiles; // each tile's height, water and surface, where it is (map/tiles.ts)
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
  readonly travellers: TravellerCrowd; // on the roads between the villages (travellers/)
  readonly scenery: Scenery[]; // rocks and landmarks out in the wilds (scenery/scenery.ts) // on the roads between the villages (travellers/travellers.ts)
  readonly crypts: Crypt[]; // under them (crypts/crypts.ts)
  readonly caves: Cave[]; // in the hills (caves/caves.ts)
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
  private readonly focusOn = new Focus(() => this.foes); // (the foe the hero's focused on: hero/focus.ts)
  private below: { key: string; run: DungeonRun; ground: Ground } | null = null; // down in a dungeon (dungeons/): its foes, and its floor's loot
  readonly cryptsCleared = new Map<string, Set<number>>(); // each dungeon's foes slain for good, by post, by its key (saved: a crypt's, a cave's)

  private readonly obstacles: Obstacles;
  readonly world: LiveWorld; // the world as it's played: its tiles, what blocks the way, everything in it (world/liveWorld.ts)
  private readonly streamer: WorldStreamer | null; // a streamed world's: its regions kept made round the hero
  private readonly director: EnemyDirector;
  private hop: Hop | null = null;
  readonly wild: WildMoves; // the wild beasts' told moves (enemies/wildMoves.ts)
  readonly campLife = new CampLife(() => this); // (a camp's gate come up to, its last foe slain, its chest)
  readonly welcome = new VillageWelcome(() => this); // (a village come into: its name told)
  readonly work = new Work(this); // (a job's shift, under way: jobs/work.ts)
  readonly lumber = new Lumber(this); // (trees chopped, felled for good: skills/lumber.ts)
  felled = (tree: Tree): boolean => this.lumber.felled(tree); // (the world's: a felled tree not there, nor in the way)

  // Dev cheats: movement speed factor (1 = normal); walking through
  // everything; god mode (enemies' blows don't hurt); every blow of the
  // hero's a kill; enemies standing still (enemiesFrozen, below).
  speedMultiplier = 1;
  noclip = false;
  godMode = false;
  oneHitKills = false;
  readonly moves: CombatMoves; // the hero's roll, guard and breath (combatMoves.ts)
  random: () => number = Math.random; // the rolls of chance in a fight: a dodge, a critical blow (tests set their own)

  // `size` defaults to the game's map; tests pass small worlds.
  // `world`: the seed's, made already (kept from an earlier visit: controller/storage/worldCache.ts), else made now.
  // A map past CLASSIC_MOST a side is streamed: made a region at a time round the hero (world/worldStreamer.ts; `regions`:
  // where its lands are made, a worker's in the game, else at once); else made whole (`world`: made already, or now).
  constructor(seed: number, size: MapSize = DEFAULT_MAP_SIZE, world?: World, regions?: RegionSource) {
    this.seed = seed;
    const streamed = !world && Math.max(size.width, size.depth) > CLASSIC_MOST;
    world ??= streamed ? undefined : generateWorld(seed, size);
    this.size = world?.size ?? size;
    const spawn = spawnOf(this.size);
    this.hero = freshHero(spawn); // (starts naked)
    this.moves = new CombatMoves(this.hero);
    // The world, made whole (a classic world: one region, peopled at once: world/liveWorld.ts), and its lists.
    this.world = world ? LiveWorld.classic(this, { rx: 0, rz: 0, x0: 0, z0: 0, ...world, tiles: TilePatch.fromMaps(world.size, 0, 0, world) }, world.size) : LiveWorld.streamed(this, size);
    this.streamer = world ? null : new WorldStreamer(this.world, regions ?? new SyncSource(seed, size));
    this.streamer?.prime(spawn); // (the regions round where the hero sets out, made before they're seen)
    ({ tiles: this.tiles, obstacles: this.obstacles, trails: this.trails, villages: this.villages, houses: this.houses, buildings: this.buildings, fields: this.fields } = this.world);
    ({ trees: this.trees, bushes: this.bushes, ruins: this.ruins, camps: this.camps, crypts: this.crypts, caves: this.caves, scenery: this.scenery } = this.world);
    ({ enemies: this.enemies, travellers: this.travellers, wildlife: this.wildlife, entrances: this.entrances, npcs: this.npcs } = this.world);
    this.hero.y = this.getGroundY(this.hero.x, this.hero.z);
    this.director = new EnemyDirector(this.enemies, this.hero, this.obstacles, this.size, (x, z) => this.getGroundY(x, z), (e) => foeStrikes(this, e));
    this.wild = new WildMoves(() => this.director.around(), this.hero, (x, z) => this.obstacles.isBlocked(x, z, 0.25), () => dungeonHooks(this)); // (a bear's slam and charge, a lynx's pounce)
    this.nearNpcs = new Nearby(this.npcs, (npc) => npc.village, ENEMY_ACTIVE_RADIUS + 40); // (+40: as far from their village as a villager goes, out to a field)
    this.nearWildlife = new Nearby(this.wildlife, (animal) => animal, ENEMY_ACTIVE_RADIUS);
    this.quests = new QuestBook(this);
  }

  // A foe slain by someone else (a guard on the road): the world's, for good.
  slay = (enemy: Enemy): void => void this.slain.add(enemy.id);
  get changes(): number { return this.world.changes; } // (regions peopled or let go so far: world/liveWorld.ts)
  isMade = (x: number, z: number): boolean => this.world.has(x, z); // (whether (x, z)'s region is made just now)
  doorAt = (n: number): Entrance | undefined => this.world.doorAt(n); // (a door known, by its own number: interiors.ts doorNumber)
  boardOf = (village: Village): number => this.world.villageNumber(village); // (a board's number: its village's own)
  villageOf = (board: number): Village | undefined => this.world.villageByNumber(board);
  get streamed(): boolean { return this.world.streamed; }
  get area(): Area { return wholeMap(this.size); } // (the part of the map its lists are of: all of it; a region's view's, its own: view/world/worldRegions.ts)

  // Height of whatever the hero would stand on at (x, z), in world units:
  // the tile's tier, plus the road/cobble paving where there is some.
  getGroundY(x: number, z: number): number {
    return this.world.groundY(x, z);
  }

  // Starts a blow (combatMoves.ts) unless one's under way, they're rolling or out of breath, or arms are put away
  // (an inn); whether it did. Turned to face the focused enemy if it's close by.
  startAttack(): boolean {
    if (this.seated || armsSheathed(this.inside) || !this.moves.startBlow()) return false;
    const focus = this.focused;
    if (focus && focus.state !== 'dead' && Math.hypot(focus.x - this.hero.x, focus.z - this.hero.z) <= FOCUS_TURN_RANGE) {
      this.hero.facing = Math.atan2(focus.x - this.hero.x, focus.z - this.hero.z);
    }
    return true;
  }

  // How far through the current attack the hero is, 0..1, or null.
  get attackProgress(): number | null {
    return this.moves.blowProgress ?? this.lumber.swing; // (chopping a tree: the axe swung)
  }

  // Moves the hero straight to (x, z), standing on the ground there
  // (outdoors, leaving any room they were in, a dungeon's too: its run over, its foes no more about).
  teleport(x: number, z: number): void {
    this.inside = null;
    this.below = null;
    this.yard = null;
    this.outdoors.seated = null;
    this.streamer?.prime({ x, z }); // (a streamed world's ground there made first, if it isn't)
    this.hero.x = x;
    this.hero.z = z;
    this.hero.y = this.getGroundY(x, z);
    this.hop = null;
  }

  // A streamed world's regions round (x, z) made now, if they aren't (a save's spot, a quest's board, before they're needed).
  makeAround = (x: number, z: number): void => this.streamer?.prime({ x, z });

  // Dev cheat: the flat grass yard, or back to where the hero was.
  toggleFurnitureYard(): string {
    this.hop = null;
    this.focusOn.focus(null);
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
    [tickBlessing(this.hero, dt), regenerate(this.hero, dt)]; // a well's, wearing off; health back, by their gear's
    this.streamer?.update(this.inside?.entrance ?? this.hero); // (a streamed world's regions round where they are on the map)
    checkOut(this, this.entrances); // (a room let at an inn, its time up)
    if (Math.hypot(dirX, dirZ) > 1e-6) this.hero.eating = null; // (up off the ground: a meal from the bag left)
    this.work.update(dt); // (at work: its shift on, or over once they've left)
    this.lumber.update(dt, Math.hypot(dirX, dirZ) > 1e-6); // (chopping: on, or stopped by walking off)
    if (Math.hypot(dirX, dirZ) > 1e-6 && !this.seated) makeWay(this.folk, this, dirX, dirZ, dt); // (folk stood in the way step aside)
    if (this.inside) {
      // The world outside stands still while the hero's indoors.
      if (!this.moves.roll) this.moveInside(dirX, dirZ, dt);
      this.moves.update(dt, this.push, this.below ? this.land : null); // (breath, the guard, a roll carrying them, a blow landing: none to hit but in a crypt)
      knockedOn(this, dt); // (knocked back by a blow, over a moment)
      if (this.below) [this.below.run.update(dt), this.scoopCoins(), this.keepFocus()]; // down in a crypt: its guards
      stepNpcs(this.folk, this, dt);
      liveOn(this, dt); // energy: spent, kept sat down, slept back (out of it: to the nearest inn's hearth)
      return;
    }
    if (this.yard) {
      stepYard(this.hero, this.yard.furniture, dirX, dirZ, HERO_SPEED * this.pace * dt);
      this.moves.update(dt, () => {}, null); // (a swing, played out at no one)
      return;
    }
    if (this.outdoors.seated && Math.hypot(dirX, dirZ) > 1e-6) this.sitOrStand(); // up off the bench to walk
    if (!this.outdoors.seated && !this.moves.roll) this.moveHorizontally(dirX, dirZ, dt);
    this.moves.update(dt, this.push, this.land);
    [this.director.update(dt), this.wild.update(dt), knockedOn(this, dt), this.campLife.update(this.hero, this.report), this.welcome.update(this.hero, this.report)]; // (the wild beasts' told moves; a blow's knock carrying the hero; the camps; the villages)
    this.travellers.update(dt, this.director.around()); // (the foes round the hero: guards fight only there)
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
  get folk(): readonly Npc[] { return this.nearNpcs.near(this.inside?.entrance ?? this.hero); }

  // The hero's blow landing, on whoever's in reach (fighting.ts).
  private readonly land = (): void => landBlow(this);

  private moveHorizontally(dirX: number, dirZ: number, dt: number): void {
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-6) return;
    const dist = HERO_SPEED * this.pace * dt;
    this.stepOut((dirX / len) * dist, (dirZ / len) * dist);
    this.hero.facing = Math.atan2(dirX, dirZ);
  }

  // A step outdoors (walkOutdoors.ts), what's in the way stopping it: the world's, foes, folk.
  private stepOut(dx: number, dz: number): void {
    stepOutdoors(this.hero, this.size, dx, dz, (x, z) => this.noclip || (!this.obstacles.isBlocked(x, z, HERO_RADIUS) && !bumpsEnemy(this.director.around(), this.hero, x, z, HERO_RADIUS) && !bumpsNpc(this.folk, null, this.hero, x, z, HERO_RADIUS)));
  }

  // How fast the hero goes, as a share of their speed: the cheat's, their load's, tired, guarded.
  private get pace(): number { return this.speedMultiplier * walkFactor(this.hero) * tiredPace(this.hero) * gearPace(this.hero) * (this.moves.guard !== null ? GUARD_PACE : 1); }
  // Where blows can be met (not sat, not in an inn with arms sheathed, not in the furniture yard).
  private get canFight(): boolean { return !this.seated && !armsSheathed(this.inside) && !this.yard; }

  // Shift: a roll along (dirX, dirZ) (combatMoves.ts); whether they did.
  roll(dirX: number, dirZ: number): boolean {
    return this.canFight && this.moves.startRoll(dirX, dirZ, this.hero.facing);
  }

  // Q held: the guard raised (lowered where blows aren't met).
  raiseGuard(on: boolean): void {
    this.moves.raise(on && this.canFight);
  }

  // An item, or `amount` copper in coins, put on the ground at (x, z).
  dropLoot = (item: BagItem, x: number, z: number): void => this.groundHere.drop(item, x, z);
  dropCoins = (amount: number, x: number, z: number): void => this.groundHere.dropCoins(amount, x, z);

  // The foes about: a dungeon's down there (dungeons/), else the world's; and the ground's loot here.
  get foes(): Enemy[] { return this.below?.run.foes ?? this.enemies; }
  get groundHere(): Ground { return this.below?.ground ?? this.ground; }
  // The dungeon the hero's down in, its foes run (dungeons/dungeonTypes.ts), or null; a crypt's (its arrows, its lord), a cave's (its webs, its brood mother).
  get dungeon(): DungeonRun | null { return this.below?.run ?? null; }
  get crypt(): CryptFoes | null { return this.below?.run instanceof CryptFoes ? this.below.run : null; }
  get cave(): CaveRun | null { return this.below?.run instanceof CaveRun ? this.below.run : null; }
  shove = (enemy: Enemy, dx: number, dz: number): void => void (this.below?.run.director ?? this.director).move(enemy, dx, dz);
  // The hero knocked (dx, dz) indoors (a draugr's cleave), never into the walls, still facing as they were.
  push = (dx: number, dz: number, facing = this.hero.facing): void => void [this.inside ? walkInside(this.inside, this.hero, dx, dz, Math.hypot(dx, dz), () => false) : this.stepOut(dx, dz), (this.hero.facing = facing)];
  report = (event: GameEvent): void => void this.events.push(event);
  slayGuard = (enemy: Enemy): void => void this.events.push(...(this.below?.run.slay(enemy, this.hero) ?? [])); // (its run's: what's told of it)
  // How much of a dungeon is cleared (0..1): its foes slain and its boss, of all of them (by its way in).
  clearedShare = (entrance: Entrance): number => dungeonShare(this.seed, entrance, this.cleared);
  // A dungeon's foes slain for good, by its key (a crypt's ruin's corner, a cave's mouth), by post.
  cleared = (key: string): Set<number> => this.cryptsCleared.get(key) ?? this.cryptsCleared.set(key, new Set()).get(key)!;

  // The loot nearest the hero within reach to pick up (outdoors), or null.
  get lootInReach(): GroundLoot | null {
    return (this.inside && !this.below) || this.yard ? null : this.groundHere.nearest(this.hero.x, this.hero.z);
  }

  // Takes one `item` out of the hero's bag and puts it on the ground just in
  // front of them; returns whether they had one.
  // `slot`: the bag's slot it's from (one off that very stack, if it's one of several).
  dropFromBag(item: BagItem, slot?: number): boolean {
    if (this.inside || this.yard) return false; // nothing's dropped indoors, or in the furniture yard
    if (!(slot === undefined ? takeFromBag(this.hero.bag, item) : takeFromSlot(this.hero, slot, bagRoom(this.hero)) === item)) return false;
    this.dropLoot(item, this.hero.x + Math.sin(this.hero.facing) * DROP_AHEAD, this.hero.z + Math.cos(this.hero.facing) * DROP_AHEAD);
    return true;
  }

  // Gear taken off into the bag, or worn from it (hero/wearing.ts); each returns whether it was.
  unequip = (slot: EquipSlot): boolean => takeOff(this.hero, slot);
  equipFromBag = (item: GearKey): boolean => putOn(this.hero, item);

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
    const entrance = this.work.shift ? null : this.doorInReach; // (at work: no leaving, the shift's to be ended at the notice board)
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
    const place = goesUnder(entrance) ? dungeonAt(entrance) : null; // (down into a dungeon: its own floor for what its foes leave)
    this.inside = { entrance, room, furniture, seated: null, ...(place && { walls: dungeonBlocks(this.seed, entrance), exitAt: () => this.below?.run.exitOpen ?? null }) };
    if (place) this.events.push({ kind: 'arrive', name: place.name, level: place.level }); // (its name and level, as the hero comes down)
    this.below = place && { key: place.key, run: dungeonRun(this.seed, entrance, this.cleared(place.key), this.hero, dungeonHooks(this)), ground: new Ground(() => 0) };
    this.outdoors.seated = null;
    if (entrance.type === 'inn') this.lastInn = entrance; // to wake in, after a fall
    this.focusOn.focus(null);
    this.hop = null;
    Object.assign(this.hero, { x: room.door, z: room.depth - 1, y: 0, facing: Math.PI }); // into the room (-Z)
  }

  // Indoors: the hero walks the room's floor (getting up first if seated);
  // out only through the door, with E (useDoor).
  private moveInside(dirX: number, dirZ: number, dt: number): void {
    const inside = this.inside!;
    if (Math.hypot(dirX, dirZ) < 1e-6) return;
    standUp(inside, this.hero);
    const bumps = (x: number, z: number, r: number) => bumpsNpc(this.folk, inside.entrance, this.hero, x, z, r) || (!!this.below && bumpsEnemy(this.below.run.foes, this.hero, x, z, r));
    walkInside(inside, this.hero, dirX, dirZ, INDOOR_HERO_SPEED * this.pace * dt, bumps); // (out only with E at the door)
  }

  // Where the hero sits (indoors, or on a bench outdoors), or null standing.
  get seated(): Seated {
    return (this.inside ?? this.outdoors).seated;
  }

  // The free seat the hero could sit on right now (in the room, or a bench's), or null (seated).
  get seatInReach(): Seat | null {
    if (this.yard) return null;
    const taken = (piece: Seat['piece']) => this.folk.some((n) => n.seat?.piece === piece); // (those round about: the world's every villager gone through for each seat, each frame, cost a frame indoors)
    if (this.inside) return seatInReach(this.inside, this.hero, taken);
    return this.outdoors.seated ? null : benchSeatInReach(squareBenches(this), this.hero, (seat) => taken(seat.piece)); // the squares' benches
  }

  // Sits down on the seat in reach, or gets up if seated; returns whether either happened.
  sitOrStand(): boolean {
    if (this.work.shift && !this.seated) return false; // (at work: no sitting down)
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
  drinkPotion = (item: BagItem): boolean => drinkPotion(this.hero, item);

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
    if (!canCarry(this.hero, loot.item)) return (this.report({ kind: 'poor', text: 'Your bag is full' }), null); // (left where it lies)
    this.groundHere.take(loot);
    addToBag(this.hero.bag, loot.item);
    this.quests.onPickUp(loot.item);
    return loot.item;
  }

  // The foe the hero's focused on; focusing a living one by id, null (or a dead one) letting go (hero/focus.ts).
  get focused(): Enemy | null { return this.focusOn.focused; }
  focus = (id: number | null): void => this.focusOn.focus(id);

  // Turns the focus to the next foe in sight, nearest first (Tab), or back (Shift+Tab: hero/focus.ts).
  cycleFocus = (back = false): void => turnFocus(this, (foe) => (this.below?.run.director ?? this.director).inView(this.hero, foe), back);

  // Drops the focus the moment its enemy dies (so the next to strike takes it), or once it's gone or far off (hero/focus.ts).
  private keepFocus = (): void => this.focusOn.keep(this.hero);

  // Out of health: fallen, waking at an inn (hero/setbacks.ts).
  fall = (): void => fall(this);
}
