// Ingredients: raw food for cooking (none yet), dropped by foes and, till
// then, only good for selling. Each says who drops it and how often, as junk does.

import type { LootEntry } from './lootEntry';

export const INGREDIENTS = {
  // From boars: a raw haunch, the likeliest thing a boar leaves.
  rawBoarMeat: { name: 'Raw boar meat', value: 5, droppedBy: { boar: 4 } },
  // From wolves: a lean, stringy cut, as likely as a fang.
  rawWolfMeat: { name: 'Raw wolf meat', value: 4, droppedBy: { beast: 3 } },
} satisfies Record<string, LootEntry>;

export type IngredientId = keyof typeof INGREDIENTS;
export const isIngredient = (item: string): item is IngredientId => item in INGREDIENTS;
