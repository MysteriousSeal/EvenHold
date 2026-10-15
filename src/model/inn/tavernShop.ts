// The inn's shop, kept by its barmaid: food and drink (provisions.ts) she
// sells, and buys back. She has only so much of each, and only so much
// money: it grows when the hero buys, shrinks when she buys from them. Her
// wares and purse start from the seed and slowly come back toward that as
// real time passes (five minutes at a time), even between visits. From her
// kitchen too, for a cook (skills/cooking.ts): salt and flour (INN_PANTRY).

import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';
import { PROVISIONS, PROVISION_IDS, isProvision, type ProvisionId } from '../loot/provisions';
import { INGREDIENTS } from '../loot/ingredients';
import type { Hero } from '../types';
import { buyFrom, openShop, refill, sellTo, type Shop, type Usual } from '../shops/shopStock';
import { PEDLAR_KEY } from '../travellers/travellers';

export { RESTOCK_EVERY, restockIn, type Shop } from '../shops/shopStock';

// What she starts with, and restocks toward: a few silver, a few of each.
function usual(seed: number, inn: number): Usual {
  const roll = (salt: number) => hashUnit(inn, seed % 1_000_003, salt);
  const stock = Object.fromEntries([...PROVISION_IDS.map((id, i) => [id, 2 + Math.floor(roll(100 + i) * 5)]), ...INN_PANTRY.map((id, i) => [id, 5 + Math.floor(roll(120 + i) * 6)])]);
  return { money: Math.round((2 + roll(99) * 3) * COPPER_PER_SILVER), stock };
}

// The shop at the inn whose door is `inn` (its index among the world's doors), made on first visit.
export function shopAt(shops: Map<number, Shop>, seed: number, inn: number, now = Date.now()): Shop {
  return openShop(shops, inn, usual(seed, inn), now);
}

// Every barmaid back to her usual wares and purse at once (a cheat); those
// not yet visited start that way anyway (the smiths' shops, kept alongside,
// left be, and the pedlars' with their bread and ale). Returns how many were restocked.
export function restockAll(shops: Map<number, Shop>, seed: number, now = Date.now()): number {
  let n = 0;
  for (const [inn, shop] of shops) {
    if (inn >= PEDLAR_KEY || !Object.keys(shop.stock).some(isProvision)) continue; // a smith's (or a pedlar's, a herbalist's: kept past the doors' numbers)
    refill(shop, usual(seed, inn), now);
    n++;
  }
  return n;
}

// Her kitchen's salt and flour, sold to a cook (not bought back: she's plenty).
export const INN_PANTRY = ['salt', 'flour'] as const;
export type PantryId = (typeof INN_PANTRY)[number];
export const isPantry = (id: string): id is PantryId => (INN_PANTRY as readonly string[]).includes(id);

export const buyPrice = (id: ProvisionId | PantryId): number => (isPantry(id) ? INGREDIENTS[id].value : PROVISIONS[id].value);

// What the inn pays for a woodworker's cups (skills/woodworking.ts), a standing price well over the junk one: the
// bar's tankards break, the kitchen's bowls crack, and she wants them. Those sold stock her cupboard (the shop's
// stock): a barkeep's shift there begins with the more clean cups (jobs/work.ts).
// And her orders on the village's board (quests/quests.ts): so many at a time.
export const INN_WANTS = {
  carvedTankard: { pays: 45, plural: 'carved tankards', order: [2, 4] },
  woodenBowl: { pays: 14, plural: 'wooden bowls', order: [3, 6] },
} as const;
export type InnWant = keyof typeof INN_WANTS;
export const innWants = (id: string | null): id is InnWant => id !== null && id in INN_WANTS;
// Her cupboard, in words: what she has of a woodworker's cups ("12 tankards and 3 bowls"), or that it's bare.
export function cupboardWords(shop: Shop): string {
  const [tankards, bowls] = [shop.stock.carvedTankard ?? 0, shop.stock.woodenBowl ?? 0];
  if (!tankards && !bowls) return "Her cupboard is bare: she'd buy carved tankards and wooden bowls.";
  const of = (n: number, what: string) => (n ? [`${n} ${what}${n === 1 ? '' : 's'}`] : []);
  return `Her cupboard: ${[...of(tankards, 'tankard'), ...of(bowls, 'bowl')].join(' and ')}.`;
}

export const sellPrice = (id: ProvisionId | InnWant): number => (innWants(id) ? INN_WANTS[id].pays : Math.max(1, Math.floor(PROVISIONS[id].value / 2))); // she buys food at half

// The hero buys one of `id`: why not, if they can't (she's none, they're short).
export function buy(shop: Shop, hero: Hero, id: ProvisionId | PantryId): 'bought' | 'sold out' | 'too poor' | 'full' {
  return buyFrom(shop, hero, id, buyPrice(id));
}

// The hero buys one of `id` to have there and then, at the bar (not carried off: no room in the bag wanted): why not, if not.
export function buyToHave(shop: Shop, hero: Hero, id: ProvisionId): 'bought' | 'sold out' | 'too poor' {
  const price = buyPrice(id);
  if (!(shop.stock[id] ?? 0)) return 'sold out';
  if (hero.money < price) return 'too poor';
  hero.money -= price;
  shop.money += price;
  shop.stock[id]! -= 1;
  return 'bought';
}

// The hero sells her one of `id` (food and drink, and a woodworker's cups): why not, if not.
export function sell(shop: Shop, hero: Hero, id: string): 'sold' | 'not wanted' | 'none' | 'she is short' {
  if (!isProvision(id) && !innWants(id)) return 'not wanted';
  const done = sellTo(shop, hero, id, sellPrice(id));
  return done === 'short' ? 'she is short' : done;
}
