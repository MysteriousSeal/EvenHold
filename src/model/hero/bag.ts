// The hero's bag: how many of each thing they carry, loot (loot/) and gear
// (human/items/) alike. Their ids never clash, so one record holds both.

import { EQUIP_SLOTS, ITEMS, type ItemId } from '../human/equipment';
import { LOOT, LOOT_QUALITY, type LootId, type LootQuality } from '../loot/loot';
import { PROVISIONS, isProvision } from '../loot/provisions';
import type { Hero } from '../types';
import { maxEnergyOf, maxHpOf } from './attributes';

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

// How many of a thing go in one slot: junk JUNK_STACK (more takes another slot), anything else, all of it.
export const JUNK_STACK = 20;
const stackOf = (item: BagItem) => (isLootItem(item) && LOOT_QUALITY[item] === 'junk' ? JUNK_STACK : Infinity);

// How many slots `count` of `item` take.
export const stacksOf = (item: BagItem, count: number): number => (count <= 0 ? 0 : Number.isFinite(stackOf(item)) ? Math.ceil(count / stackOf(item)) : 1);

// How many slots everything in the bag takes.
export const slotsUsed = (bag: Bag): number => (Object.entries(bag) as Array<[BagItem, number]>).reduce((n, [item, count]) => n + stacksOf(item, count), 0);

// How many of `item` sit in its `nth` stack (its stacks full but the last).
export function stackCount(bag: Bag, item: BagItem, nth: number): number {
  const stack = stackOf(item);
  return Number.isFinite(stack) ? Math.min(stack, (bag[item] ?? 0) - nth * stack) : (bag[item] ?? 0);
}

// Where each thing sits in the bag, slot by slot (null: an empty slot), from
// the order the hero's put them in (a thing's stacks each a slot of its own:
// junk JUNK_STACK to a slot): what has no place yet (just picked up, or a
// stack begun) takes the first free slot, and what's gone (a stack used up)
// leaves its slot empty. Never fewer than `size` slots; more, if the bag holds
// more stacks than that.
export function bagLayout(bag: Bag, order: ReadonlyArray<BagItem | null>, size: number): Array<BagItem | null> {
  const left = new Map((Object.keys(bag) as BagItem[]).map((item) => [item, stacksOf(item, bag[item] ?? 0)])); // (its stacks still to place)
  const take = (item: BagItem | null): BagItem | null => {
    if (!item || !(left.get(item) ?? 0)) return null;
    left.set(item, left.get(item)! - 1);
    return item;
  };
  const slots: Array<BagItem | null> = Array.from({ length: Math.max(size, order.length) }, (_, i) => take(order[i] ?? null));
  for (const [item, stacks] of left) {
    for (let k = 0; k < stacks; k++) {
      const free = slots.indexOf(null);
      if (free >= 0) slots[free] = item;
      else slots.push(item);
    }
  }
  return slots;
}

// How many sit in each slot of a layout (bagLayout): a thing's stacks in order, full but the last.
export function layoutCounts(bag: Bag, layout: ReadonlyArray<BagItem | null>): number[] {
  const seen = new Map<BagItem, number>();
  return layout.map((item) => {
    if (!item) return 0;
    const nth = seen.get(item) ?? 0;
    seen.set(item, nth + 1);
    return stackCount(bag, item, nth);
  });
}

// The bag's order with the thing in slot `from` moved to slot `to` (swapping
// with what's there, if anything).
export function moveInBag(bag: Bag, order: ReadonlyArray<BagItem | null>, from: number, to: number, size: number): Array<BagItem | null> {
  const slots = bagLayout(bag, order, size);
  [slots[from], slots[to]] = [slots[to] ?? null, slots[from] ?? null];
  return slots;
}

// The bag tidied (a button on it): everything packed from the first slot,
// gear first (head to toe, then jewellery, then what's held), then food and
// drink, ingredients, quest items, and junk last; alike things by name.
export function sortedBag(bag: Bag): BagItem[] {
  const GROUPS: Quality[] = ['common', 'ingredient', 'quest', 'junk'];
  const rank = (item: BagItem) => (isLootItem(item) ? 1 + GROUPS.indexOf(LOOT_QUALITY[item]) : 0) * 100 + (isLootItem(item) ? 0 : EQUIP_SLOTS.indexOf(ITEMS[item].slot));
  const kinds = (Object.keys(bag) as BagItem[]).filter((item) => (bag[item] ?? 0) > 0).sort((a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b)));
  return kinds.flatMap((item) => Array.from({ length: stacksOf(item, bag[item]!) }, () => item)); // (a thing's stacks side by side)
}

// Eats or drinks one of `item` from the hero's bag: food for the health it gives back, drink for the energy (up to
// their most); returns whether they did (it's food or drink, and carried).
export function eatOrDrink(hero: Hero, item: BagItem): boolean {
  if (!isProvision(item) || !takeFromBag(hero.bag, item)) return false;
  const { heal = 0, energy = 0 } = PROVISIONS[item];
  hero.hp = Math.min(maxHpOf(hero), hero.hp + heal);
  hero.energy = Math.min(maxEnergyOf(hero), hero.energy + energy);
  return true;
}
