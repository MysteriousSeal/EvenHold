// The hero's bag: how many of each thing they carry, loot (loot/) and gear
// (human/items/) alike. Their ids never clash, so one record holds both.

import { ITEMS, type ItemId } from '../human/equipment';
import { LOOT, LOOT_QUALITY, type LootId, type LootQuality } from '../loot/loot';

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

// Where each thing sits in the bag, slot by slot (null: an empty slot), from
// the order the hero's put them in: what has no place yet (just picked up)
// takes the first free slot, and what's gone leaves its slot empty. Never
// fewer than `size` slots; more, if the bag holds more kinds than that.
export function bagLayout(bag: Bag, order: ReadonlyArray<BagItem | null>, size: number): Array<BagItem | null> {
  const carried = (item: BagItem | null): item is BagItem => !!item && (bag[item] ?? 0) > 0;
  const slots: Array<BagItem | null> = Array.from({ length: Math.max(size, order.length) }, (_, i) => (carried(order[i]) ? order[i] : null));
  for (const item of Object.keys(bag) as BagItem[]) {
    if (!carried(item) || slots.includes(item)) continue;
    const free = slots.indexOf(null);
    if (free >= 0) slots[free] = item;
    else slots.push(item);
  }
  return slots;
}

// The bag's order with the thing in slot `from` moved to slot `to` (swapping
// with what's there, if anything).
export function moveInBag(bag: Bag, order: ReadonlyArray<BagItem | null>, from: number, to: number, size: number): Array<BagItem | null> {
  const slots = bagLayout(bag, order, size);
  [slots[from], slots[to]] = [slots[to] ?? null, slots[from] ?? null];
  return slots;
}
