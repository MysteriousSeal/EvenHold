// The smithy's shop, kept by its smith: the weapons, shields and armour he
// forges (items marked `soldBy: { smith }`, at their value), and any gear of
// that kind bought back (at half its value; cloth and leather he's no use
// for, cheap), and the iron salvaged from gear, and what a lumberjack finds in the wood (resin, heartwood, a burl: for hafts and handles), each at half its worth, a few at a time; and a miner's pickaxe, one on his shelf. His stock and purse work as the inn's (shops/shopStock.ts). Forged at his village's level (given), a
// piece in three uncommon, the same each visit; what's found sells for its level and rarity (human/items/gear.ts).

import { hashUnit } from '../../util/random';
import { LOOT } from '../loot/loot';
import { TOOL_ITEMS, type ToolId } from '../loot/tools';
import { COPPER_PER_SILVER } from '../hero/money';
import { mendCost, wearGone } from '../hero/wear';
import { isCrafted } from '../skills/salvage';
import { ITEMS, ITEM_IDS, type ItemId } from '../human/equipment';
import { baseOf, gearKey, gearWorth, isGear, slotOfGear, type GearKey } from '../human/items/gear';
import type { Hero } from '../types';
import type { BagItem } from '../hero/bag';
import { WOODWORKS, buyFrom, openShop, sellTo, type Shop, type Usual } from '../shops/shopStock';
import { doorNumber, type Entrance } from '../interiors/interiors';
import { zoneLevel } from '../enemies/enemyLevels';
import { spawnOf, type MapSize } from '../map/grid';

const PURSE_PER_LEVEL = 0.15; // more to his purse, each level his forging's past the first (gear.ts gearWorth's own)
const SCRAP = 10; // copper for gear with no value of its own (bought back for its bits)
const JEWELRY = new Set(['neck', 'ring']); // not his trade

// What he forges and sells.
export const SMITH_WARES: ItemId[] = ITEM_IDS.filter((id) => (ITEMS[id].soldBy?.smith ?? 0) > 0);

// Whether he'll buy `id` off the hero: any weapon, shield or armour.
export const smithBuys = (id: string): id is GearKey => isGear(id) && !JEWELRY.has(slotOfGear(id));

// The metal salvaged from gear (skills/salvage.ts) he'll take for the forge, at half its worth.
const METAL: ReadonlySet<string> = new Set(['ironScrap', 'temperedIngot', 'copperIngot', 'bronzeIngot', 'ironIngot', 'steelIngot', 'silverIngot', 'goldIngot', 'starIronIngot']); // (and a smith's ingots: skills/smithing.ts)
type Metal = 'ironScrap' | 'temperedIngot' | 'copperIngot' | 'bronzeIngot' | 'ironIngot' | 'steelIngot' | 'silverIngot' | 'goldIngot' | 'starIronIngot';
export const smithTakesMetal = (id: string): id is Metal => METAL.has(id);
export const metalPrice = (id: Metal): number => Math.floor(LOOT[id].value / 2);

// What's found in the wood he'll take, at half its worth (skills/lumber.ts: a pine's resin, an ancient or elder oak's
// heartwood, a burl).
const FOUND_WOOD: ReadonlySet<string> = new Set(['pineResin', 'heartwood', 'oakBurl']);
export const smithTakesWood = (id: string): boolean => FOUND_WOOD.has(id) && id in LOOT;
export const woodPrice = (id: string): number => Math.floor((LOOT[id as keyof typeof LOOT]?.value ?? 0) / 2);

// The miner's pickaxe (skills/mining.ts): his copper one, one on his shelf, at its worth; any pickaxe bought back at
// half, as a pedlar buys back a rod.
export const SMITH_PICK = 'copperPick' satisfies ToolId;
const PICKS: ReadonlySet<string> = new Set(['copperPick', 'ironPick', 'steelPick', 'starIronPick']);
export const smithTakesPick = (id: string): id is ToolId => PICKS.has(id) && id in TOOL_ITEMS;
export const pickPrice = (id: ToolId, selling: boolean): number => (selling ? Math.floor(TOOL_ITEMS[id].value / 2) : TOOL_ITEMS[id].value);

// What he starts with, and restocks toward: his usual few of each (now and
// then one short of a piece he keeps two of, from the seed: never none, a ware sold out for good), and a purse of
// several silver, more as he forges dearer (as gear's worth grows with its level: human/items/gear.ts).
function usual(seed: number, smithy: number, level?: number): Usual {
  const roll = (salt: number) => hashUnit(smithy, seed % 1_000_003, salt);
  const forged = (id: ItemId, i: number): GearKey => (level === undefined ? id : gearKey({ item: id, level, rarity: roll(300 + i) < 0.33 ? 'uncommon' : 'common', roll: Math.floor(roll(400 + i) * 1000) }));
  const stock: Usual['stock'] = Object.fromEntries(SMITH_WARES.map((id, i) => [forged(id, i), ITEMS[id].soldBy!.smith! - (ITEMS[id].soldBy!.smith! > 1 && roll(200 + i) < 0.3 ? 1 : 0)]));
  stock[SMITH_PICK] = 1; // (every smith has a pickaxe)
  return { money: Math.round(Math.round((6 + roll(199) * 6) * COPPER_PER_SILVER) * (1 + ((level ?? 1) - 1) * PURSE_PER_LEVEL)), stock };
}

// The shop at the smithy whose door is `smithy` (its index among the world's doors), made on first visit.
// (`level`: his village's, his wares forged at it; none, plain ones.)
export function smithShopAt(shops: Map<number, Shop>, seed: number, smithy: number, now = Date.now(), level?: number): Shop {
  return openShop(shops, smithy, usual(seed, smithy, level), now);
}

// The smithy's shop the hero's in: by its door's number, its wares at its village's level (zoneLevel: its smithy's), or
// a level under the hero's own once they're past it: he keeps up with them, and their coin has somewhere to go. One
// forging of each piece on his wall at a time.
export function smithShopIn(model: { shops: Map<number, Shop>; seed: number; size: MapSize; inside: { entrance: Entrance } | null; hero?: { level: number } }, now = Date.now()): Shop {
  const door = doorNumber(model.inside!.entrance);
  const level = Math.max(zoneLevel(spawnOf(model.size), model.inside!.entrance), (model.hero?.level ?? 1) - 1);
  const shop = smithShopAt(model.shops, model.seed, door, now, level);
  // The hero grown since his last forging: the new wares out at once, the old put away (and what the hero sold him
  // with them: theirs to buy back still), the smith forging what suits those who come in.
  const fresh = usual(model.seed, door, level).stock;
  if (Object.keys(fresh).some((key) => !(key in shop.stock))) {
    for (const key of Object.keys(shop.stock) as GearKey[]) if (isGear(key) && !(key in fresh)) delete shop.stock[key];
    for (const [key, n] of Object.entries(fresh)) if (!(key in shop.stock)) shop.stock[key as GearKey] = n;
  }
  // What's gone that he'll not forge again (what the hero sold him, his village's wares they've outgrown) off his
  // wall, not shown sold out for ever.
  for (const key of Object.keys(shop.stock) as GearKey[]) if (!shop.stock[key] && !(key in fresh)) delete shop.stock[key];
  return shop;
}

export const gearPrice = (key: GearKey): number => gearWorth(key, ITEMS[baseOf(key)].value ?? SCRAP * 2);
const WOODWORK_SHARE = 8; // of its worth he pays for a woodworker's make of the hero's (a stave, a plank shield, a spear): a smith's no use for wood
// What he pays for a piece: half its worth (an eighth, one the hero made of wood: skills/salvage.ts isCrafted; one
// found, or his own forging, half), less what mending it would cost him if it's worn (`hero`'s: hero/wear.ts), never
// under what it's worth for its bits. (No `hero`: as found, whole.)
export function gearSellPrice(key: GearKey, hero?: Hero): number {
  const base = ITEMS[baseOf(key)].value;
  const made = !!hero && WOODWORKS.has(baseOf(key)) && isCrafted(hero, key);
  const price = gearWorth(key, base ? Math.floor(base / (made ? WOODWORK_SHARE : 2)) : SCRAP);
  return hero ? Math.min(price, Math.max(gearWorth(key, SCRAP), price - mendCost(hero, key))) : price;
}

// The hero's level he asks before he'll sell a piece, by its own worth (its level's and rarity's: an uncommon pair of
// gauntlets dear as mail is kept back as mail is): plain gear to anyone; his heavy work (a war hammer,
// a tower shield, a great helm, mail, a breastplate) only to a hand that's shown it can carry it, not to a green one
// fresh from the road with a fat purse (a whole kit of plate at the first village, and nothing could touch them).
export function smithAsks(key: GearKey): number {
  const worth = ITEMS[baseOf(key)].value ? gearPrice(key) : 0;
  return worth >= 240 ? 7 : worth >= 200 ? 5 : worth >= 150 ? 3 : 1;
}

// Whether he'll sell it to `hero` openly, as far as he's concerned (not what's in stock).
export const smithSellsTo = (hero: Pick<Hero, 'level'>, key: GearKey): boolean => hero.level >= smithAsks(key);

// What he'd want for it from `hero`: its price; or, not for them yet, from under the counter, UNDER_COUNTER times it
// (a bribe: he'll sell it all the same).
export const UNDER_COUNTER = 2.5;
export const smithPriceFor = (hero: Pick<Hero, 'level'>, key: GearKey): number => (smithSellsTo(hero, key) ? gearPrice(key) : Math.ceil(gearPrice(key) * UNDER_COUNTER));

export function buyGear(shop: Shop, hero: Hero, id: GearKey | ToolId): 'bought' | 'sold out' | 'too poor' | 'full' {
  wearGone(hero, id); // (one like it they had, sold: this one's new)
  return buyFrom(shop, hero, id, smithTakesPick(id) ? pickPrice(id, false) : smithPriceFor(hero, id as GearKey));
}

export function sellGear(shop: Shop, hero: Hero, id: string): 'sold' | 'not wanted' | 'none' | 'he is short' {
  if (!smithBuys(id) && !smithTakesMetal(id) && !smithTakesWood(id) && !smithTakesPick(id)) return 'not wanted';
  const done = sellTo(shop, hero, id as BagItem, smithTakesMetal(id) ? metalPrice(id) : smithTakesWood(id) ? woodPrice(id) : smithTakesPick(id) ? pickPrice(id, true) : gearSellPrice(id as GearKey, hero));
  return done === 'short' ? 'he is short' : done;
}
