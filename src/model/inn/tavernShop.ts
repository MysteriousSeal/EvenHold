// The inn's shop, kept by its barmaid: food and drink (provisions.ts) she
// sells, and buys back. She has only so much of each, and only so much
// money: it grows when the hero buys, shrinks when she buys from them. Her
// wares and purse start from the seed and slowly come back toward that as
// real time passes (five minutes at a time), even between visits.

import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';
import { PROVISIONS, PROVISION_IDS, isProvision, type ProvisionId } from '../loot/provisions';
import type { Hero } from '../types';
import { buyFrom, openShop, refill, sellTo, type Shop, type Usual } from '../shops/shopStock';

export { RESTOCK_EVERY, restockIn, type Shop } from '../shops/shopStock';

// What she starts with, and restocks toward: a few silver, a few of each.
function usual(seed: number, inn: number): Usual {
  const roll = (salt: number) => hashUnit(inn, seed % 1_000_003, salt);
  const stock = Object.fromEntries(PROVISION_IDS.map((id, i) => [id, 2 + Math.floor(roll(100 + i) * 5)]));
  return { money: Math.round((2 + roll(99) * 3) * COPPER_PER_SILVER), stock };
}

// The shop at the inn whose door is `inn` (its index among the world's doors), made on first visit.
export function shopAt(shops: Map<number, Shop>, seed: number, inn: number, now = Date.now()): Shop {
  return openShop(shops, inn, usual(seed, inn), now);
}

// Every barmaid back to her usual wares and purse at once (a cheat); those
// not yet visited start that way anyway (the smiths' shops, kept alongside,
// left be). Returns how many were restocked.
export function restockAll(shops: Map<number, Shop>, seed: number, now = Date.now()): number {
  let n = 0;
  for (const [inn, shop] of shops) {
    if (!Object.keys(shop.stock).some(isProvision)) continue; // a smith's
    refill(shop, usual(seed, inn), now);
    n++;
  }
  return n;
}

export const buyPrice = (id: ProvisionId): number => PROVISIONS[id].value;
export const sellPrice = (id: ProvisionId): number => Math.max(1, Math.floor(PROVISIONS[id].value / 2)); // she buys at half

// The hero buys one of `id`: why not, if they can't (she's none, they're short).
export function buy(shop: Shop, hero: Hero, id: ProvisionId): 'bought' | 'sold out' | 'too poor' {
  return buyFrom(shop, hero, id, buyPrice(id));
}

// The hero sells her one of `id` (only food and drink): why not, if not.
export function sell(shop: Shop, hero: Hero, id: string): 'sold' | 'not wanted' | 'none' | 'she is short' {
  if (!isProvision(id)) return 'not wanted';
  const done = sellTo(shop, hero, id, sellPrice(id));
  return done === 'short' ? 'she is short' : done;
}
