// The hero's strongbox: one store, kept for them at every inn (a bank's way: what's put in at one inn comes out at
// any), opened at the strongbox downstairs or the chest in the room they've let (interiors: stashInReach). It holds
// STASH_SLOTS slots: junk JUNK_STACK to a slot, anything else STASH_STACK (materials by the fifty); quest items stay
// in the bag, where their quests look for them. Things go in and out a stack at a time, as far as there's room on
// the other side; and all the junk, or all the materials, in at once. (A cottage's chest, one day, opens the same.)

import type { Hero } from '../types';
import { addToBag, groupOf, isLootItem, takeFromBag, type Bag, type BagGroup, type BagItem } from './bag';
import { JUNK_STACK } from './bagStacks';
import { canCarry } from './bagSlots';
import { LOOT, LOOT_QUALITY } from '../loot/loot';
import { isGear } from '../human/items/gear';
import { distanceTo, type Furniture } from '../interiors/furniture';
import type { Inside } from '../interiors/indoors';

export const STASH_SLOTS = 60;
export const STASH_STACK = 50; // to a slot, of anything but junk

const stackOf = (item: BagItem) => (isLootItem(item) && LOOT_QUALITY[item] === 'junk' ? JUNK_STACK : STASH_STACK);
const stacks = (item: BagItem, count: number) => (count <= 0 ? 0 : Math.ceil(count / stackOf(item)));

// Whether `item` may be put in it at all (a quest's things kept on the hero).
export const stashable = (item: BagItem): boolean => !(isLootItem(item) && LOOT_QUALITY[item] === 'quest');

// How many of its slots what's in it takes.
export const stashUsed = (stash: Bag): number => (Object.entries(stash) as Array<[BagItem, number]>).reduce((n, [item, count]) => n + stacks(item, count), 0);

// What's in it, a stack to a slot (each thing's stacks full but the last), in the bag's order of kinds, then by name.
export function stashSlots(stash: Bag): Array<{ item: BagItem; count: number }> {
  const slots: Array<{ item: BagItem; count: number }> = [];
  for (const item of Object.keys(stash) as BagItem[]) {
    for (let left = stash[item] ?? 0; left > 0; left -= stackOf(item)) slots.push({ item, count: Math.min(stackOf(item), left) });
  }
  return slots;
}

// How many more of `item` it takes: onto its last stack's room, then new stacks while slots are free.
function stashRoom(stash: Bag, item: BagItem): number {
  const have = stash[item] ?? 0;
  const onLast = have > 0 && have % stackOf(item) !== 0 ? stackOf(item) - (have % stackOf(item)) : 0;
  return onLast + Math.max(0, STASH_SLOTS - stashUsed(stash)) * stackOf(item);
}

// Up to `count` of `item` from the bag into the strongbox, as far as it has room; how many went in.
export function store(hero: Pick<Hero, 'bag' | 'stash'>, item: BagItem, count = hero.bag[item] ?? 0): number {
  if (!stashable(item)) return 0;
  const stash = (hero.stash ??= {});
  const n = Math.min(count, hero.bag[item] ?? 0, stashRoom(stash, item));
  for (let i = 0; i < n; i++) [takeFromBag(hero.bag, item), addToBag(stash, item)];
  return Math.max(0, n);
}

// Up to `count` of `item` out of the strongbox into the bag, as far as the bag has room; how many came out.
export function retrieve(hero: Pick<Hero, 'bag' | 'bags' | 'stash'>, item: BagItem, count = hero.stash?.[item] ?? 0): number {
  const stash = hero.stash ?? {};
  let n = 0;
  while (n < count && (stash[item] ?? 0) > 0 && canCarry(hero, item)) [takeFromBag(stash, item), addToBag(hero.bag, item), n++];
  return n;
}

// Every one of a group's things in the bag (its junk, its crafting materials) put in; how many went in, and whether
// any were left for want of room.
export function storeAll(hero: Pick<Hero, 'bag' | 'stash'>, group: Extract<BagGroup, 'junk' | 'ingredient'>): { stored: number; left: boolean } {
  let stored = 0;
  let left = false;
  for (const item of (Object.keys(hero.bag) as BagItem[]).filter((i) => groupOf(i) === group)) {
    stored += store(hero, item);
    left ||= (hero.bag[item] ?? 0) > 0;
  }
  return { stored, left };
}

// A save's strongbox, as far as it's sound: things the game still knows, in whole numbers, a quest's left out.
export function readStash(saved: unknown): Bag {
  const stash: Bag = {};
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return stash;
  for (const [item, n] of Object.entries(saved as Record<string, unknown>)) {
    if ((Object.hasOwn(LOOT, item) || isGear(item)) && Number.isInteger(n) && (n as number) > 0 && (n as number) <= STASH_SLOTS * STASH_STACK && stashable(item as BagItem)) stash[item as BagItem] = n as number;
  }
  return stash;
}

const REACH = 0.6; // room tiles from the strongbox (or the let room's chest) to open it

// The strongbox the hero stands at, if any: an inn's downstairs, or the chest in the room let upstairs (only theirs
// to be in: inn/roomLetting.ts); not at work.
export function strongboxInReach(model: { inside: Inside | null; hero: { x: number; z: number }; work: { shift: unknown } }): Furniture | null {
  const { inside, hero } = model;
  if (!inside || inside.entrance.type !== 'inn' || model.work.shift) return null;
  const kind = inside.below ? 'chest' : 'strongbox';
  return inside.furniture.find((f) => f.kind === kind && distanceTo(f, hero.x, hero.z) <= REACH) ?? null;
}
