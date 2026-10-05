// Saving a game: the hero (who they are, what they carry and wear, how far
// they've come, where they stand, in or out of doors) and the world as it's
// been changed (foes slain or hurt or moved, loot and coins lying about,
// where each villager is in their day), as plain data to store and read
// back. What the seed makes (the land, who lives where) isn't saved: it's
// made again the same.
//
// A save is read defensively: it comes from outside (the browser's
// storage), so anything missing or malformed means no save at all.

import { isGear, slotOfGear } from './human/items/gear';
import { readActionBar } from './hero/actionBar';
import { readSockets } from './hero/bagSlots';
import type { Travellers } from './travellers/travellers';
import type { GameModel } from './GameModel';
import type { BagItem } from './hero/bag';
import { BUYBACK } from './shops/shopStock';
import { POINTS_PER_LEVEL, untrained } from './hero/training';
import { STATS, type Stat } from './hero/statKinds';
import type { Equipment } from './human/equipment';
import { LOOT } from './loot/loot';
import { maxEnergyOf, maxHpOf } from './hero/attributes';
import type { BodyLook } from './human/humanoid';
import { layoutOf } from './interiors/indoors';
import { openDoorsAt, setOpenDoors, upstairsInside } from './interiors/upstairs';
import { doorNumber, doorPlace, type Entrance } from './interiors/interiors';
import { PEDLAR_KEY } from './travellers/travellers';
import { HERBALIST_KEY } from './herbalist/herbalistShop';
import { letUntil, setLet } from './inn/roomLetting';
import type { Shop } from './inn/tavernShop';
import { BLESSINGS, BLESSING_TIME, WEARY_TIME, type Blessing } from './hero/blessing';
import type { QuestBook } from './quests/questBook';
import { spawnEnemies } from './enemies/enemies';
import { spawnOf, type MapSize } from './map/grid';
import { isWorldFoe } from './enemies/foeIds';

const VERSION = 2; // (2: the world's size kept, its doors by their own numbers; 1, still read: a classic world's, its doors by their place in its list)

export interface SaveData {
  version: number;
  seed: number;
  size?: MapSize; // the world's (a classic world's 2048 a side; a streamed one's 16384): played on as it was
  hero: {
    name: string;
    look: BodyLook;
    equipment: Equipment;
    bag: Partial<Record<BagItem, number>>;
    bagOrder?: Array<BagItem | null>; // where each thing sits in it
    bags?: Array<string | null>; // the bags fitted to it (hero/bagSlots.ts)
    actionBar?: Array<string | null>; // its action bar's shortcuts (hero/actionBar.ts)
    bagCounts?: number[]; // how many in each slot (older saves: none, packed)
    money: number;
    level: number;
    xp: number;
    statPoints?: number; // gained with levels, not yet spent (older saves: none kept, so every level's given back)
    trained?: Partial<Record<Stat, number>>; // spent on each stat
    hp: number;
    energy?: number; // spent through the day, slept back
    x: number;
    z: number;
    facing: number;
    inside: number | null; // the building they're in, by its door's number (interiors.ts doorNumber; a version 1 save's: its index among the world's)
    upstairs?: boolean; // on its upper floor
    lastInn?: number | null; // the last inn they entered (where they wake after a fall)
    blessings?: Blessing[]; // a well's, and how long it has left
  };
  enemies: { gone: number[]; changed: Array<{ id: number; x: number; z: number; hp: number }> };
  foes?: string; // the world's foes as the seed spawns them (foesOf): the enemies' ids are only good in a world with the same
  loot: Array<{ item: BagItem; x: number; z: number }>;
  coins: Array<{ amount: number; x: number; z: number }>;
  npcs: Array<{ id: number; inside: number | null; x: number; z: number; stop: number }>;
  shops?: Array<{ inn: number } & Shop>; // each inn's barmaid's purse and wares
  minutes?: number; // the game's clock
  doors?: Array<{ inn: number; open: string[] }>; // the doors left open upstairs, by building
  lets?: Array<{ inn: number; until: number }>;
  travellers?: ReturnType<Travellers['save']>; // those on the roads: where each is, which way, their health; those to set out again // the rooms let at the inns, till when (game minutes)
  fullWalls?: boolean; // the option: rooms' inner walls full height
  crypts?: Array<{ crypt: string; slain: number[] }>; // each dungeon's foes slain for good (by its key: a crypt's ruin's corner, a cave's mouth, 'cave:'; by post)
  quests?: ReturnType<QuestBook['save']>; // the quests handed in, and those taken
}

const MAX_BAG_SLOTS = 256; // a saved bag order longer than any bag is cut there
const round = (v: number) => Math.round(v * 100) / 100; // to a hundredth of a tile: plenty, and a smaller save

// The game as it stands, to save.
export function snapshot(model: GameModel): SaveData {
  const { hero } = model;
  const door = (entrance: GameModel['entrances'][number] | null | undefined) => (entrance ? doorNumber(entrance) : null);
  const indoors = model.yard ? model.yard.back.inside : model.inside; // a save from the yard keeps where they came from
  const spot = model.yard?.back;
  return {
    version: VERSION,
    seed: model.seed,
    size: { ...model.size },
    hero: {
      name: hero.name,
      look: { ...hero.look },
      equipment: { ...hero.equipment },
      bag: { ...hero.bag },
      bagOrder: [...hero.bagOrder],
      bagCounts: [...hero.bagCounts],
      bags: [...hero.bags],
      actionBar: [...hero.actionBar],
      money: hero.money,
      level: hero.level,
      xp: hero.xp,
      statPoints: hero.statPoints,
      trained: { ...hero.trained },
      hp: hero.hp,
      energy: Math.round(hero.energy),
      x: spot?.x ?? model.seated?.from.x ?? hero.x,
      z: spot?.z ?? model.seated?.from.z ?? hero.z,
      facing: spot?.facing ?? hero.facing,
      inside: door(indoors?.below ?? indoors?.entrance),
      upstairs: !!indoors?.below,
      lastInn: door(model.lastInn),
      blessings: (hero.blessings ?? []).map((b) => ({ ...b })),
    },
    // Which foes the world has is the seed's: what's saved is who's been slain, and who's hurt or wandered.
    foes: foesOf(model),
    enemies: {
      gone: [...model.slain],
      changed: model.enemies
        .filter((e) => isWorldFoe(e.id) && e.state !== 'dead' && (e.hp < e.maxHp || Math.hypot(e.x - e.homeX, e.z - e.homeZ) > 0.05))
        .map((e) => ({ id: e.id, x: round(e.x), z: round(e.z), hp: e.hp })),
    },
    loot: model.loot.map(({ item, x, z }) => ({ item, x, z })),
    coins: model.coins.map(({ amount, x, z }) => ({ amount, x, z })),
    // Only villagers who've done something (the rest are as the seed made them, at home).
    npcs: model.npcs
      .filter((n) => n.where !== n.home || n.x !== 0 || n.z !== 0)
      .map((n) => ({ id: n.id, inside: door(n.where), x: round(n.stood?.x ?? n.x), z: round(n.stood?.z ?? n.z), stop: n.stop })),
    shops: [...model.shops].map(([inn, shop]) => ({ inn, money: shop.money, stock: { ...shop.stock }, restockedAt: shop.restockedAt, buyback: (shop.buyback ?? []).map((s) => ({ ...s })) })),
    quests: model.quests.save(),
    minutes: Math.floor(model.minutes),
    fullWalls: model.fullWalls,
    crypts: [...model.cryptsCleared].map(([crypt, slain]) => ({ crypt, slain: [...slain] })), // each crypt's guards slain for good
    doors: model.entrances.map((e) => ({ inn: doorNumber(e), open: openDoorsAt(e) })).filter((d) => d.open.length > 0),
    travellers: model.travellers.save(),
    lets: model.entrances.flatMap((e) => (letUntil(e) === null ? [] : [{ inn: doorNumber(e), until: letUntil(e)! }])),
  };
}

// Reads a save (from storage) for this model's world: the data, or null if
// it isn't one (malformed, another version, another world).
export function parseSave(raw: string | null, seed: number): SaveData | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SaveData;
    const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
    const h = data?.hero;
    if ((data?.version !== VERSION && data?.version !== 1) || data.seed !== seed || !h || typeof h.name !== 'string' || !h.look || ![h.money, h.level, h.xp, h.hp].every(num)) return null; // (a lost position, kept anyway: restore puts them somewhere sound)
    if (!Array.isArray(data.enemies?.gone) || !Array.isArray(data.enemies?.changed) || !Array.isArray(data.loot) || !Array.isArray(data.coins) || !Array.isArray(data.npcs)) return null;
    return data;
  } catch {
    return null;
  }
}

// Puts a saved game back into a freshly made model of the same world.
export function restore(model: GameModel, data: SaveData): void {
  const { hero } = model;
  const saved = data.hero;
  // A door the save names: by its number (a version 1 save's: by its place among the world's doors, a classic world's).
  const doorAt = (ref: number): Entrance | null => (data.version === 1 ? model.entrances[ref] : model.doorAt(ref)) ?? null;
  // A streamed world's: what the save names made first (the ground where they are, their last inn's, the villages of
  // the quests they've taken), its regions as they'd have been.
  if (model.streamed) {
    const places = [saved.inside !== null ? doorPlace(saved.inside) : { x: saved.x, z: saved.z }, ...(typeof saved.lastInn === 'number' ? [doorPlace(saved.lastInn)] : [])];
    for (const { key } of Array.isArray(data.quests?.taken) ? data.quests.taken : []) {
      const board = Number(String(key).split(':')[0]);
      if (Number.isInteger(board) && board >= 0) places.push({ x: Math.floor(board / model.size.depth), z: board % model.size.depth }); // (a board's number: its village's place)
    }
    for (const { x, z } of places) if (Number.isFinite(x) && Number.isFinite(z)) model.makeAround(x, z);
  }
  // Only things the game still knows (a save may be older than a change to
  // them), worn in the slot they go in, carried in whole numbers.
  const known = (item: string): item is BagItem => item in LOOT || isGear(item); // (gear plain, or as found: its level and rarity)
  const bag = Object.fromEntries(Object.entries(saved.bag ?? {}).filter(([item, n]) => known(item) && Number.isInteger(n) && (n as number) > 0));
  const equipment = Object.fromEntries(Object.entries(saved.equipment ?? {}).filter(([slot, item]) => typeof item === 'string' && isGear(item) && slotOfGear(item) === slot));
  Object.assign(hero, {
    name: saved.name,
    look: { ...saved.look },
    equipment,
    bag,
    bagOrder: Array.isArray(saved.bagOrder) ? saved.bagOrder.slice(0, MAX_BAG_SLOTS).map((item) => (typeof item === 'string' && known(item) ? item : null)) : [],
    bags: readSockets(saved.bags), // (older saves: none fitted)
    actionBar: readActionBar(saved.actionBar), // (older saves: all empty)
    bagCounts: Array.isArray(saved.bagCounts) ? saved.bagCounts.slice(0, MAX_BAG_SLOTS).map((n) => (Number.isInteger(n) && n > 0 ? n : 0)) : [],
    money: Math.max(0, Math.floor(saved.money)),
    level: Math.max(1, Math.floor(saved.level)),
    xp: Math.max(0, saved.xp),
    ...pointsOf(saved),
    facing: Number.isFinite(saved.facing) ? saved.facing : 0,
    blessings: (Array.isArray(saved.blessings) ? saved.blessings : [])
      .filter((b) => b && b.kind in BLESSINGS && typeof b.left === 'number' && b.left > 0)
      .map((b) => ({ kind: b.kind, left: Math.min(b.kind === 'weary' ? WEARY_TIME : BLESSING_TIME, b.left) })),
  });
  hero.hp = Math.min(maxHpOf(hero), Math.max(1, saved.hp));
  if (typeof saved.energy === 'number' && Number.isFinite(saved.energy)) hero.energy = Math.min(maxEnergyOf(hero), Math.max(0, saved.energy));
  model.lastInn = typeof saved.lastInn === 'number' ? doorAt(saved.lastInn) : null;
  model.fullWalls = data.fullWalls === true;
  for (const { inn, open } of data.doors ?? []) {
    const building = typeof inn === 'number' ? doorAt(inn) : null;
    if (building && Array.isArray(open)) setOpenDoors(building, open.filter((k) => typeof k === 'string'));
  }
  for (const { inn, until } of Array.isArray(data.lets) ? data.lets : []) {
    const building = typeof inn === 'number' ? doorAt(inn) : null;
    if (building && typeof until === 'number' && Number.isFinite(until)) setLet(building, until); // (before the floor upstairs is made: its door unlocked)
  }
  for (const { crypt, slain } of Array.isArray(data.crypts) ? data.crypts : []) {
    if (typeof crypt === 'string' && Array.isArray(slain)) for (const post of slain) if (Number.isInteger(post)) model.cleared(crypt).add(post);
  }
  // Where they were: a position saved lost (not a number: never written so now, but an older save's may be) costs only
  // the spot, never the save: the hero's put somewhere sound instead.
  const placed = Number.isFinite(saved.x) && Number.isFinite(saved.z);
  const building = saved.inside === null ? null : doorAt(saved.inside);
  if (building) {
    const { room, furniture } = layoutOf(model.seed, building);
    const stairs = furniture.find((f) => f.kind === 'stairs');
    if (saved.upstairs && stairs) model.inside = upstairsInside(building, room, stairs, model.seed, model.fullWalls); // on the floor above
    else model.enterRoom(building); // (as going in: a crypt's walls with it)
    if (placed) Object.assign(hero, { x: saved.x, z: saved.z, y: 0 }); // (lost: at the door, as they came in)
  } else if (placed) {
    model.teleport(Math.min(model.size.width - 1, Math.max(0, saved.x)), Math.min(model.size.depth - 1, Math.max(0, saved.z)));
  } // (lost outdoors: where they set out)
  // Foes: the slain gone, the hurt and the wandered where they were; but only
  // if the world's foes are those the save knew (the game since changed how
  // they're spawned, or an older save: they're left as the seed makes them).
  const sameFoes = data.foes === foesOf(model);
  const gone = new Set(sameFoes ? data.enemies.gone : []);
  for (let i = model.enemies.length - 1; i >= 0; i--) if (gone.has(model.enemies[i].id)) model.enemies.splice(i, 1);
  for (const id of gone) model.slain.add(id);
  const enemies = new Map(model.enemies.map((e) => [e.id, e]));
  for (const change of sameFoes ? data.enemies.changed : []) {
    const enemy = enemies.get(change.id);
    if (!enemy) {
      model.world.remember(change.id, change); // (a streamed world's foe whose region isn't made yet: as it was, once it is)
      continue;
    }
    Object.assign(enemy, { x: change.x, z: change.z, hp: Math.min(enemy.maxHp, change.hp), y: model.getGroundY(change.x, change.z) });
  }
  for (const { item, x, z } of data.loot) if (known(item)) model.dropLoot(item, x, z);
  for (const { amount, x, z } of data.coins) model.dropCoins(amount, x, z);
  for (const { inn, money, stock, restockedAt, buyback } of Array.isArray(data.shops) ? data.shops : []) {
    if (typeof inn !== 'number' || typeof money !== 'number' || typeof restockedAt !== 'number') continue;
    // What the hero last sold there, to buy back (a sale of something the game no longer knows, dropped).
    const sales = (Array.isArray(buyback) ? buyback : []).filter((s) => known(s?.id) && Number.isInteger(s.price) && s.price >= 0).slice(0, BUYBACK);
    model.shops.set(data.version === 1 ? shopOfVersion1(model, inn) : inn, { money, stock: { ...stock }, restockedAt, buyback: sales.map(({ id, price, count }) => ({ id, price, count: Number.isInteger(count) && count > 0 ? count : 1 })) }); // (older saves: one of each)
  }
  if (data.quests) model.quests.load(data.quests, model.villages.length);
  if (data.travellers) model.travellers.load(data.travellers);
  if (typeof data.minutes === 'number' && Number.isFinite(data.minutes) && data.minutes >= 0) model.minutes = data.minutes;
  // Villagers pick up their day where they were in it.
  const npcs = new Map(model.npcs.map((n) => [n.id, n]));
  for (const saved of data.npcs) {
    const npc = npcs.get(saved.id);
    if (!npc) continue;
    npc.where = saved.inside === null ? null : doorAt(saved.inside);
    Object.assign(npc, { x: saved.x, z: saved.z, stop: saved.stop, steps: [], path: null, seat: null, stood: null, waited: 0, working: false });
    npc.y = npc.where ? 0 : model.getGroundY(npc.x, npc.z);
  }
}

// A fingerprint of the world's foes as its seed spawns them (each one's id,
// kind and home): a save's foes (by id) only fit a world with the same. Worked
// out once a game (spawning them afresh, the hero at the start, as the world did).
const fingerprints = new WeakMap<GameModel, string>();
function foesOf(model: GameModel): string {
  if (model.world.streamed) return 'streamed'; // (a streamed world's foes are numbered by their region and place in it: the same in any game of it)
  let print = fingerprints.get(model);
  if (print === undefined) {
    const world = { seed: model.seed, size: model.size, villages: model.villages, camps: model.camps, hero: spawnOf(model.size), isOpenTile: (x: number, z: number) => model.isOpenTile(x, z) };
    let h = 2166136261;
    for (const e of spawnEnemies(world)) for (const n of [e.id, e.kind.length, e.kind.charCodeAt(0), Math.round(e.homeX * 4), Math.round(e.homeZ * 4)]) h = Math.imul(h ^ n, 16777619) >>> 0;
    print = h.toString(36);
    fingerprints.set(model, print);
  }
  return print;
}

// A saved hero's stat points: spent and not; a save from before them, all its levels' to spend.
// Never more in all than their level's earned (a save from when levels gave more): what's
// unspent cut to fit; if even what's spent is more, every point back to spend again.
function pointsOf(saved: SaveData['hero']): { statPoints: number; trained: Record<Stat, number> } {
  const whole = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) && n >= 0 ? n : 0);
  const earned = POINTS_PER_LEVEL * (Math.max(1, Math.floor(saved.level)) - 1);
  if (saved.statPoints === undefined) return { statPoints: earned, trained: untrained() };
  const trained = untrained();
  for (const s of STATS) trained[s] = whole(saved.trained?.[s]);
  const spent = STATS.reduce((sum, s) => sum + trained[s], 0);
  if (spent > earned) return { statPoints: earned, trained: untrained() };
  return { statPoints: Math.min(whole(saved.statPoints), earned - spent), trained };
}

// A version 1 save's shop key, as now: an inn's or a smithy's by its door's place in the world's list (now its door's
// number), a pedlar's and a herbalist's by their id past their old bases (now past their new).
function shopOfVersion1(model: GameModel, key: number): number {
  if (key < 1_000_000) {
    const door = model.entrances[key];
    return door ? doorNumber(door) : -1;
  }
  return key < 2_000_000 ? PEDLAR_KEY + key - 1_000_000 : HERBALIST_KEY + key - 2_000_000;
}
