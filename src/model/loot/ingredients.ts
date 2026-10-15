// Ingredients: raw food for cooking (skills/cooking.ts), dropped by foes, caught or bought; and the logs a lumberjack
// fells, and what's worked or salvaged. Each says who drops it and how often, as junk does (the rest: no one).

import { hashUnit } from '../../util/random';
import type { LootEntry, LootSource } from './lootEntry';

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
  // Caught from a shore (skills/fishing.ts), not from foes: small fry and roach from anywhere, trout and eels in the
  // narrows, perch and char in open water, pike and sturgeon in the deep.
  smallFry: { name: 'Small fry', value: 2, droppedBy: {} },
  roach: { name: 'Roach', value: 3, droppedBy: {} },
  riverTrout: { name: 'River trout', value: 6, droppedBy: {} },
  lakePerch: { name: 'Lake perch', value: 6, droppedBy: {} },
  eel: { name: 'Eel', value: 9, droppedBy: {} },
  pike: { name: 'Pike', value: 14, droppedBy: {} },
  char: { name: 'Char', value: 18, droppedBy: {} },
  sturgeon: { name: 'Sturgeon', value: 26, droppedBy: {} },
  // Bought, not found: the inn's barmaid sells them, from her kitchen (inn/tavernShop.ts), for a cook's stews, pies and
  // feasts (skills/cooking.ts).
  salt: { name: 'Salt', value: 3, droppedBy: {} }, // a twist of coarse grey salt
  flour: { name: 'Flour', value: 4, droppedBy: {} }, // a small sack of it, milled in the valley
  // Sold by pedlars on the road (travellers/pedlarShop.ts): a bundle of firewood, to kindle a campfire with and cook over
  // (skills/cooking.ts), for whoever hasn't an axe.
  firewood: { name: 'Bundle of firewood', value: 3, droppedBy: {} },
  // From the trees a lumberjack fells (skills/lumber.ts), not from foes: logs, a birch's, a pine's, an oak's.
  birchLog: { name: 'Birch log', value: 2, droppedBy: {} }, // pale, light, quick to burn
  pineLog: { name: 'Pine log', value: 3, droppedBy: {} }, // straight and resinous
  oakLog: { name: 'Oak log', value: 5, droppedBy: {} }, // heavy, hard, the best of them
  // Found as they chop (lumber.ts): a pine's resin, an ancient or elder oak's heartwood, an elder oak's burl.
  pineResin: { name: 'Pine resin', value: 6, droppedBy: {} },
  heartwood: { name: 'Heartwood', value: 24, droppedBy: {} },
  oakBurl: { name: 'Oak burl', value: 60, droppedBy: {} }, // a knotted swelling off an elder oak's trunk, its grain swirled
  // Worked by a woodworker (woodworking.ts): planks from the logs, varnish from the resin.
  birchPlank: { name: 'Birch plank', value: 3, droppedBy: {} },
  pinePlank: { name: 'Pine plank', value: 5, droppedBy: {} },
  oakPlank: { name: 'Oak plank', value: 8, droppedBy: {} },
  varnish: { name: 'Varnish', value: 16, droppedBy: {} },
  // Salvaged from gear at a village's bench (skills/salvage.ts): what it was made of, and a finer thing from the rare.
  ironScrap: { name: 'Iron scrap', value: 4, droppedBy: {} },
  leatherStrip: { name: 'Leather strip', value: 3, droppedBy: {} },
  linenScrap: { name: 'Linen scrap', value: 2, droppedBy: {} },
  silverFilings: { name: 'Silver filings', value: 12, droppedBy: {} },
  gemShard: { name: 'Gem shard', value: 20, droppedBy: {} },
  temperedIngot: { name: 'Tempered ingot', value: 40, droppedBy: {} },
  cutGem: { name: 'Cut gem', value: 60, droppedBy: {} },
} satisfies Record<string, LootEntry>;

export type IngredientId = keyof typeof INGREDIENTS;
export const isIngredient = (item: string): item is IngredientId => item in INGREDIENTS;

// A beast slain is butchered besides whatever it drops (loot.ts rollDrop): its meat, on a roll of its own, as likely as
// a cook needs it (a boar's and a bear's more often than not), and now and then a bear's honeycomb. Each by the
// beast's id, so the same kill leaves the same.
export const BUTCHERED: Partial<Record<LootSource, ReadonlyArray<[IngredientId, number]>>> = {
  boar: [['rawBoarMeat', 0.6]],
  beast: [['rawWolfMeat', 0.4]], // (wolves, and a stronghold's war hounds)
  bear: [['rawBearMeat', 0.6], ['honeycomb', 0.25]],
  lynx: [['leanLynxMeat', 0.5]],
};
export const butcher = (source: LootSource, enemyId: number): IngredientId[] => (BUTCHERED[source] ?? []).filter(([, chance], i) => hashUnit(enemyId, 0, 81 + i) < chance).map(([item]) => item);
