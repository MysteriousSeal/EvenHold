// A pedlar's pack (travellers.ts): food and drink for the road (bread, an
// apple, cheese, an ale), a potion or two (loot/potions.ts: the greater ones rare), a bag or two to fit
// (loot/bags.ts), a fishing rod (loot/tools.ts: every pedlar has one), and the trinkets pedlars carry (every item marked
// soldBy pedlar: charms, rings, pendants), a few of each and a few silver; and bundles of firewood, for a campfire to
// cook over (skills/cooking.ts).
// They'll buy back the same sorts of things (and junk, as anyone does), raw fish at its worth (skills/fishing.ts), and a
// lumberjack's logs for firewood, and what's found in the wood (resin, heartwood) at half, a few at a time
// (skills/lumber.ts), and a woodworker's wares at their worth (WARES); and relics (RELICS: bone charms off the crypts'
// dead, a ghost's shroud) at twice what junk fetches, a few at a time, to sell on to pilgrims as a saint's. The
// same prices as at the inn and the smith's. Their shop kept by their id
// (PEDLAR_KEY on), in the save with the rest.

import { ITEMS, ITEM_IDS, isJewelrySlot, type ItemId } from '../human/equipment';
import { isGear, slotOfGear, type GearKey } from '../human/items/gear';
import { isProvision, type ProvisionId } from '../loot/provisions';
import { INGREDIENTS } from '../loot/ingredients';
import { BAG_IDS, BAG_ITEMS, isBagItem } from '../loot/bags';
import { SHOP_POTIONS, isPotion, potionPrice } from '../loot/potions';
import { TOOL_ITEMS } from '../loot/tools';
import { LOOT } from '../loot/loot';
import { isFish } from '../skills/fishing';
import { buyPrice, sellPrice } from '../inn/tavernShop';
import { gearPrice, gearSellPrice } from '../smithy/smithShop';
import { buyFrom, openShop, sellTo, type Shop, type Usual } from '../shops/shopStock';
import type { BagItem } from '../hero/bag';
import type { Hero } from '../types';
import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';
import { PEDLAR_KEY, type Traveller } from './travellers';

const FOOD: readonly ProvisionId[] = ['bread', 'apple', 'cheese', 'ale'];
export const PEDLAR_TRINKETS: readonly ItemId[] = ITEM_IDS.filter((id) => (ITEMS[id].soldBy?.pedlar ?? 0) > 0);
export const PEDLAR_WARES: readonly BagItem[] = [...FOOD, 'firewood', ...SHOP_POTIONS, ...PEDLAR_TRINKETS, ...BAG_IDS, 'fishingRod']; // (and bags: hero/bagSlots.ts; a rod, for the angler)

// What they'll buy: food and drink, and trinkets (what goes round a neck or on a finger).
// (And the silver and stones salvaged from gear, skills/salvage.ts, as they buy trinkets: at half their worth.)
const FINERY: ReadonlySet<string> = new Set(['silverFilings', 'gemShard', 'cutGem']);
// (And logs, for firewood to sell on, at their worth; and a pine's resin, an ancient oak's heartwood, at half.)
const LOGS: ReadonlySet<string> = new Set(['birchLog', 'pineLog', 'oakLog']);
const FOUND: ReadonlySet<string> = new Set(['pineResin', 'heartwood', 'oakBurl']);
// A woodworker's wares (skills/woodworking.ts: cups, a casket, a cask, a chest): not junk to be had off anyone, but
// goods a pedlar takes at their worth (and the inn its cups and casks, at her own price: inn/tavernShop.ts INN_WANTS).
export const WARES: ReadonlySet<string> = new Set(['woodenBowl', 'carvedTankard', 'varnishedCasket', 'oakCask', 'oakChest']);
// Relics: what's had off the dead, to be sold on to the pilgrims as a saint's (a finger bone with a hole bored in it,
// as the carter's was: story/quests/firstQuestsWatch.ts; a shroud), at RELIC_PREMIUM, RELICS_WANTED of each at a time.
export const RELICS: ReadonlySet<string> = new Set(['boneCharm', 'tatteredShroud']);
export const isRelic = (id: string): boolean => RELICS.has(id);
const RELIC_PREMIUM = 2;
const RELICS_WANTED = 4;
export const wantsRelic = (shop: Shop, id: string): boolean => !isRelic(id) || (shop.bought?.[id] ?? 0) < RELICS_WANTED;
export const pedlarBuys = (id: string): id is BagItem => isRelic(id) || isProvision(id) || isPotion(id) || isBagItem(id) || id === 'fishingRod' || isFish(id) || FINERY.has(id) || LOGS.has(id) || FOUND.has(id) || WARES.has(id) || (isGear(id) && isJewelrySlot(slotOfGear(id)));

export const pedlarPrice = (id: BagItem, selling: boolean, hero?: Hero): number => // (`hero`'s gear worn: less, as at the smith's)
  isRelic(id) ? LOOT[id as keyof typeof LOOT].value * RELIC_PREMIUM : id === 'firewood' ? INGREDIENTS.firewood.value : LOGS.has(id) || WARES.has(id) ? LOOT[id as keyof typeof LOOT].value : FOUND.has(id) ? Math.floor(LOOT[id as keyof typeof LOOT].value / 2) : FINERY.has(id) ? Math.floor(LOOT[id as keyof typeof LOOT].value / (selling ? 2 : 1)) : isProvision(id) ? (selling ? sellPrice(id) : buyPrice(id)) : isPotion(id) ? potionPrice(id, selling) : isBagItem(id) ? (selling ? Math.floor(BAG_ITEMS[id].value / 2) : BAG_ITEMS[id].value) : id === 'fishingRod' ? (selling ? Math.floor(TOOL_ITEMS.fishingRod.value / 2) : TOOL_ITEMS.fishingRod.value) : isFish(id) ? LOOT[id].value : selling ? gearSellPrice(id as GearKey, hero) : gearPrice(id as GearKey);

// What the pedlar `t` carries when their pack's full: the same pedlar, the same pack (a trinket or a potion they
// don't carry, they never have).
function usualOf(seed: number, t: Pick<Traveller, 'id'>): Usual {
  const roll = (salt: number) => hashUnit(t.id, seed % 1_000_003, salt);
  const stock: Partial<Record<BagItem, number>> = {};
  FOOD.forEach((id, i) => (stock[id] = 1 + Math.floor(roll(10 + i) * 3)));
  stock.firewood = 3 + Math.floor(roll(20) * 4); // (a few bundles)
  PEDLAR_TRINKETS.forEach((id, i) => (stock[id] = roll(30 + i) < 0.6 ? ITEMS[id].soldBy!.pedlar! : 0));
  SHOP_POTIONS.forEach((id, i) => (stock[id] = roll(40 + i) < (id.startsWith('greater') ? 0.15 : 0.6) ? 1 + Math.floor(roll(45 + i) * 2) : 0)); // (a potion or two, a greater one rarely)
  BAG_IDS.forEach((id, i) => (stock[id] = roll(50 + i) < 0.5 - i * 0.08 ? 1 : 0)); // (a bag or two, the finer ones rarer)
  stock.fishingRod = 1; // (every pedlar has a rod)
  return { money: Math.round((1 + roll(99) * 2) * COPPER_PER_SILVER), stock };
}

// The pack of the pedlar `t`, made the first time it's opened.
export const pedlarShopAt = (shops: Map<number, Shop>, seed: number, t: Pick<Traveller, 'id'>, now = Date.now()): Shop => openShop(shops, PEDLAR_KEY + t.id, usualOf(seed, t), now);

// Their wares, as their window lists them: what they carry (sold out, it's back with a restock), not what they never do.
export const pedlarWaresOf = (seed: number, t: Pick<Traveller, 'id'>): BagItem[] => {
  const { stock } = usualOf(seed, t);
  return PEDLAR_WARES.filter((id) => (stock[id] ?? 0) > 0);
};

// The hero buying `id` from the pedlar, or selling it them.
export const buyFromPedlar = (shop: Shop, hero: Hero, id: BagItem) => buyFrom(shop, hero, id, pedlarPrice(id, false));
export function sellToPedlar(shop: Shop, hero: Hero, id: BagItem) {
  if (!pedlarBuys(id) || !wantsRelic(shop, id)) return 'not wanted';
  const result = sellTo(shop, hero, id, pedlarPrice(id, true, hero));
  if (result === 'sold' && isRelic(id)) (shop.bought ??= {})[id] = (shop.bought[id] ?? 0) + 1; // (sold on to the pilgrims a restock at a time, as a trade's goods)
  return result;
}

