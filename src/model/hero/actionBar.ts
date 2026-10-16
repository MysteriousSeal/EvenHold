// The hero's action bar: ACTION_SLOTS shortcuts to food, drink and potions
// in their bag (WoW's way: a slot points at a kind of thing, never holds it),
// each used with its key (1 to 8) or a click, one taken from the bag and
// eaten or drunk (bag.ts eatOrDrink, drinkPotion). Emptied, the slot stays,
// waiting for more. Food, drink or a potion new to the bag goes on the first empty slot by itself (fillNew). A spell the hero knows goes on it too (spells/spells.ts: by its key), cast with the slot's key
// (GameModel.useAction).

import { isTool, type ToolId } from '../loot/tools';
import { isProvision, type ProvisionId } from '../loot/provisions';
import { isPotion, type PotionId } from '../loot/potions';
import { isSpellKey, type SpellKey } from '../spells/spells';
import type { Hero } from '../types';
import { drinkPotion, eatOrDrink, potionRefused } from './bag';

export const ACTION_SLOTS = 8;
export type ActionBar = Array<ProvisionId | PotionId | ToolId | SpellKey | null>;
// What may go on it: food, drink, a potion.
export const usable = (item: string): item is ProvisionId | PotionId | ToolId | SpellKey => isProvision(item) || isPotion(item) || isTool(item) || isSpellKey(item);
export const emptyActionBar = (): ActionBar => Array.from({ length: ACTION_SLOTS }, () => null);

// Puts `item` in slot `i` (food, drink, a potion or a tool only; one slot each: moved from another it was in); whether it did.
export function setAction(hero: Pick<Hero, 'actionBar'>, i: number, item: string): boolean {
  if (!usable(item) || i < 0 || i >= ACTION_SLOTS) return false;
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

// Uses slot `i`: one of what it points at eaten or drunk from the bag (a potion at once); whether it was (something
// there, carried, and they're not still at another meal, or the potions' wait not over).
// (`refused`: told why a potion can't be drunk just now, if it can't: bag.ts potionRefused.)
export function useAction(hero: Hero, i: number, refused?: (why: string) => void): boolean {
  const item = hero.actionBar[i];
  const why = item && isPotion(item) ? potionRefused(hero, item) : null;
  if (why) return refused?.(why), false;
  return !!item && !isTool(item) && !isSpellKey(item) && (isPotion(item) ? drinkPotion(hero, item) : eatOrDrink(hero, item)); // (a tool: the game's to use, GameModel.useAction)
}

// The bar as kept in a save: each slot food, drink or a potion, else empty (older saves: all empty).
export const readActionBar = (saved: unknown): ActionBar =>
  Array.from({ length: ACTION_SLOTS }, (_, i) => {
    const item = Array.isArray(saved) ? saved[i] : null;
    return typeof item === 'string' && usable(item) ? item : null;
  });

// Food, drink or a potion new to the bag (none of it carried before: `carried`, kept between calls) put on the first
// empty slot by itself, unless it's on the bar already (a newcomer given loaves, never told to drag them there); what's
// on the bar never moved, a full bar left be.
export function fillNew(hero: Pick<Hero, 'actionBar' | 'bag'>, carried: Set<string>): void {
  for (const [item, count] of Object.entries(hero.bag)) {
    if (!count || carried.has(item)) continue;
    carried.add(item);
    if (!(isProvision(item) || isPotion(item)) || hero.actionBar.includes(item)) continue;
    const free = hero.actionBar.indexOf(null);
    if (free >= 0) hero.actionBar[free] = item;
  }
  for (const item of carried) if (!hero.bag[item as keyof Hero['bag']]) carried.delete(item); // (all eaten: new again when more comes)
}
