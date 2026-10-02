// The hero's bag: how many of each thing they carry, loot (loot/) and gear
// (human/items/) alike. Their ids never clash, so one record holds both.

import { EQUIP_SLOTS, ITEMS, SLOT_NAMES, type ItemId } from '../human/equipment';
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

// What kind of thing it is, said short ("Junk", "Food", "Head"): loot by its quality (food and drink apart), gear by
// what it's worn on.
const KIND_NAMES: Record<Exclude<LootQuality, 'common'>, string> = { junk: 'Junk', ingredient: 'Ingredient', quest: 'Quest item', bag: 'Bag' };
export function kindOf(item: BagItem): string {
  if (!isLootItem(item)) return SLOT_NAMES[ITEMS[item].slot];
  if (isProvision(item)) return PROVISIONS[item].drink ? 'Drink' : 'Food';
  return KIND_NAMES[LOOT_QUALITY[item] as Exclude<LootQuality, 'common'>];
}
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

// Where each thing sits in the bag, slot by slot (null: an empty slot), and
// how many in each, from the order the hero's put them in and what each slot
// held (`counts`, by slot: none given, packed: a thing's stacks full but the
// last). A thing's stacks each a slot of its own (junk JUNK_STACK to a slot).
// What's in the bag that the slots don't account for is put right: more,
// onto its stacks with room, in order, then new stacks; fewer, off its last
// stacks. What has no place yet (just picked up, or a stack begun) takes the
// first free slot, and what's gone (a stack used up) leaves its slot empty.
// Never fewer than `size` slots; more, if the bag holds more stacks than that.
export function bagStacks(bag: Bag, order: ReadonlyArray<BagItem | null>, counts: ReadonlyArray<number> | undefined, size: number): { layout: Array<BagItem | null>; counts: number[] } {
  const length = Math.max(size, order.length);
  const layout: Array<BagItem | null> = Array.from({ length }, () => null);
  const held: number[] = Array.from({ length }, () => 0);
  const overflow: Array<[BagItem, number]> = []; // what has no slot yet: new stacks, things just picked up
  for (const item of Object.keys(bag) as BagItem[]) {
    const total = bag[item] ?? 0;
    if (total <= 0) continue;
    const stack = stackOf(item);
    const at = order.flatMap((o, i) => (o === item ? [i] : []));
    if (!Number.isFinite(stack)) {
      // (One slot holds it all: its first place, if it has one.)
      if (at.length) [layout[at[0]], held[at[0]]] = [item, total];
      continue;
    }
    const known = counts !== undefined && at.some((i) => (counts[i] ?? 0) > 0);
    // Its stacks where they stand, each what it held (or, none told, packed in turn).
    let left = total;
    const stacks = at.map((i) => {
      const c = known ? Math.max(0, Math.min(stack, counts![i] ?? 0)) : Math.min(stack, Math.max(0, left));
      if (!known) left -= c;
      return { i, c };
    });
    let sum = stacks.reduce((n, s) => n + s.c, 0);
    for (let k = stacks.length - 1; k >= 0 && sum > total; k--) {
      const off = Math.min(stacks[k].c, sum - total); // (fewer: off the last stacks)
      stacks[k].c -= off;
      sum -= off;
    }
    for (const s of stacks) {
      const on = Math.min(stack - s.c, total - sum); // (more: onto stacks with room)
      s.c += on;
      sum += on;
    }
    for (const s of stacks) if (s.c > 0) [layout[s.i], held[s.i]] = [item, s.c];
    for (let over = total - sum; over > 0; over -= stack) overflow.push([item, Math.min(stack, over)]); // (new stacks: placed once all is)
  }
  // Only then, once everything with a place has it: new stacks and things with no place yet (just picked up), each
  // in the first free slot (never one another thing's order keeps).
  for (const item of Object.keys(bag) as BagItem[]) if ((bag[item] ?? 0) > 0 && !Number.isFinite(stackOf(item)) && !layout.includes(item)) overflow.push([item, bag[item]!]);
  for (const [item, c] of overflow) {
    const free = layout.indexOf(null);
    const i = free >= 0 ? free : layout.push(null) - 1;
    [layout[i], held[i]] = [item, c];
  }
  return { layout, counts: held };
}

// Where each thing sits in the bag (bagStacks, its stacks packed).
export const bagLayout = (bag: Bag, order: ReadonlyArray<BagItem | null>, size: number): Array<BagItem | null> => bagStacks(bag, order, undefined, size).layout;

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

// The hero's slot `from` moved to slot `to` (swapping with what's there), each stack keeping what it holds.
export function moveSlot(hero: Pick<Hero, 'bag' | 'bagOrder' | 'bagCounts'>, from: number, to: number, size: number): void {
  const { layout, counts } = bagStacks(hero.bag, hero.bagOrder, hero.bagCounts, size);
  while (layout.length <= Math.max(from, to)) [layout.push(null), counts.push(0)];
  [layout[from], layout[to]] = [layout[to], layout[from]];
  [counts[from], counts[to]] = [counts[to], counts[from]];
  [hero.bagOrder, hero.bagCounts] = [layout, counts];
}

// One of what's in the hero's slot `slot` taken out of the bag, from that very stack (not the last of its kind);
// whether there was one.
export function takeFromSlot(hero: Pick<Hero, 'bag' | 'bagOrder' | 'bagCounts'>, slot: number, size: number): BagItem | null {
  const { layout, counts } = bagStacks(hero.bag, hero.bagOrder, hero.bagCounts, size);
  const item = layout[slot];
  if (!item || !takeFromBag(hero.bag, item)) return null;
  counts[slot] -= 1;
  if (counts[slot] <= 0) [layout[slot], counts[slot]] = [null, 0];
  [hero.bagOrder, hero.bagCounts] = [layout, counts];
  return item;
}

// The bag's order with the thing in slot `from` moved to slot `to` (swapping
// with what's there, if anything).
export function moveInBag(bag: Bag, order: ReadonlyArray<BagItem | null>, from: number, to: number, size: number): Array<BagItem | null> {
  const slots = bagLayout(bag, order, size);
  [slots[from], slots[to]] = [slots[to] ?? null, slots[from] ?? null];
  return slots;
}

// The bag's rows by what things are, in this order (each its own rows, under its title).
export type BagGroup = 'gear' | 'provision' | 'ingredient' | 'quest' | 'bag' | 'junk';
export const BAG_GROUPS: ReadonlyArray<{ group: BagGroup; title: string }> = [
  { group: 'gear', title: 'Gear' },
  { group: 'provision', title: 'Food & drink' },
  { group: 'ingredient', title: 'Ingredients' },
  { group: 'quest', title: 'Quest items' },
  { group: 'bag', title: 'Bags' },
  { group: 'junk', title: 'Junk' },
];
const GROUP_OF: Record<LootQuality, BagGroup> = { common: 'provision', ingredient: 'ingredient', quest: 'quest', bag: 'bag', junk: 'junk' };
export const groupOf = (item: BagItem): BagGroup => (isLootItem(item) ? GROUP_OF[LOOT_QUALITY[item]] : 'gear');

// The bag tidied (a button on it): everything packed from the first slot, by
// its group (BAG_GROUPS), gear head to toe (then jewellery, then what's held);
// alike things by name.
export function sortedBag(bag: Bag): BagItem[] {
  const rank = (item: BagItem) => BAG_GROUPS.findIndex((g) => g.group === groupOf(item)) * 100 + (isLootItem(item) ? 0 : EQUIP_SLOTS.indexOf(ITEMS[item].slot));
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
