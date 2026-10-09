// The hero's bag, how much it holds: BAG_ROOM slots of its own, and four bag
// sockets, each a bag fitted (loot/bags.ts) six more. Full (every slot taken:
// a thing to a slot, junk up to twenty to one), nothing new goes in: more of
// what's carried still does, onto a stack with room. A bag's fitted from the bag (out of it,
// into a socket), and taken off back into it, only while what's carried
// still fits without it.

import { ROOM_OF_A_BAG, isBagItem, roomOf, type BagId } from '../loot/bags';
import { addToBag, takeFromBag, type BagItem } from './bag';
import { needsNewStack, slotsUsed } from './bagStacks';
import type { Hero } from '../types';

export const BAG_ROOM = 24; // slots the bag has of its own
export const BAG_SOCKETS = 4; // bags that can be fitted to it
export const ROOM_PER_BAG = ROOM_OF_A_BAG; // slots a fitted bag adds, unless it's roomier (loot/bags.ts roomOf)

// How many slots the hero's bag has now.
export const bagRoom = (hero: Pick<Hero, 'bags'>): number => BAG_ROOM + hero.bags.reduce((room, b) => room + (b ? roomOf(b) : 0), 0);

// Whether one more `item` would go in: onto a stack of it with room, always; a stack of its own, if there's a slot free.
export const canCarry = (hero: Pick<Hero, 'bag' | 'bags'>, item: BagItem): boolean => !needsNewStack(item, hero.bag[item] ?? 0) || slotsUsed(hero.bag) < bagRoom(hero);

// Fits a bag from the bag into socket `socket` (the first free, if not said); whether it did (a bag carried, the
// socket free).
export function fitBag(hero: Hero, item: BagItem, socket = hero.bags.indexOf(null)): boolean {
  if (!isBagItem(item) || socket < 0 || socket >= BAG_SOCKETS || hero.bags[socket] !== null || !takeFromBag(hero.bag, item)) return false;
  hero.bags[socket] = item;
  return true;
}

// Takes the bag in `socket` off, back into the bag; only if what's carried (and it) still fit without its room.
export function unfitBag(hero: Hero, socket: number): boolean {
  const fitted = hero.bags[socket];
  if (!fitted) return false;
  const taken = slotsUsed(hero.bag) + (needsNewStack(fitted, hero.bag[fitted] ?? 0) ? 1 : 0);
  if (taken > bagRoom(hero) - roomOf(fitted)) return false;
  hero.bags[socket] = null;
  addToBag(hero.bag, fitted);
  return true;
}

// The sockets as kept in a save: each a bag fitted, or null (anything else, left empty).
export const readSockets = (saved: unknown): Array<BagId | null> =>
  Array.from({ length: BAG_SOCKETS }, (_, i) => {
    const b = Array.isArray(saved) ? saved[i] : null;
    return typeof b === 'string' && isBagItem(b) ? b : null;
  });
