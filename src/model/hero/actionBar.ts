// The hero's action bar: ACTION_SLOTS shortcuts to food and drink in their
// bag (WoW's way: a slot points at a kind of thing, never holds it), each
// used with its key (1 to 8) or a click, one taken from the bag and eaten
// or drunk (bag.ts eatOrDrink). Emptied, the slot stays, waiting for more.

import { isProvision, type ProvisionId } from '../loot/provisions';
import type { Hero } from '../types';
import { eatOrDrink } from './bag';

export const ACTION_SLOTS = 8;
export type ActionBar = Array<ProvisionId | null>;
export const emptyActionBar = (): ActionBar => Array.from({ length: ACTION_SLOTS }, () => null);

// Puts `item` in slot `i` (food or drink only; one slot each: moved from another it was in); whether it did.
export function setAction(hero: Pick<Hero, 'actionBar'>, i: number, item: string): boolean {
  if (!isProvision(item) || i < 0 || i >= ACTION_SLOTS) return false;
  const was = hero.actionBar.indexOf(item);
  if (was >= 0) hero.actionBar[was] = hero.actionBar[i]; // (swapped with what was there)
  hero.actionBar[i] = item;
  return true;
}

// Slots `a` and `b`, swapped.
export function swapActions(hero: Pick<Hero, 'actionBar'>, a: number, b: number): void {
  [hero.actionBar[a], hero.actionBar[b]] = [hero.actionBar[b] ?? null, hero.actionBar[a] ?? null];
}

// Slot `i`, cleared.
export function clearAction(hero: Pick<Hero, 'actionBar'>, i: number): void {
  if (i >= 0 && i < ACTION_SLOTS) hero.actionBar[i] = null;
}

// Uses slot `i`: one of what it points at eaten or drunk from the bag; whether it was (something there, carried, and
// they're not still at another meal).
export function useAction(hero: Hero, i: number): boolean {
  const item = hero.actionBar[i];
  return !!item && eatOrDrink(hero, item);
}

// The bar as kept in a save: each slot food or drink, else empty (older saves: all empty).
export const readActionBar = (saved: unknown): ActionBar =>
  Array.from({ length: ACTION_SLOTS }, (_, i) => {
    const item = Array.isArray(saved) ? saved[i] : null;
    return typeof item === 'string' && isProvision(item) ? item : null;
  });
