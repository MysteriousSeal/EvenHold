// The smithy's shop, kept by its smith: the weapons, shields and armour he
// forges (items marked `soldBy: { smith }`, at their value), and any gear of
// that kind bought back (at half its value; cloth and leather he's no use
// for, cheap). His stock and purse work as the inn's (shops/shopStock.ts). Forged at his village's level (given), a
// piece in three uncommon, the same each visit; what's found sells for its level and rarity (human/items/gear.ts).

import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';
import { ITEMS, ITEM_IDS, type ItemId } from '../human/equipment';
import { baseOf, gearKey, gearWorth, isGear, slotOfGear, type GearKey, levelOf } from '../human/items/gear';
import type { Hero } from '../types';
import { buyFrom, openShop, sellTo, type Shop, type Usual } from '../shops/shopStock';
import { doorNumber, type Entrance } from '../interiors/interiors';
import { zoneLevel } from '../enemies/enemyLevels';
import { spawnOf, type MapSize } from '../map/grid';

const SCRAP = 10; // copper for gear with no value of its own (bought back for its bits)
const JEWELRY = new Set(['neck', 'ring']); // not his trade

// What he forges and sells.
export const SMITH_WARES: ItemId[] = ITEM_IDS.filter((id) => (ITEMS[id].soldBy?.smith ?? 0) > 0);

// Whether he'll buy `id` off the hero: any weapon, shield or armour.
export const smithBuys = (id: string): id is GearKey => isGear(id) && !JEWELRY.has(slotOfGear(id));

// What he starts with, and restocks toward: his usual few of each (now and
// then one short, from the seed), and a purse of several silver.
function usual(seed: number, smithy: number, level?: number): Usual {
  const roll = (salt: number) => hashUnit(smithy, seed % 1_000_003, salt);
  const forged = (id: ItemId, i: number): GearKey => (level === undefined ? id : gearKey({ item: id, level, rarity: roll(300 + i) < 0.33 ? 'uncommon' : 'common', roll: Math.floor(roll(400 + i) * 1000) }));
  const stock = Object.fromEntries(SMITH_WARES.map((id, i) => [forged(id, i), Math.max(0, ITEMS[id].soldBy!.smith! - (roll(200 + i) < 0.3 ? 1 : 0))]));
  return { money: Math.round((6 + roll(199) * 6) * COPPER_PER_SILVER), stock };
}

// The shop at the smithy whose door is `smithy` (its index among the world's doors), made on first visit.
// (`level`: his village's, his wares forged at it; none, plain ones.)
export function smithShopAt(shops: Map<number, Shop>, seed: number, smithy: number, now = Date.now(), level?: number): Shop {
  return openShop(shops, smithy, usual(seed, smithy, level), now);
}

// The smithy's shop the hero's in: by its door's number, its wares at its village's level (zoneLevel: its smithy's), or
// a level under the hero's own once they're past it: he keeps up with them, and their coin has somewhere to go.
export function smithShopIn(model: { shops: Map<number, Shop>; seed: number; size: MapSize; inside: { entrance: Entrance } | null; hero?: { level: number } }, now = Date.now()): Shop {
  const door = doorNumber(model.inside!.entrance);
  const level = Math.max(zoneLevel(spawnOf(model.size), model.inside!.entrance), (model.hero?.level ?? 1) - 1);
  const shop = smithShopAt(model.shops, model.seed, door, now, level);
  // The hero grown since his last forging: the new wares out at once (the old forging's, of a level neither his
  // village's nor this, put away), the smith forging what suits those who come in.
  const fresh = usual(model.seed, door, level).stock;
  if (Object.keys(fresh).some((key) => !(key in shop.stock))) {
    const village = zoneLevel(spawnOf(model.size), model.inside!.entrance);
    for (const key of Object.keys(shop.stock) as GearKey[]) if (isGear(key) && key.includes('@') && levelOf(key) !== village && levelOf(key) !== level) delete shop.stock[key];
    for (const [key, n] of Object.entries(fresh)) if (!(key in shop.stock)) shop.stock[key as GearKey] = n;
  }
  return shop;
}

export const gearPrice = (key: GearKey): number => gearWorth(key, ITEMS[baseOf(key)].value ?? SCRAP * 2);
export const gearSellPrice = (key: GearKey): number => gearWorth(key, ITEMS[baseOf(key)].value ? Math.floor(ITEMS[baseOf(key)].value! / 2) : SCRAP); // he buys at half

export function buyGear(shop: Shop, hero: Hero, id: GearKey): 'bought' | 'sold out' | 'too poor' | 'full' {
  return buyFrom(shop, hero, id, gearPrice(id));
}

export function sellGear(shop: Shop, hero: Hero, id: string): 'sold' | 'not wanted' | 'none' | 'he is short' {
  if (!smithBuys(id)) return 'not wanted';
  const done = sellTo(shop, hero, id, gearSellPrice(id));
  return done === 'short' ? 'he is short' : done;
}
