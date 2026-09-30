// A shop's stock and purse (the inn's barmaid's, the smith's), kept by its
// building's door (its index among the world's doors) and saved: only so
// much of each thing and only so much money, the purse growing as the hero
// buys and shrinking as they sell; both drift back to the shop's usual as
// real time passes (every RESTOCK_EVERY), even between visits. What the hero
// last sold can be bought back at what they got for it (not saved: gone on reloading).

import { addToBag, takeFromBag, type BagItem } from '../hero/bag';
import type { Hero } from '../types';

export interface Shop {
  money: number; // copper in the keeper's purse
  stock: Partial<Record<BagItem, number>>;
  restockedAt: number; // when last restocked (ms, wall clock)
  buyback?: Array<{ id: BagItem; price: number }>; // the hero's last sales here, latest first, BUYBACK at most
}

export const BUYBACK = 12;

// What a shop starts with, and restocks toward.
export interface Usual {
  money: number;
  stock: Partial<Record<BagItem, number>>;
}

export const RESTOCK_EVERY = 5 * 60_000; // ms: every five minutes, one more of each it's short of
const PURSE_DRIFT = 0.1; // of the way back to the usual purse, each restock

// The shop at door `key`, made from its usual on first visit, restocked up to now.
export function openShop(shops: Map<number, Shop>, key: number, usual: Usual, now = Date.now()): Shop {
  let shop = shops.get(key);
  if (!shop) {
    shop = { money: usual.money, stock: { ...usual.stock }, restockedAt: now };
    shops.set(key, shop);
  }
  restock(shop, usual, now);
  return shop;
}

// Back to its usual wares and purse at once (a cheat).
export function refill(shop: Shop, usual: Usual, now = Date.now()): void {
  Object.assign(shop, { money: usual.money, stock: { ...usual.stock }, restockedAt: now });
}

function restock(shop: Shop, usual: Usual, now: number): void {
  const restocks = Math.floor((now - shop.restockedAt) / RESTOCK_EVERY);
  if (restocks <= 0) return;
  for (const id of Object.keys(usual.stock) as BagItem[]) shop.stock[id] = Math.min(usual.stock[id] ?? 0, (shop.stock[id] ?? 0) + restocks);
  for (let i = 0; i < Math.min(restocks, 60); i++) shop.money += Math.round((usual.money - shop.money) * PURSE_DRIFT);
  shop.restockedAt += restocks * RESTOCK_EVERY;
}

// How long until its next restock (ms): what's sold out comes back then.
export function restockIn(shop: Shop, now = Date.now()): number {
  return Math.max(0, shop.restockedAt + RESTOCK_EVERY - now);
}

// The hero buys one of `id` at `price`: why not, if they can't (none left, they're short).
export function buyFrom(shop: Shop, hero: Hero, id: BagItem, price: number): 'bought' | 'sold out' | 'too poor' {
  if (!(shop.stock[id] ?? 0)) return 'sold out';
  if (hero.money < price) return 'too poor';
  hero.money -= price;
  shop.money += price;
  shop.stock[id] = (shop.stock[id] ?? 0) - 1;
  addToBag(hero.bag, id);
  return 'bought';
}

// The hero sells one of `id` at `price` (something the shop wants): why not, if not.
export function sellTo(shop: Shop, hero: Hero, id: BagItem, price: number): 'sold' | 'none' | 'short' {
  if (!(hero.bag[id] ?? 0)) return 'none';
  if (shop.money < price) return 'short';
  takeFromBag(hero.bag, id);
  hero.money += price;
  shop.money -= price;
  shop.stock[id] = (shop.stock[id] ?? 0) + 1;
  shop.buyback = [{ id, price }, ...(shop.buyback ?? [])].slice(0, BUYBACK);
  return 'sold';
}

// The hero buys back the `index`th of their last sales, at what they got for it.
export function buyBack(shop: Shop, hero: Hero, index: number): 'bought' | 'none' | 'too poor' {
  const sale = shop.buyback?.[index];
  if (!sale) return 'none';
  if (hero.money < sale.price) return 'too poor';
  hero.money -= sale.price;
  shop.money += sale.price;
  shop.stock[sale.id] = Math.max(0, (shop.stock[sale.id] ?? 0) - 1);
  shop.buyback!.splice(index, 1);
  addToBag(hero.bag, sale.id);
  return 'bought';
}
