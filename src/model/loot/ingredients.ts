// Ingredients: raw food for cooking (none yet), dropped by foes, and the logs a lumberjack fells; till they're of
// use, only good for selling. Each says who drops it and how often, as junk does (the logs: no one).

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
  // From the trees a lumberjack fells (skills/lumber.ts), not from foes: logs, a birch's, a pine's, an oak's.
  birchLog: { name: 'Birch log', value: 2, droppedBy: {} }, // pale, light, quick to burn
  pineLog: { name: 'Pine log', value: 3, droppedBy: {} }, // straight and resinous
  oakLog: { name: 'Oak log', value: 5, droppedBy: {} }, // heavy, hard, the best of them
} satisfies Record<string, LootEntry>;

export type IngredientId = keyof typeof INGREDIENTS;
export const isIngredient = (item: string): item is IngredientId => item in INGREDIENTS;
