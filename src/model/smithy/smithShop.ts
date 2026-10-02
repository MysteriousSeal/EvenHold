// The smithy's shop, kept by its smith: the weapons, shields and armour he
// forges (items marked `soldBy: { smith }`, at their value), and any gear of
// that kind bought back (at half its value; cloth and leather he's no use
// for, cheap). His stock and purse work as the inn's (shops/shopStock.ts).

import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';
import { ITEMS, ITEM_IDS, type ItemId } from '../human/equipment';
import type { Hero } from '../types';
import { buyFrom, openShop, sellTo, type Shop, type Usual } from '../shops/shopStock';

const SCRAP = 10; // copper for gear with no value of its own (bought back for its bits)
const JEWELRY = new Set(['neck', 'ring']); // not his trade

// What he forges and sells.
export const SMITH_WARES: ItemId[] = ITEM_IDS.filter((id) => (ITEMS[id].soldBy?.smith ?? 0) > 0);

// Whether he'll buy `id` off the hero: any weapon, shield or armour.
export const smithBuys = (id: string): id is ItemId => id in ITEMS && !JEWELRY.has(ITEMS[id as ItemId].slot);

// What he starts with, and restocks toward: his usual few of each (now and
// then one short, from the seed), and a purse of several silver.
function usual(seed: number, smithy: number): Usual {
  const roll = (salt: number) => hashUnit(smithy, seed % 1_000_003, salt);
  const stock = Object.fromEntries(SMITH_WARES.map((id, i) => [id, Math.max(0, ITEMS[id].soldBy!.smith! - (roll(200 + i) < 0.3 ? 1 : 0))]));
  return { money: Math.round((6 + roll(199) * 6) * COPPER_PER_SILVER), stock };
}

// The shop at the smithy whose door is `smithy` (its index among the world's doors), made on first visit.
export function smithShopAt(shops: Map<number, Shop>, seed: number, smithy: number, now = Date.now()): Shop {
  return openShop(shops, smithy, usual(seed, smithy), now);
}

export const gearPrice = (id: ItemId): number => ITEMS[id].value ?? SCRAP * 2;
export const gearSellPrice = (id: ItemId): number => (ITEMS[id].value ? Math.floor(ITEMS[id].value! / 2) : SCRAP); // he buys at half

export function buyGear(shop: Shop, hero: Hero, id: ItemId): 'bought' | 'sold out' | 'too poor' | 'full' {
  return buyFrom(shop, hero, id, gearPrice(id));
}

export function sellGear(shop: Shop, hero: Hero, id: string): 'sold' | 'not wanted' | 'none' | 'he is short' {
  if (!smithBuys(id)) return 'not wanted';
  const done = sellTo(shop, hero, id, gearSellPrice(id));
  return done === 'short' ? 'he is short' : done;
}
