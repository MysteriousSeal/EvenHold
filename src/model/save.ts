// Saving a game: the hero (who they are, what they carry and wear, how far
// they've come, where they stand, in or out of doors) and the world as it's
// been changed (foes slain or hurt or moved, loot and coins lying about,
// where each villager is in their day), as plain data to store and read
// back. What the seed makes (the land, who lives where) isn't saved: it's
// made again the same.
//
// A save is read defensively: it comes from outside (the browser's
// storage), so anything missing or malformed means no save at all.

import type { GameModel } from './GameModel';
import type { BagItem } from './hero/bag';
import { BUYBACK } from './shops/shopStock';
import { ITEMS, type Equipment, type ItemId } from './human/equipment';
import { LOOT } from './loot/loot';
import { MAX_ENERGY, maxHpAt } from './hero/heroStats';
import type { BodyLook } from './human/humanoid';
import { layoutOf } from './interiors/indoors';
import { openDoorsAt, setOpenDoors, upstairsInside } from './interiors/upstairs';
import type { Shop } from './inn/tavernShop';
import { BLESSINGS, BLESSING_TIME, type Blessing } from './hero/blessing';
import { FIRST_MOB_ID, type QuestBook } from './quests/questBook';
import { spawnEnemies } from './enemies/enemies';
import { spawnOf } from './grid';

const VERSION = 1;

export interface SaveData {
  version: number;
  seed: number;
  hero: {
    name: string;
    look: BodyLook;
    equipment: Equipment;
    bag: Partial<Record<BagItem, number>>;
    bagOrder?: Array<BagItem | null>; // where each thing sits in it
    money: number;
    level: number;
    xp: number;
    hp: number;
    energy?: number; // spent through the day, slept back
    x: number;
    z: number;
    facing: number;
    inside: number | null; // the building they're in, by its door's index among the world's
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
  fullWalls?: boolean; // the option: rooms' inner walls full height
  quests?: ReturnType<QuestBook['save']>; // the quests handed in, and those taken
}

const MAX_BAG_SLOTS = 256; // a saved bag order longer than any bag is cut there
const round = (v: number) => Math.round(v * 100) / 100; // to a hundredth of a tile: plenty, and a smaller save

// The game as it stands, to save.
export function snapshot(model: GameModel): SaveData {
  const { hero } = model;
  const door = (entrance: GameModel['entrances'][number] | null | undefined) => (entrance ? model.entrances.indexOf(entrance) : null);
  const indoors = model.yard ? model.yard.back.inside : model.inside; // a save from the yard keeps where they came from
  const spot = model.yard?.back;
  return {
    version: VERSION,
    seed: model.seed,
    hero: {
      name: hero.name,
      look: { ...hero.look },
      equipment: { ...hero.equipment },
      bag: { ...hero.bag },
      bagOrder: [...hero.bagOrder],
      money: hero.money,
      level: hero.level,
      xp: hero.xp,
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
        .filter((e) => e.id < FIRST_MOB_ID && e.state !== 'dead' && (e.hp < e.maxHp || Math.hypot(e.x - e.homeX, e.z - e.homeZ) > 0.05))
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
    doors: model.entrances.map((e, inn) => ({ inn, open: openDoorsAt(e) })).filter((d) => d.open.length > 0),
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
    if (data?.version !== VERSION || data.seed !== seed || !h || typeof h.name !== 'string' || !h.look || ![h.money, h.level, h.xp, h.hp, h.x, h.z, h.facing].every(num)) return null;
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
  // Only things the game still knows (a save may be older than a change to
  // them), worn in the slot they go in, carried in whole numbers.
  const known = (item: string): item is BagItem => item in LOOT || item in ITEMS;
  const bag = Object.fromEntries(Object.entries(saved.bag ?? {}).filter(([item, n]) => known(item) && Number.isInteger(n) && (n as number) > 0));
  const equipment = Object.fromEntries(Object.entries(saved.equipment ?? {}).filter(([slot, item]) => typeof item === 'string' && ITEMS[item as ItemId]?.slot === slot));
  Object.assign(hero, {
    name: saved.name,
    look: { ...saved.look },
    equipment,
    bag,
    bagOrder: Array.isArray(saved.bagOrder) ? saved.bagOrder.slice(0, MAX_BAG_SLOTS).map((item) => (typeof item === 'string' && known(item) ? item : null)) : [],
    money: Math.max(0, Math.floor(saved.money)),
    level: Math.max(1, Math.floor(saved.level)),
    xp: Math.max(0, saved.xp),
    facing: saved.facing,
    blessings: (Array.isArray(saved.blessings) ? saved.blessings : [])
      .filter((b) => b && b.kind in BLESSINGS && typeof b.left === 'number' && b.left > 0)
      .map((b) => ({ kind: b.kind, left: Math.min(BLESSING_TIME, b.left) })),
  });
  hero.hp = Math.min(maxHpAt(hero.level), Math.max(1, saved.hp));
  if (typeof saved.energy === 'number' && Number.isFinite(saved.energy)) hero.energy = Math.min(MAX_ENERGY, Math.max(0, saved.energy));
  model.lastInn = typeof saved.lastInn === 'number' ? (model.entrances[saved.lastInn] ?? null) : null;
  model.fullWalls = data.fullWalls === true;
  for (const { inn, open } of data.doors ?? []) {
    const building = model.entrances[inn];
    if (building && Array.isArray(open)) setOpenDoors(building, open.filter((k) => typeof k === 'string'));
  }
  const building = saved.inside === null ? null : model.entrances[saved.inside];
  if (building) {
    const { room, furniture } = layoutOf(model.seed, building);
    const stairs = furniture.find((f) => f.kind === 'stairs');
    model.inside = saved.upstairs && stairs
      ? upstairsInside(building, room, stairs, model.seed, model.fullWalls) // on the floor above
      : { entrance: building, room, furniture, seated: null };
    Object.assign(hero, { x: saved.x, z: saved.z, y: 0 });
  } else {
    model.teleport(Math.min(model.size.width - 1, Math.max(0, saved.x)), Math.min(model.size.depth - 1, Math.max(0, saved.z)));
  }
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
    if (!enemy) continue;
    Object.assign(enemy, { x: change.x, z: change.z, hp: Math.min(enemy.maxHp, change.hp), y: model.getGroundY(change.x, change.z) });
  }
  for (const { item, x, z } of data.loot) if (known(item)) model.dropLoot(item, x, z);
  for (const { amount, x, z } of data.coins) model.dropCoins(amount, x, z);
  for (const { inn, money, stock, restockedAt, buyback } of Array.isArray(data.shops) ? data.shops : []) {
    if (typeof inn !== 'number' || typeof money !== 'number' || typeof restockedAt !== 'number') continue;
    // What the hero last sold there, to buy back (a sale of something the game no longer knows, dropped).
    const sales = (Array.isArray(buyback) ? buyback : []).filter((s) => known(s?.id) && Number.isInteger(s.price) && s.price >= 0).slice(0, BUYBACK);
    model.shops.set(inn, { money, stock: { ...stock }, restockedAt, buyback: sales.map(({ id, price, count }) => ({ id, price, count: Number.isInteger(count) && count > 0 ? count : 1 })) }); // (older saves: one of each)
  }
  if (data.quests) model.quests.load(data.quests, model.villages.length);
  if (typeof data.minutes === 'number' && Number.isFinite(data.minutes) && data.minutes >= 0) model.minutes = data.minutes;
  // Villagers pick up their day where they were in it.
  const npcs = new Map(model.npcs.map((n) => [n.id, n]));
  for (const saved of data.npcs) {
    const npc = npcs.get(saved.id);
    if (!npc) continue;
    npc.where = saved.inside === null ? null : (model.entrances[saved.inside] ?? null);
    Object.assign(npc, { x: saved.x, z: saved.z, stop: saved.stop, steps: [], path: null, seat: null, stood: null, waited: 0, working: false });
    npc.y = npc.where ? 0 : model.getGroundY(npc.x, npc.z);
  }
}

// A fingerprint of the world's foes as its seed spawns them (each one's id,
// kind and home): a save's foes (by id) only fit a world with the same. Worked
// out once a game (spawning them afresh, the hero at the start, as the world did).
const fingerprints = new WeakMap<GameModel, string>();
function foesOf(model: GameModel): string {
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
