// What a chest holds, once its keeper's down (a crypt lord's chest, a brood mother's hoard, a bandit camp's chest):
// a piece of gear worth at least `worth` (at the place's level, rare at the least: human/items/gear.ts), and coins by
// the place's level (`base` each level, and up to `spread` each more), rolled from where it stands and its salt, the
// same every time.

import { ITEMS, ITEM_IDS } from '../human/equipment';
import { rollGear, type GearKey } from '../human/items/gear';
import { hashCell, mulberry32, oneOf } from '../../util/random';

export interface Hoard {
  item: GearKey;
  coins: number;
}

export function rollHoard(x: number, z: number, salt: number, level: number, { worth, base, spread }: { worth: number; base: number; spread: number }): Hoard {
  const rng = mulberry32(hashCell(x, z, salt));
  const fine = ITEM_IDS.filter((id) => (ITEMS[id].value ?? 0) >= worth);
  const [item, coins] = [oneOf(fine, rng()), base * level + Math.floor(rng() * spread * level)];
  return { item: rollGear(item, level, rng, 2, 'rare'), coins };
}
