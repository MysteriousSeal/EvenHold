// The hero's bag: how many of each thing they carry, loot (loot/) and gear
// (human/items/) alike. Their ids never clash, so one record holds both.

import { ITEMS, type ItemId } from './human/equipment';
import { LOOT, LOOT_QUALITY, type LootId, type LootQuality } from './loot/loot';

export type BagItem = LootId | ItemId;
// How an item's name is colored: loot has its quality; gear is common.
export type Quality = LootQuality | 'common';

export const isLootItem = (item: BagItem): item is LootId => item in LOOT;
export const nameOf = (item: BagItem): string => (isLootItem(item) ? LOOT[item].name : ITEMS[item].name);
export const qualityOf = (item: BagItem): Quality => (isLootItem(item) ? LOOT_QUALITY[item] : 'common');
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
