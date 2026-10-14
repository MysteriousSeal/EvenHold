// A village's herbalist's shop (npcs.ts spawns them, at home in the house
// nearest their village's middle, and trades from there: E by them): every
// potion (loot/potions.ts), the minor ones by the handful, a greater one now
// and then; and they buy potions back, and the raw ingredients they brew
// with (loot/ingredients.ts: from the wild, not logs, planks or scrap). Kept by their id (HERBALIST_KEY on), in the
// save with the rest.

import { LOOT } from '../loot/loot';
import { isIngredient } from '../loot/ingredients';
import { POTION_IDS, isPotion, potionPrice, type PotionId } from '../loot/potions';
import { buyFrom, openShop, sellTo, type Shop } from '../shops/shopStock';
import type { BagItem } from '../hero/bag';
import type { Hero } from '../types';
import type { Npc } from '../npcs/npcs';
import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';

export const HERBALIST_KEY = 2 ** 44; // a herbalist's shop's key among the shops (theirs, by id, past the pedlars')
const USUAL: Record<'minor' | 'lesser' | 'greater', number> = { minor: 4, lesser: 2, greater: 1 }; // of each potion, restocked to

export const HERBALIST_WARES: readonly BagItem[] = POTION_IDS;

// The ingredients they'll buy: what's had from the wild (a beast's meat, a catch, a bear's honeycomb, a pine's resin,
// an ancient oak's heartwood), not what's felled, worked or salvaged (logs, planks, scrap: a crafter's, kept for their
// work), nor what the shops sell (salt, flour, firewood).
const WILD: ReadonlySet<string> = new Set(['rawBoarMeat', 'rawWolfMeat', 'rawBearMeat', 'honeycomb', 'leanLynxMeat', 'smallFry', 'riverTrout', 'lakePerch', 'pike', 'pineResin', 'heartwood']);

// What they'll buy: potions, and ingredients from the wild.
export const herbalistBuys = (id: string): id is BagItem => isPotion(id) || (isIngredient(id) && WILD.has(id));

// What a potion costs here, or a potion or an ingredient fetches (an ingredient its worth).
export const herbalistPrice = (id: BagItem, selling: boolean): number => (isPotion(id) ? potionPrice(id, selling) : LOOT[id as keyof typeof LOOT].value);

const tierOf = (id: PotionId) => (id.startsWith('minor') ? 'minor' : id.startsWith('lesser') ? 'lesser' : 'greater');

// The shop of herbalist `npc`, made the first time it's opened.
export function herbalistShopAt(shops: Map<number, Shop>, seed: number, npc: Pick<Npc, 'id'>, now = Date.now()): Shop {
  const stock: Partial<Record<BagItem, number>> = {};
  for (const id of POTION_IDS) stock[id] = USUAL[tierOf(id)];
  return openShop(shops, HERBALIST_KEY + npc.id, { money: Math.round((2 + hashUnit(npc.id, seed % 1_000_003, 91) * 3) * COPPER_PER_SILVER), stock }, now);
}

// The hero buying `id` from the herbalist, or selling it them.
export const buyFromHerbalist = (shop: Shop, hero: Hero, id: BagItem) => buyFrom(shop, hero, id, herbalistPrice(id, false));
export const sellToHerbalist = (shop: Shop, hero: Hero, id: BagItem) => (herbalistBuys(id) ? sellTo(shop, hero, id, herbalistPrice(id, true)) : 'not wanted');
