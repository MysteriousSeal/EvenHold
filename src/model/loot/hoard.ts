// What a chest holds, once its keeper's down (a crypt lord's chest, a brood mother's hoard, a bandit camp's chest):
// a piece of gear worth at least `worth` (at the place's level, rare at the least: human/items/gear.ts), and coins by
// the place's level (`base` each level, and up to `spread` each more), rolled from where it stands and its salt, the
// same every time.

import { ITEMS, ITEM_IDS, type ItemId } from '../human/equipment';
import { foundAt, rollGear, type GearKey } from '../human/items/gear';
import type { EnemyKind } from '../types';
import { hashCell, mulberry32, oneOf } from '../../util/random';
import { favouredBy, weighted } from './gearDrops';

export interface Hoard {
  item: GearKey;
  coins: number;
}

export function rollHoard(x: number, z: number, salt: number, level: number, { worth, base, spread, keeper }: { worth: number; base: number; spread: number; keeper?: EnemyKind }): Hoard {
  const rng = mulberry32(hashCell(x, z, salt));
  const kept = (id: ItemId) => !ITEMS[id].set || (!!keeper && !!ITEMS[id].droppedBy?.[keeper]); // (a set's pieces only in its own keepers' chests)
  const fine = ITEM_IDS.filter((id) => (ITEMS[id].value ?? 0) >= worth && foundAt(id, level) && kept(id));
  const own = keeper ? favouredBy(keeper, level).filter(([id]) => (ITEMS[id].value ?? 0) >= worth) : []; // (worth the chest as well)
  const [item, coins] = [oneOf(fine, rng()), base * level + Math.floor(rng() * spread * level)];
  return { item: rollGear(own.length && rng() < 0.5 ? weighted(own, rng()) : item, level, rng, 2, 'rare'), coins };
}
