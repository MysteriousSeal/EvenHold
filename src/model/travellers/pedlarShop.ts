// A pedlar's pack (travellers.ts): food and drink for the road (bread, an
// apple, cheese, an ale), a bag or two to fit (loot/bags.ts), and the trinkets pedlars carry (every item marked
// soldBy pedlar: charms, rings, pendants), a few of each and a few silver.
// They'll buy back the same sorts of things (and junk, as anyone does). The
// same prices as at the inn and the smith's. Their shop kept by their id
// (PEDLAR_KEY on), in the save with the rest.

import { ITEMS, ITEM_IDS, isJewelrySlot, type ItemId } from '../human/equipment';
import { isProvision, type ProvisionId } from '../loot/provisions';
import { BAG_IDS, BAG_ITEMS, isBagItem } from '../loot/bags';
import { buyPrice, sellPrice } from '../inn/tavernShop';
import { gearPrice, gearSellPrice } from '../smithy/smithShop';
import { buyFrom, openShop, sellTo, type Shop } from '../shops/shopStock';
import type { BagItem } from '../hero/bag';
import type { Hero } from '../types';
import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';
import { PEDLAR_KEY, type Traveller } from './travellers';

const FOOD: readonly ProvisionId[] = ['bread', 'apple', 'cheese', 'ale'];
export const PEDLAR_TRINKETS: readonly ItemId[] = ITEM_IDS.filter((id) => (ITEMS[id].soldBy?.pedlar ?? 0) > 0);
export const PEDLAR_WARES: readonly BagItem[] = [...FOOD, ...PEDLAR_TRINKETS, ...BAG_IDS]; // (and bags: hero/bagSlots.ts)

// What they'll buy: food and drink, and trinkets (what goes round a neck or on a finger).
export const pedlarBuys = (id: string): id is BagItem => isProvision(id) || isBagItem(id) || (id in ITEMS && isJewelrySlot(ITEMS[id as ItemId].slot));

export const pedlarPrice = (id: BagItem, selling: boolean): number =>
  isProvision(id) ? (selling ? sellPrice(id) : buyPrice(id)) : isBagItem(id) ? (selling ? Math.floor(BAG_ITEMS[id].value / 2) : BAG_ITEMS[id].value) : selling ? gearSellPrice(id as ItemId) : gearPrice(id as ItemId);

// The pack of the pedlar `t`, made the first time it's opened.
export function pedlarShopAt(shops: Map<number, Shop>, seed: number, t: Pick<Traveller, 'id'>, now = Date.now()): Shop {
  const roll = (salt: number) => hashUnit(t.id, seed % 1_000_003, salt);
  const stock: Partial<Record<BagItem, number>> = {};
  FOOD.forEach((id, i) => (stock[id] = 1 + Math.floor(roll(10 + i) * 3)));
  PEDLAR_TRINKETS.forEach((id, i) => (stock[id] = roll(30 + i) < 0.6 ? ITEMS[id].soldBy!.pedlar! : 0));
  BAG_IDS.forEach((id, i) => (stock[id] = roll(50 + i) < 0.5 - i * 0.08 ? 1 : 0)); // (a bag or two, the finer ones rarer)
  return openShop(shops, PEDLAR_KEY + t.id, { money: Math.round((1 + roll(99) * 2) * COPPER_PER_SILVER), stock }, now);
}

// The hero buying `id` from the pedlar, or selling it them.
export const buyFromPedlar = (shop: Shop, hero: Hero, id: BagItem) => buyFrom(shop, hero, id, pedlarPrice(id, false));
export const sellToPedlar = (shop: Shop, hero: Hero, id: BagItem) => (pedlarBuys(id) ? sellTo(shop, hero, id, pedlarPrice(id, true)) : 'not wanted');

