// What a chest holds, once its keeper's down (a crypt lord's chest, a brood mother's hoard, a bandit camp's chest):
// a piece of gear worth at least `worth`, and coins by the place's level (`base` each level, and up to `spread` each
// more), rolled from where it stands and its salt, the same every time.

import { ITEMS, ITEM_IDS, type ItemId } from '../human/equipment';
import { hashCell, mulberry32 } from '../../util/random';

export interface Hoard {
  item: ItemId;
  coins: number;
}

export function rollHoard(x: number, z: number, salt: number, level: number, { worth, base, spread }: { worth: number; base: number; spread: number }): Hoard {
  const rng = mulberry32(hashCell(x, z, salt));
  const fine = ITEM_IDS.filter((id) => (ITEMS[id].value ?? 0) >= worth);
  return { item: fine[Math.floor(rng() * fine.length)], coins: base * level + Math.floor(rng() * spread * level) };
}
