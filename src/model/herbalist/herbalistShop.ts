// A village's herbalist's shop (npcs.ts spawns them, at home in the house
// nearest their village's middle, and trades from there: E by them): every
// potion (loot/potions.ts), the minor ones by the handful, a greater one now
// and then; and they buy potions back, and the raw ingredients they brew
// with (loot/ingredients.ts: from the wild, not logs, planks or scrap). Kept by their id (HERBALIST_KEY on), in the
// save with the rest.

import { LOOT } from '../loot/loot';
import { isIngredient } from '../loot/ingredients';
import { isFish } from '../skills/fishing';
import { POTION_IDS, isPotion, potionPrice, type PotionId } from '../loot/potions';
import { WANTS, buyFrom, openShop, sellTo, type Shop } from '../shops/shopStock';
import type { BagItem } from '../hero/bag';
import type { Hero } from '../types';
import type { Npc } from '../npcs/npcs';
import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';

export const HERBALIST_KEY = 2 ** 44; // a herbalist's shop's key among the shops (theirs, by id, past the pedlars')
const USUAL: Record<'minor' | 'lesser' | 'greater', number> = { minor: 4, lesser: 2, greater: 1 }; // of each potion, restocked to

export const HERBALIST_WARES: readonly BagItem[] = POTION_IDS;

// The ingredients they'll buy: what's had from the wild (a beast's meat, a catch, a bear's honeycomb), not what's
// felled, found in the wood, worked or salvaged (logs, resin, heartwood, planks, scrap: a crafter's, kept for their
// work), nor what the shops sell (salt, flour, firewood).
const WILD: ReadonlySet<string> = new Set(['rawBoarMeat', 'rawWolfMeat', 'rawBearMeat', 'honeycomb', 'leanLynxMeat']); // (and any fish)

// And what's left of the caves' beasts that they've a use for (loot/junk.ts: junk to anyone else): silk to bind a wound,
// a venom gland for the numbing draught, a bat's wing for the fevers. At half as much again as anyone pays, so many of
// each at a time (WANTS.goods, kept as a trade's goods are: shops/shopStock.ts); past that, junk to them too.
const CAVE_PARTS: ReadonlySet<string> = new Set(['spiderSilk', 'venomGland', 'batWing']);
export const isCavePart = (id: string): boolean => CAVE_PARTS.has(id);
const CAVE_PREMIUM = 1.5;

// What they'll buy: potions, ingredients from the wild, and those cave parts.
export const herbalistBuys = (id: string): id is BagItem => isPotion(id) || isCavePart(id) || (isIngredient(id) && (WILD.has(id) || isFish(id)));

// What a potion costs here, or a potion or an ingredient fetches (an ingredient its worth; a cave part more).
export const herbalistPrice = (id: BagItem, selling: boolean): number => (isPotion(id) ? potionPrice(id, selling) : Math.round(LOOT[id as keyof typeof LOOT].value * (isCavePart(id) ? CAVE_PREMIUM : 1)));

// Whether they'd take another of a cave part at their price (fewer than WANTS.goods bought of it, not yet sold on).
export const wantsPart = (shop: Shop, id: string): boolean => !isCavePart(id) || (shop.bought?.[id] ?? 0) < WANTS.goods;

const tierOf = (id: PotionId) => (id.startsWith('minor') ? 'minor' : id.startsWith('lesser') ? 'lesser' : 'greater');

// The shop of herbalist `npc`, made the first time it's opened.
export function herbalistShopAt(shops: Map<number, Shop>, seed: number, npc: Pick<Npc, 'id'>, now = Date.now()): Shop {
  const stock: Partial<Record<BagItem, number>> = {};
  for (const id of POTION_IDS) stock[id] = USUAL[tierOf(id)];
  return openShop(shops, HERBALIST_KEY + npc.id, { money: Math.round((2 + hashUnit(npc.id, seed % 1_000_003, 91) * 3) * COPPER_PER_SILVER), stock }, now);
}

// The hero buying `id` from the herbalist, or selling it them.
export const buyFromHerbalist = (shop: Shop, hero: Hero, id: BagItem) => (isPotion(id) ? buyFrom(shop, hero, id, herbalistPrice(id, false)) : 'sold out'); // (only their potions: what's sold them, into the pot)
export function sellToHerbalist(shop: Shop, hero: Hero, id: BagItem): ReturnType<typeof sellTo> {
  if (!herbalistBuys(id) || !wantsPart(shop, id)) return 'not wanted';
  const result = sellTo(shop, hero, id, herbalistPrice(id, true));
  if (result === 'sold' && isCavePart(id)) (shop.bought ??= {})[id] = (shop.bought[id] ?? 0) + 1; // (junk to the shops: counted here, sold on a restock at a time as any trade's goods)
  return result;
}
