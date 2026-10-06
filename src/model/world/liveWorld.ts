// The world as it is while it's played: its tiles, what blocks the way, and everything in it, in lists the rest of the
// game reads (and the same lists all game long: changed in place). A classic world is one region, made whole with the
// game; a streamed world's regions come and go as the hero walks (worldStreamer.ts), each made from its land
// (worldgen/regions.ts) and peopled here, in the order a classic world always was (so it's as it ever was):
// - what stays known once a region's been made, for the rest of the game (light, and what much else holds on to:
//   villages, their houses and buildings and fields, roads, ruins, camps, crypts and caves, every door), made again
//   from the same land the next time it's near and the first made kept (the same objects: an inn's let room, a shop,
//   a board's quests keep to them);
// - what's let go with it (its tiles, what blocks its ground, trees, bushes, scenery, foes, animals, villagers,
//   travellers), made afresh each time: the slain kept slain, the hurt and wandered where they were.

import type { Building, Bush, Enemy, Field, Hero, House, Tree, Village } from '../types';
import { spawnOf, toCellX, toCellZ, type Area, type MapSize } from '../map/grid';
import { ROAD_SURFACE_HEIGHT, TILE_HEIGHT } from '../constants';
import { onPaving } from '../map/roads';
import { Obstacles, type ObstaclePage } from '../map/obstacles';
import { RegionTiles, TilePatch, type Tiles } from '../map/tiles';
import { addWorldObstacles } from '../map/blockers';
import { solidCells } from '../worldgen/world';
import { REGION, type RegionLand } from '../worldgen/regions';
import type { Road } from '../worldgen/roads';
import { addRuinObstacles, type Ruin } from '../ruins/ruins';
import { addCampObstacles, type Camp } from '../camps/camps';
import { addCryptObstacles, placeCrypts, registerCrypts, type Crypt } from '../crypts/crypts';
import { addCaveObstacles, placeCaves, registerCaves, type Cave } from '../caves/caves';
import { spawnEnemies } from '../enemies/enemies';
import { regionFoeId } from '../enemies/foeIds';
import { addSceneryObstacles, placeScenery, type Scenery } from '../scenery/scenery';
import { Travellers } from '../travellers/travellers';
import { TravellerCrowd } from '../travellers/travellerCrowd';
import { spawnWildlife, type Wildlife } from '../wildlife/wildlife';
import { doorNumber, entrancesOf, type Entrance } from '../interiors/interiors';
import { spawnNpcs, type Npc } from '../npcs/npcs';
import { villageNumber } from '../villages/villageNumber';

// What the world's life needs of the game: whose world, the hero (where they are, to walk among), the ground's height
// where they stand, the foes slain for good, and the trees felled for good.
export interface WorldHost {
  readonly seed: number;
  readonly hero: Hero;
  readonly slain: ReadonlySet<number>;
  felled?(tree: Tree): boolean; // (skills/lumber.ts)
  slay(enemy: Enemy): void; // a foe slain by someone else (a guard on the road)
}

const REGION_IDS = 2 ** 20; // ids in each region's block, of villagers, animals and travellers

// What stays known of a region once made.
export interface Known {
  trails: Array<Array<[number, number]>>;
  roads: Road[];
  villages: Village[];
  houses: House[];
  buildings: Building[];
  fields: Field[];
  ruins: Ruin[];
  camps: Camp[];
  crypts: Crypt[];
  caves: Cave[];
  entrances: Entrance[];
}

// What's let go with it.
export interface Alive {
  trees: Tree[];
  bushes: Bush[];
  scenery: Scenery[];
  enemies: Enemy[];
  wildlife: Wildlife[];
  npcs: Npc[];
}

const KNOWN = ['trails', 'villages', 'houses', 'buildings', 'fields', 'ruins', 'camps', 'crypts', 'caves', 'entrances'] as const;
const ALIVE = ['trees', 'bushes', 'scenery', 'enemies', 'wildlife', 'npcs'] as const;

// A region made and peopled (off the game's thread: LiveWorld.build), to be adopted by the game's world.
export interface RegionBuilt {
  rx: number;
  rz: number;
  tiles: Pick<TilePatch, 'x0' | 'z0' | 'width' | 'depth' | 'heights' | 'lakes' | 'surfaces'>;
  page: ObstaclePage;
  halves: ReadonlyArray<readonly [number, number, number, number]>;
  known: Known;
  alive: Alive;
}

export class LiveWorld {
  readonly tiles: Tiles;
  readonly obstacles: Obstacles;
  readonly trails: Array<Array<[number, number]>> = [];
  readonly villages: Village[] = [];
  readonly houses: House[] = [];
  readonly buildings: Building[] = [];
  readonly fields: Field[] = [];
  readonly ruins: Ruin[] = [];
  readonly camps: Camp[] = [];
  readonly crypts: Crypt[] = [];
  readonly caves: Cave[] = [];
  readonly entrances: Entrance[] = []; // every door that can be gone through (its buildings', then its dungeons' ways in, region by region)
  readonly trees: Tree[] = [];
  readonly bushes: Bush[] = [];
  readonly scenery: Scenery[] = [];
  readonly enemies: Enemy[] = [];
  readonly wildlife: Wildlife[] = [];
  readonly npcs: Npc[] = [];
  readonly travellers = new TravellerCrowd();
  private readonly known = new Map<number, Known>(); // by region (its index: rx * regions across z + rz)
  private readonly alive = new Map<number, Alive>();
  private readonly remembered = new Map<number, { x: number; z: number; hp: number }>(); // foes hurt or wandered when their region was let go
  private readonly doors = new Map<number, Entrance>(); // every door known, by its own number (interiors.ts doorNumber)
  private readonly villageNumbers = new Map<Village, number>(); // every village known, by its own number (villageNumber)
  private readonly villagesByNumber = new Map<number, Village>();
  private readonly across: number; // regions across z
  changes = 0; // regions peopled or let go, so far (what's worked out from the world's lists, worked out again past it)

  private constructor(
    private readonly host: WorldHost,
    readonly size: MapSize,
    readonly regionSize: number,
    tiles: Tiles,
  ) {
    this.tiles = tiles;
    this.across = Math.ceil(size.depth / regionSize);
    this.obstacles = new Obstacles(size, tiles, new Set(), regionSize);
  }

  // A classic world: made whole, one region, peopled at once.
  static classic(host: WorldHost, land: Omit<RegionLand, 'tiles'> & { tiles: TilePatch }, size: MapSize): LiveWorld {
    const world = new LiveWorld(host, size, Math.max(size.width, size.depth), land.tiles);
    world.people(land, true);
    return world;
  }

  // A streamed world: its regions made as they're needed (load).
  static streamed(host: WorldHost, size: MapSize): LiveWorld {
    return new LiveWorld(host, size, REGION, new RegionTiles(size, REGION));
  }

  get streamed(): boolean {
    return this.tiles instanceof RegionTiles;
  }

  regionIndex(rx: number, rz: number): number {
    return rx * this.across + rz;
  }

  // A region's (rx, rz), from its index.
  regionAt(index: number): [number, number] {
    return [Math.floor(index / this.across), index % this.across];
  }

  isLoaded(rx: number, rz: number): boolean {
    return this.alive.has(this.regionIndex(rx, rz));
  }

  // The regions made just now, by index.
  loaded(): number[] {
    return [...this.alive.keys()];
  }

  get seed(): number {
    return this.host.seed;
  }

  // The door of number `n` (interiors.ts doorNumber), if it's known (its region made, this game).
  doorAt(n: number): Entrance | undefined {
    return this.doors.get(n);
  }

  // A village's own number (its notice board's: quests are by it): a classic world's its place among them; a streamed
  // world's where it stands (the same however its regions are made). And the village of one, if known this game.
  villageNumber(village: Village): number {
    return this.villageNumbers.get(village) ?? -1;
  }

  villageByNumber(n: number): Village | undefined {
    return this.villagesByNumber.get(n);
  }

  // A foe as it was (a save's, its region not made yet): so once it is.
  remember(id: number, was: { x: number; z: number; hp: number }): void {
    this.remembered.set(id, { x: was.x, z: was.z, hp: was.hp });
  }

  // What's in region `index` just now (what's known of it and what lives there), and its part of the map; null if it
  // isn't made (the view draws a streamed world region by region: view/world/worldRegions.ts).
  contents(index: number): (Known & Alive & { area: Area }) | null {
    const [known, alive] = [this.known.get(index), this.alive.get(index)];
    if (!known || !alive) return null;
    const [rx, rz] = this.regionAt(index);
    const [x0, z0] = [rx * this.regionSize, rz * this.regionSize];
    return { ...known, ...alive, area: { x0, z0, x1: Math.min(this.size.width, x0 + this.regionSize), z1: Math.min(this.size.depth, z0 + this.regionSize) } };
  }

  // A region of a streamed world of `seed` made and peopled (off the game's thread, where it can be: a worker's), for
  // the game's own world to adopt: everything in it made as the game would (a world of its own, that region alone:
  // nothing of a region ever reaches past it), handed over as it is.
  static build(seed: number, size: MapSize, land: RegionLand): RegionBuilt {
    const spawn = spawnOf(size);
    const world = new LiveWorld({ seed, hero: { ...spawn } as Hero, slain: new Set(), slay: () => {} }, size, REGION, new RegionTiles(size, REGION));
    (world.tiles as RegionTiles).add(land.tiles);
    world.obstacles.open(land.rx, land.rz);
    world.people(land, false, false);
    const index = world.regionIndex(land.rx, land.rz);
    const { x0, z0, width, depth, heights, lakes, surfaces } = land.tiles;
    return { rx: land.rx, rz: land.rz, tiles: { x0, z0, width, depth, heights, lakes, surfaces }, ...world.obstacles.pageOfRegion(land.rx, land.rz)!, known: world.known.get(index)!, alive: world.alive.get(index)! };
  }

  // A streamed world's region, made (build), put in: its tiles and what blocks its ground, everything in it; a region
  // made before, what's known of it kept (the same villages, doors and all: those just made in their place).
  adopt(built: RegionBuilt): void {
    const { rx, rz } = built;
    const index = this.regionIndex(rx, rz);
    if (this.alive.has(index)) return;
    (this.tiles as RegionTiles).add(TilePatch.of(this.size, built.tiles));
    this.obstacles.install(rx, rz, built.page, built.halves);
    const was = this.known.get(index);
    const known = was ?? built.known;
    if (was) relink(built, was);
    else this.learn(index, known);
    this.live(index, { ...built.alive, enemies: this.standing(built.alive.enemies) }, this.travellersOf(index, known));
  }

  // What's known of region `index`, from its first making: kept, its lists added to the world's, its crypts and caves
  // registered, its doors and villages numbered.
  private learn(index: number, known: Known): void {
    registerCrypts(known.crypts);
    registerCaves(known.caves);
    this.known.set(index, known);
    for (const k of KNOWN) appendAll(this[k] as unknown[], known[k]);
    for (const door of known.entrances) this.doors.set(doorNumber(door), door);
    for (const v of known.villages) {
      const n = this.streamed ? villageNumber(v, this.size.depth) : this.villageNumbers.size;
      this.villageNumbers.set(v, n);
      this.villagesByNumber.set(n, v);
    }
  }

  // What lives on region `index` (and its band of travellers), added to the world's.
  private live(index: number, alive: Alive, travellers: Travellers | null): void {
    const felled = alive.trees.filter((t) => this.host.felled?.(t)); // (gone for good: not there, nor in the way)
    if (felled.length > 0) {
      alive = { ...alive, trees: alive.trees.filter((t) => !felled.includes(t)) };
      for (const t of felled) this.obstacles.clearProp(t.x, t.z);
    }
    this.alive.set(index, alive);
    for (const k of ALIVE) appendAll(this[k] as unknown[], alive[k]);
    if (travellers) this.travellers.add(index, travellers);
    this.changes++;
  }

  // A region's foes as they stand: the slain gone for good, the hurt and wandered where they were left.
  private standing(enemies: readonly Enemy[]): Enemy[] {
    const left = enemies.filter((e) => !this.host.slain.has(e.id));
    for (const e of left) {
      const was = this.remembered.get(e.id);
      if (was) Object.assign(e, { x: was.x, z: was.z, hp: Math.min(e.maxHp, was.hp) });
      e.y = this.groundY(e.x, e.z);
    }
    return left;
  }

  // A region's band on its roads.
  private travellersOf(index: number, known: Known): Travellers {
    const ids = this.streamed ? index * REGION_IDS : 0;
    const groundY = (x: number, z: number) => this.groundY(x, z);
    return new Travellers(this.streamed ? this.host.seed + index : this.host.seed, known.roads, known.villages.length, spawnOf(this.size), this.host.hero, groundY, (e) => this.host.slay(e), ids);
  }

  // A streamed world's region let go: its tiles, its ground's blocks, and all that lives on it (the foes hurt or
  // wandered remembered as they were).
  unload(rx: number, rz: number): void {
    const index = this.regionIndex(rx, rz);
    const alive = this.alive.get(index);
    if (!alive) return;
    this.alive.delete(index);
    for (const e of alive.enemies) if (e.state !== 'dead' && (e.hp < e.maxHp || Math.hypot(e.x - e.homeX, e.z - e.homeZ) > 0.05)) this.remembered.set(e.id, { x: e.x, z: e.z, hp: e.hp });
    for (const k of ALIVE) removeAll(this[k] as unknown[], alive[k]);
    this.travellers.remove(index);
    this.changes++;
    this.obstacles.close(rx, rz);
    (this.tiles as RegionTiles).remove(rx, rz);
  }

  // Everything on region `land`, in the order a classic world's always was made (its ids, from 0 in a classic world,
  // from its region's block in a streamed one). Only ever on a world just made (a classic one; a worker's, for one
  // region: build): a region made again is linked to what's known of it as it's adopted.
  private people(land: Omit<RegionLand, 'tiles'>, classic: boolean, withTravellers = true): void {
    const index = this.regionIndex(land.rx, land.rz);
    const { seed } = this.host;
    const { size, tiles, obstacles } = this;
    const area: Area = classic ? { x0: 0, z0: 0, x1: size.width, z1: size.depth } : { x0: land.x0, z0: land.z0, x1: Math.min(size.width, land.x0 + this.regionSize), z1: Math.min(size.depth, land.z0 + this.regionSize) };
    const spawn = spawnOf(size);
    const isOpenTile = (x: number, z: number) => obstacles.isOpenTile(x, z);
    const { trails, roads, villages, houses, buildings, fields, ruins, camps } = land;
    for (const key of solidCells({ villages, houses, buildings })) {
      const [x, z] = key.split(',').map(Number);
      obstacles.addSolid(x, z);
    }
    addWorldObstacles(obstacles, { size, tiles, villages, houses, buildings, fields, seed, trees: land.trees, bushes: land.bushes });
    addRuinObstacles(obstacles, ruins); // (before the foes, to stand clear of them)
    addCampObstacles(obstacles, camps);
    const crypts = placeCrypts({ seed, size, ruins, tiles, isOpenTile }); // a stairway down in each ruin (its tile blocked: down with E)
    addCryptObstacles(obstacles, crypts);
    const caves = placeCaves({ seed, size, tiles, villages, ruins, camps, isOpenTile }, area); // a mouth in a hillside in each stretch of the wilds that has one
    addCaveObstacles(obstacles, caves);
    const ids = classic ? 0 : index * REGION_IDS;
    const enemies = this.standing(spawnEnemies({ seed, size, villages, hero: spawn, camps, ruins, isOpenTile }, area, classic ? 0 : regionFoeId(index)));
    const scenery = placeScenery({ seed, size, tiles, villages, ruins, camps, hero: spawn, enemies, isOpenTile }, area); // rocks and landmarks in the wilds (clear of where the foes stand)
    addSceneryObstacles(obstacles, scenery);
    const isBlocked = (x: number, z: number, r: number) => obstacles.isBlocked(x, z, r);
    const getGroundY = (x: number, z: number) => this.groundY(x, z);
    const wildlife = spawnWildlife({ seed, size, tiles, villages, camps, trees: land.trees, houses, buildings, isOpenTile, isBlocked, getGroundY }, area, ids);
    const doors = entrancesOf(houses, buildings);
    const npcs = spawnNpcs(seed, doors, villages, fields, ids); // the villagers, one to a house
    const entrances = [...doors, ...crypts.map((c) => c.entrance), ...caves.map((c) => c.entrance)]; // (the dungeons' ways in, after the buildings' doors: they keep their places)
    const known: Known = { trails, roads, villages, houses, buildings, fields, ruins, camps, crypts, caves, entrances };
    this.learn(index, known);
    this.live(index, { trees: land.trees, bushes: land.bushes, scenery, enemies, wildlife, npcs }, withTravellers ? this.travellersOf(index, known) : null);
  }

  // Height of whatever stands at (x, z) would stand on, in world units: its tile's tier, and the paving of a road or a
  // square where there's some.
  groundY(x: number, z: number): number {
    const tile = this.tiles.height(toCellX(this.size, x), toCellZ(this.size, z)) * TILE_HEIGHT;
    return onPaving(this.tiles, x, z) ? tile + ROAD_SURFACE_HEIGHT : tile;
  }

  // Whether (x, z) is on a region made just now (a classic world: on the map).
  has(x: number, z: number): boolean {
    return this.tiles.has(Math.floor(x), Math.floor(z));
  }
}

// `items` added at the end of `list` (one by one: a region's trees are tens of thousands, too many to spread).
function appendAll<T>(list: T[], items: readonly T[]): void {
  for (const item of items) list.push(item);
}

// `gone` taken out of `list`, the rest kept in their order, in place. A region's were added all together (appendAll),
// and stay so: found where they start, cut out at once; else (some gone since: foes' bodies cleared) one pass.
function removeAll<T>(list: T[], gone: readonly T[]): void {
  if (gone.length === 0) return;
  const start = list.indexOf(gone[0]);
  if (start >= 0 && list[start + gone.length - 1] === gone[gone.length - 1]) {
    list.splice(start, gone.length);
    return;
  }
  const out = new Set(gone);
  let kept = 0;
  for (const item of list) if (!out.has(item)) list[kept++] = item;
  list.length = kept;
}

// A region made again (built afresh) linked to what's known of it from its first making: its villagers' homes,
// villages and fields the known ones (made the same, in the same order: the same by index).
function relink(built: RegionBuilt, known: Known): void {
  const same = <T extends object>(made: readonly T[], kept: readonly T[]) => new Map<T, T>(made.map((m, i) => [m, kept[i]]));
  const [doors, villages, fields] = [same(built.known.entrances, known.entrances), same(built.known.villages, known.villages), same(built.known.fields, known.fields)];
  for (const npc of built.alive.npcs) {
    npc.home = doors.get(npc.home) ?? npc.home;
    npc.inn = npc.inn && (doors.get(npc.inn) ?? npc.inn);
    npc.where = npc.where && (doors.get(npc.where) ?? npc.where);
    npc.village = villages.get(npc.village) ?? npc.village;
    if (npc.field) npc.field = fields.get(npc.field) ?? npc.field;
  }
}
