// The inn's shop, kept by its barmaid: food and drink (provisions.ts) she
// sells, and buys back. She has only so much of each, and only so much
// money: it grows when the hero buys, shrinks when she buys from them. Her
// wares and purse start from the seed and slowly come back toward that as
// real time passes (five minutes at a time), even between visits.

import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';
import { addToBag, takeFromBag } from '../hero/bag';
import { PROVISIONS, PROVISION_IDS, isProvision, type ProvisionId } from '../loot/provisions';
import type { Hero } from '../types';

export interface Shop {
  money: number; // copper in her purse
  stock: Partial<Record<ProvisionId, number>>;
  restockedAt: number; // when she last restocked (ms, wall clock)
}

export const RESTOCK_EVERY = 5 * 60_000; // ms: every five minutes, one more of each she's short of
const PURSE_DRIFT = 0.1; // of the way back to her usual purse, each restock

// What she starts with, and restocks toward: a few silver, a few of each.
function usual(seed: number, inn: number): { money: number; stock: Record<ProvisionId, number> } {
  const roll = (salt: number) => hashUnit(inn, seed % 1_000_003, salt);
  const stock = Object.fromEntries(PROVISION_IDS.map((id, i) => [id, 2 + Math.floor(roll(100 + i) * 5)])) as Record<ProvisionId, number>;
  return { money: Math.round((2 + roll(99) * 3) * COPPER_PER_SILVER), stock };
}

// The shop at the inn whose door is `inn` (its index among the world's doors), made on first visit.
export function shopAt(shops: Map<number, Shop>, seed: number, inn: number, now = Date.now()): Shop {
  let shop = shops.get(inn);
  if (!shop) {
    const start = usual(seed, inn);
    shop = { money: start.money, stock: { ...start.stock }, restockedAt: now };
    shops.set(inn, shop);
  }
  restock(shop, usual(seed, inn), now);
  return shop;
}

// Every barmaid back to her usual wares and purse at once (a cheat); those
// not yet visited start that way anyway. Returns how many were restocked.
export function restockAll(shops: Map<number, Shop>, seed: number, now = Date.now()): number {
  for (const [inn, shop] of shops) {
    const base = usual(seed, inn);
    Object.assign(shop, { money: base.money, stock: { ...base.stock }, restockedAt: now });
  }
  return shops.size;
}

function restock(shop: Shop, base: ReturnType<typeof usual>, now: number): void {
  const restocks = Math.floor((now - shop.restockedAt) / RESTOCK_EVERY);
  if (restocks <= 0) return;
  for (const id of PROVISION_IDS) shop.stock[id] = Math.min(base.stock[id], (shop.stock[id] ?? 0) + restocks);
  for (let i = 0; i < Math.min(restocks, 60); i++) shop.money += Math.round((base.money - shop.money) * PURSE_DRIFT);
  shop.restockedAt += restocks * RESTOCK_EVERY;
}

// How long until her next restock (ms): what's sold out comes back then.
export function restockIn(shop: Shop, now = Date.now()): number {
  return Math.max(0, shop.restockedAt + RESTOCK_EVERY - now);
}

export const buyPrice = (id: ProvisionId): number => PROVISIONS[id].value;
export const sellPrice = (id: ProvisionId): number => Math.max(1, Math.floor(PROVISIONS[id].value / 2)); // she buys at half

// The hero buys one of `id`: why not, if they can't (she's none, they're short).
export function buy(shop: Shop, hero: Hero, id: ProvisionId): 'bought' | 'sold out' | 'too poor' {
  if (!(shop.stock[id] ?? 0)) return 'sold out';
  if (hero.money < buyPrice(id)) return 'too poor';
  hero.money -= buyPrice(id);
  shop.money += buyPrice(id);
  shop.stock[id] = (shop.stock[id] ?? 0) - 1;
  addToBag(hero.bag, id);
  return 'bought';
}

// The hero sells her one of `id` (only food and drink): why not, if not.
export function sell(shop: Shop, hero: Hero, id: string): 'sold' | 'not wanted' | 'none' | 'she is short' {
  if (!isProvision(id)) return 'not wanted';
  if (!(hero.bag[id] ?? 0)) return 'none';
  if (shop.money < sellPrice(id)) return 'she is short';
  takeFromBag(hero.bag, id);
  hero.money += sellPrice(id);
  shop.money -= sellPrice(id);
  shop.stock[id] = (shop.stock[id] ?? 0) + 1;
  return 'sold';
}
