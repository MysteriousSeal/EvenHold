// The hero's bag: how many of each thing they carry, loot (loot/) and gear
// (human/items/) alike. Their ids never clash, so one record holds both.

import type { ItemId } from './human/equipment';
import type { LootId } from './loot/loot';

export type BagItem = LootId | ItemId;
export type Bag = Partial<Record<BagItem, number>>;

export function addToBag(bag: Bag, item: BagItem): void {
  bag[item] = (bag[item] ?? 0) + 1;
}

// Takes one `item` out; returns whether there was one.
export function takeFromBag(bag: Bag, item: BagItem): boolean {
  const count = bag[item] ?? 0;
  if (count <= 0) return false;
  if (count === 1) delete bag[item];
  else bag[item] = count - 1;
  return true;
}
