// The hero's bag, how much it holds: BAG_ROOM slots of its own, and four bag
// sockets, each a bag fitted (loot/bags.ts) six more. Full (as many kinds
// carried as it has slots), nothing new goes in: more of what's carried
// still does (stacked in its slot). A bag's fitted from the bag (out of it,
// into a socket), and taken off back into it, only while what's carried
// still fits without it.

import { isBagItem, type BagId } from '../loot/bags';
import { addToBag, takeFromBag, type BagItem } from './bag';
import type { Hero } from '../types';

export const BAG_ROOM = 24; // slots the bag has of its own
export const BAG_SOCKETS = 4; // bags that can be fitted to it
export const ROOM_PER_BAG = 6; // slots each fitted bag adds

// How many slots the hero's bag has now.
export const bagRoom = (hero: Pick<Hero, 'bags'>): number => BAG_ROOM + ROOM_PER_BAG * hero.bags.filter((b) => b !== null).length;

// How many kinds of thing it holds (each its own slot).
export const kindsCarried = (hero: Pick<Hero, 'bag'>): number => Object.values(hero.bag).filter((n) => (n ?? 0) > 0).length;

// Whether one more `item` would go in: more of what's carried, always; something new, if there's a slot free.
export const canCarry = (hero: Pick<Hero, 'bag' | 'bags'>, item: BagItem): boolean => (hero.bag[item] ?? 0) > 0 || kindsCarried(hero) < bagRoom(hero);

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
  const kinds = kindsCarried(hero) + ((hero.bag[fitted] ?? 0) > 0 ? 0 : 1);
  if (kinds > bagRoom(hero) - ROOM_PER_BAG) return false;
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
