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
import type { Equipment } from './human/equipment';
import type { BodyLook } from './human/humanoid';
import { layoutOf } from './interiors/indoors';
import type { Shop } from './npcs/tavernShop';

const VERSION = 1;

export interface SaveData {
  version: number;
  seed: number;
  hero: {
    name: string;
    look: BodyLook;
    equipment: Equipment;
    bag: Partial<Record<BagItem, number>>;
    money: number;
    level: number;
    xp: number;
    hp: number;
    x: number;
    z: number;
    facing: number;
    inside: number | null; // the building they're in, by its door's index among the world's
  };
  enemies: { gone: number[]; changed: Array<{ id: number; x: number; z: number; hp: number }> };
  loot: Array<{ item: BagItem; x: number; z: number }>;
  coins: Array<{ amount: number; x: number; z: number }>;
  npcs: Array<{ id: number; inside: number | null; x: number; z: number; stop: number }>;
  shops?: Array<{ inn: number } & Shop>; // each inn's barmaid's purse and wares
}

const round = (v: number) => Math.round(v * 100) / 100; // to a hundredth of a tile: plenty, and a smaller save

// The game as it stands, to save.
export function snapshot(model: GameModel): SaveData {
  const { hero } = model;
  const door = (entrance: GameModel['entrances'][number] | null | undefined) => (entrance ? model.entrances.indexOf(entrance) : null);
  return {
    version: VERSION,
    seed: model.seed,
    hero: {
      name: hero.name,
      look: { ...hero.look },
      equipment: { ...hero.equipment },
      bag: { ...hero.bag },
      money: hero.money,
      level: hero.level,
      xp: hero.xp,
      hp: hero.hp,
      x: model.inside?.seated?.from.x ?? hero.x,
      z: model.inside?.seated?.from.z ?? hero.z,
      facing: hero.facing,
      inside: door(model.inside?.entrance),
    },
    // Which foes the world has is the seed's: what's saved is who's been slain, and who's hurt or wandered.
    enemies: {
      gone: [...model.slain],
      changed: model.enemies
        .filter((e) => e.state !== 'dead' && (e.hp < e.maxHp || Math.hypot(e.x - e.homeX, e.z - e.homeZ) > 0.05))
        .map((e) => ({ id: e.id, x: round(e.x), z: round(e.z), hp: e.hp })),
    },
    loot: model.loot.map(({ item, x, z }) => ({ item, x, z })),
    coins: model.coins.map(({ amount, x, z }) => ({ amount, x, z })),
    // Only villagers who've done something (the rest are as the seed made them, at home).
    npcs: model.npcs
      .filter((n) => n.where !== n.home || n.x !== 0 || n.z !== 0)
      .map((n) => ({ id: n.id, inside: door(n.where), x: round(n.stood?.x ?? n.x), z: round(n.stood?.z ?? n.z), stop: n.stop })),
    shops: [...model.shops].map(([inn, shop]) => ({ inn, money: shop.money, stock: { ...shop.stock }, restockedAt: shop.restockedAt })),
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
  Object.assign(hero, {
    name: saved.name,
    look: { ...saved.look },
    equipment: { ...saved.equipment },
    bag: { ...saved.bag },
    money: saved.money,
    level: saved.level,
    xp: saved.xp,
    hp: saved.hp,
    facing: saved.facing,
  });
  const building = saved.inside === null ? null : model.entrances[saved.inside];
  if (building) {
    model.inside = { entrance: building, ...layoutOf(model.seed, building), seated: null };
    Object.assign(hero, { x: saved.x, z: saved.z, y: 0 });
  } else {
    model.teleport(saved.x, saved.z);
  }
  // Foes: the slain gone, the hurt and the wandered where they were.
  const gone = new Set(data.enemies.gone);
  for (let i = model.enemies.length - 1; i >= 0; i--) if (gone.has(model.enemies[i].id)) model.enemies.splice(i, 1);
  for (const id of gone) model.slain.add(id);
  for (const change of data.enemies.changed) {
    const enemy = model.enemies.find((e) => e.id === change.id);
    if (!enemy) continue;
    Object.assign(enemy, { x: change.x, z: change.z, hp: Math.min(enemy.maxHp, change.hp), y: model.getGroundY(change.x, change.z) });
  }
  for (const { item, x, z } of data.loot) model.dropLoot(item, x, z);
  for (const { amount, x, z } of data.coins) model.dropCoins(amount, x, z);
  for (const { inn, money, stock, restockedAt } of Array.isArray(data.shops) ? data.shops : []) {
    if (typeof inn === 'number' && typeof money === 'number' && typeof restockedAt === 'number') model.shops.set(inn, { money, stock: { ...stock }, restockedAt });
  }
  // Villagers pick up their day where they were in it.
  for (const saved of data.npcs) {
    const npc = model.npcs.find((n) => n.id === saved.id);
    if (!npc) continue;
    npc.where = saved.inside === null ? null : (model.entrances[saved.inside] ?? null);
    Object.assign(npc, { x: saved.x, z: saved.z, stop: saved.stop, steps: [], path: null, seat: null, stood: null, waited: 0, working: false });
    npc.y = npc.where ? 0 : model.getGroundY(npc.x, npc.z);
  }
}
