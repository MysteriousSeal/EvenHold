// Ingredients: raw food for cooking (none yet), dropped by foes and, till
// then, only good for selling. Each says who drops it and how often, as junk does.

import type { LootEntry } from './lootEntry';

export const INGREDIENTS = {
  // From boars: a raw haunch, the likeliest thing a boar leaves.
  rawBoarMeat: { name: 'Raw boar meat', value: 5, droppedBy: { boar: 4 } },
  // From wolves: a lean, stringy cut, as likely as a fang.
  rawWolfMeat: { name: 'Raw wolf meat', value: 4, droppedBy: { beast: 3 } },
  // From bears: a thick slab of meat, the likeliest; and the honeycomb it was raiding, now and then.
  rawBearMeat: { name: 'Raw bear meat', value: 8, droppedBy: { bear: 4 } },
  honeycomb: { name: 'Honeycomb', value: 9, droppedBy: { bear: 2 } },
  // From lynxes: a lean cut.
  leanLynxMeat: { name: 'Lean lynx meat', value: 6, droppedBy: { lynx: 3 } },
} satisfies Record<string, LootEntry>;

export type IngredientId = keyof typeof INGREDIENTS;
export const isIngredient = (item: string): item is IngredientId => item in INGREDIENTS;
