// The bag's slots: each thing a slot (a stack), junk JUNK_STACK to a slot
// (more takes another); where each stack sits and how many it holds, as the
// hero's arranged them (Hero.bagOrder, bagCounts); a stack moved, one taken
// from its very stack, the bag tidied. How many slots there are: bagSlots.ts.

import { EQUIP_SLOTS, ITEMS } from '../human/equipment';
import { LOOT_QUALITY } from '../loot/loot';
import type { Hero } from '../types';
import { BAG_GROUPS, groupOf, isLootItem, nameOf, takeFromBag, type Bag, type BagItem } from './bag';

// How many of a thing go in one slot: junk JUNK_STACK (more takes another slot), anything else, all of it.
export const JUNK_STACK = 20;
const stackOf = (item: BagItem) => (isLootItem(item) && LOOT_QUALITY[item] === 'junk' ? JUNK_STACK : Infinity);

// How many slots `count` of `item` take.
export const stacksOf = (item: BagItem, count: number): number => (count <= 0 ? 0 : Number.isFinite(stackOf(item)) ? Math.ceil(count / stackOf(item)) : 1);

// Whether one more of `item`, with `count` carried, would need a slot of its own (a new stack).
export const needsNewStack = (item: BagItem, count: number): boolean => stacksOf(item, count + 1) > stacksOf(item, count);

// How many slots everything in the bag takes.
export const slotsUsed = (bag: Bag): number => (Object.entries(bag) as Array<[BagItem, number]>).reduce((n, [item, count]) => n + stacksOf(item, count), 0);

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

// The bag tidied (a button on it): everything packed from the first slot, by
// its group (BAG_GROUPS), gear head to toe (then jewellery, then what's held);
// alike things by name.
export function sortedBag(bag: Bag): BagItem[] {
  const rank = (item: BagItem) => BAG_GROUPS.findIndex((g) => g.group === groupOf(item)) * 100 + (isLootItem(item) ? 0 : EQUIP_SLOTS.indexOf(ITEMS[item].slot));
  const kinds = (Object.keys(bag) as BagItem[]).filter((item) => (bag[item] ?? 0) > 0).sort((a, b) => rank(a) - rank(b) || nameOf(a).localeCompare(nameOf(b)));
  return kinds.flatMap((item) => Array.from({ length: stacksOf(item, bag[item]!) }, () => item)); // (a thing's stacks side by side)
}
