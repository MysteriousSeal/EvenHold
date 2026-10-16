// A village's herbalist's shop (npcs.ts spawns them, at home in the house
// nearest their village's middle, and trades from there: E by them): every
// potion (loot/potions.ts), the minor ones by the handful, a greater one now
// and then; and they buy potions back, and the raw ingredients they brew
// with (loot/ingredients.ts: from the wild, not logs, planks or scrap), and the herbs an alchemist picks. Kept by
// their id (HERBALIST_KEY on), in the save with the rest. As the hero levels they sell stronger brews (BREWS_AT: the
// cures and draughts, then the superior potions), and a brewer's kit; and they brew to order from the hero's own
// herbs, for a fee (brewToOrder).

import { LOOT } from '../loot/loot';
import { isIngredient } from '../loot/ingredients';
import { isFish } from '../skills/fishing';
import { POTIONS, SHOP_POTIONS, isPotion, potionPrice, type PotionId } from '../loot/potions';
import { isHerb } from '../loot/herbs';
import { TOOL_ITEMS } from '../loot/tools';
import { addToBag, takeFromBag } from '../hero/bag';
import { canSwap } from '../hero/bagSlots';
import { BREW_RECIPES, BREW_RECIPE_IDS, type BrewRecipeId } from '../skills/alchemy';
import type { LootId } from '../loot/loot';
import { WANTS, buyFrom, openShop, sellTo, type Shop } from '../shops/shopStock';
import type { BagItem } from '../hero/bag';
import type { Hero } from '../types';
import type { Npc } from '../npcs/npcs';
import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';

export const HERBALIST_KEY = 2 ** 44; // a herbalist's shop's key among the shops (theirs, by id, past the pedlars')
const USUAL: Record<'minor' | 'lesser' | 'greater', number> = { minor: 4, lesser: 2, greater: 1 }; // of each potion, restocked to

// The stronger brews, each on their shelf from a level of the hero's (a level-20 hero isn't sold a level-1 hero's
// minors alone): the cures first, the draughts, then the superior potions. The pox salve's their own to put on (hero/pox.ts),
// and a love-philtre's no brew of theirs.
export const BREWS_AT: ReadonlyArray<[PotionId, number]> = [['antidote', 3], ['purge', 3], ['swiftDraught', 6], ['shadowDraught', 6], ['oxDraught', 10], ['barkDraught', 10], ['superiorEnergyPotion', 14], ['superiorHealthPotion', 14], ['hawkDraught', 18]];
export const KIT = 'brewersKit';

// What they sell a hero at `level`: the six, the brews reached, and a brewer's kit.
export const herbalistWares = (level: number): BagItem[] => [...SHOP_POTIONS, ...BREWS_AT.filter(([, at]) => level >= at).map(([id]) => id), KIT];
export const HERBALIST_WARES: readonly BagItem[] = herbalistWares(Infinity); // (everything they ever sell)

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
export const herbalistBuys = (id: string): id is BagItem => isPotion(id) || isCavePart(id) || (isIngredient(id) && (WILD.has(id) || isFish(id) || isHerb(id)));

// What she pays for a brew (as much as for one bought, at the least): more than its herbs would fetch raw, the more the
// higher the skill it wants (BREW_MARGIN times them, and the skill's share of the top's 1 more); its dearest recipe's.
const BREW_MARGIN = 1.5;
const UNDER_HER_PRICE = 0.9; // and never more than so much of what she sells one for (else bought of her and sold back: coin for nothing)
const TOP_SKILL = 270;
const brewPaid = (potion: PotionId): number =>
  Math.min(
    Math.floor(potionPrice(potion, false) * UNDER_HER_PRICE),
    Math.max(0, ...BREW_RECIPE_IDS.filter((id) => BREW_RECIPES[id].makes === potion).map((id) => {
      const { from, needs } = BREW_RECIPES[id];
      const herbs = Object.entries(from).reduce((sum, [herb, n]) => sum + herbalistPrice(herb as BagItem, true) * (n as number), 0); // (as she'd pay for them raw)
      return Math.ceil(herbs * (BREW_MARGIN + needs / TOP_SKILL));
    })),
  );

// What a potion costs here, or a potion or an ingredient fetches (an ingredient its worth; a cave part more).
export const herbalistPrice = (id: BagItem, selling: boolean): number => (isPotion(id) ? (selling ? Math.max(potionPrice(id, true), brewPaid(id)) : potionPrice(id, false)) : id === KIT ? TOOL_ITEMS.brewersKit.value : Math.round(LOOT[id as keyof typeof LOOT].value * (isCavePart(id) ? CAVE_PREMIUM : 1)));

// Whether they'd take another of a cave part at their price (fewer than WANTS.goods bought of it, not yet sold on).
export const wantsPart = (shop: Shop, id: string): boolean => !isCavePart(id) || (shop.bought?.[id] ?? 0) < WANTS.goods;

const tierOf = (id: PotionId) => (id.startsWith('minor') ? 'minor' : id.startsWith('lesser') ? 'lesser' : 'greater');

// The shop of herbalist `npc`, made the first time it's opened.
export function herbalistShopAt(shops: Map<number, Shop>, seed: number, npc: Pick<Npc, 'id'>, now = Date.now()): Shop {
  const stock: Partial<Record<BagItem, number>> = { [KIT]: 1 };
  for (const id of SHOP_POTIONS) stock[id] = USUAL[tierOf(id)];
  for (const [id] of BREWS_AT) stock[id] = id.startsWith('superior') ? 1 : 2;
  return openShop(shops, HERBALIST_KEY + npc.id, { money: Math.round((2 + hashUnit(npc.id, seed % 1_000_003, 91) * 3) * COPPER_PER_SILVER), stock }, now);
}

// The hero buying `id` from the herbalist, or selling it them.
export const buyFromHerbalist = (shop: Shop, hero: Hero, id: BagItem) => (isPotion(id) || id === KIT ? buyFrom(shop, hero, id, herbalistPrice(id, false)) : 'sold out'); // (only their potions and kits: what's sold them, into the pot)
export function sellToHerbalist(shop: Shop, hero: Hero, id: BagItem): ReturnType<typeof sellTo> {
  if (!herbalistBuys(id) || !wantsPart(shop, id)) return 'not wanted';
  const result = sellTo(shop, hero, id, herbalistPrice(id, true));
  if (result === 'sold' && isCavePart(id)) (shop.bought ??= {})[id] = (shop.bought[id] ?? 0) + 1; // (junk to the shops: counted here, sold on a restock at a time as any trade's goods)
  return result;
}

// Brewing to order: any of an alchemist's recipes up to ORDER_MOST of the skill (the superiors and the hawk-eye beyond
// them), from the hero's own herbs and parts, whatever the hero's own skill, for a fee: ORDER_FEE of the brew's worth
// (ORDER_LEAST at the least), into their purse. The herbs and the fee come to well under the brew's price.
export const ORDER_MOST = 200;
const ORDER_FEE = 0.3;
const ORDER_LEAST = 5;
export const orderFee = (id: BrewRecipeId): number => Math.max(ORDER_LEAST, Math.round(POTIONS[BREW_RECIPES[id].makes].value * ORDER_FEE));
const hasFor = (hero: Hero, id: BrewRecipeId) => Object.entries(BREW_RECIPES[id].from).every(([item, n]) => (hero.bag[item as LootId] ?? 0) >= n!);

// What they'd brew from what the hero carries: of the recipes within them the bag has the makings of, the dearest
// brew (null: none).
export function orderFor(hero: Hero): BrewRecipeId | null {
  const can = BREW_RECIPE_IDS.filter((id) => BREW_RECIPES[id].needs <= ORDER_MOST && hasFor(hero, id));
  return can.sort((a, b) => POTIONS[BREW_RECIPES[b].makes].value - POTIONS[BREW_RECIPES[a].makes].value)[0] ?? null;
}

// One of `id` brewed for the hero: its makings out of their bag, the fee to the herbalist's purse, the brew in the bag;
// why not, if not (beyond them, the makings short, the fee short, no room).
export function brewToOrder(shop: Shop, hero: Hero, id: BrewRecipeId): 'brewed' | 'beyond' | 'short' | 'too poor' | 'full' {
  const recipe = BREW_RECIPES[id];
  if (recipe.needs > ORDER_MOST) return 'beyond';
  if (!hasFor(hero, id)) return 'short';
  const fee = orderFee(id);
  if (hero.money < fee) return 'too poor';
  if (!canSwap(hero, recipe.from, [recipe.makes])) return 'full';
  for (const [item, n] of Object.entries(recipe.from)) for (let i = 0; i < n!; i++) takeFromBag(hero.bag, item as LootId);
  addToBag(hero.bag, recipe.makes);
  hero.money -= fee;
  shop.money += fee;
  return 'brewed';
}
