// The cathedral town's stalls (townPlan.ts STALLS), each kept by its keeper (stallKeepers.ts), selling what no village
// does: the relic-mongers their relics (items marked `soldBy: { relics }`: the palmer's shell, an ampulla of holy water,
// a saint's knucklebone, a martyr's thorn), the clothier fine cloth (`soldBy: { clothier }`: silk gloves; and VELVET, the
// finery a bandit chief struts in, made to measure: at its own level and rarity, as dropped, never plain shop
// gear), the vintner wines no inn pours
// (loot/vintages.ts) and her wine and mead besides, the apothecary the greater potions always (a village herbalist's
// rarely). Each buys back the sort of thing it sells, at half (the vintner's drink at the inn's price), a few at a
// time; its stock and purse work as every shop's (shops/shopStock.ts), kept by the stall's place (STALL_KEY on).

import { ITEMS, ITEM_IDS, type ItemId } from '../human/equipment';
import { gearKey, isGear, baseOf, type GearKey } from '../human/items/gear';
import { isProvision, type ProvisionId } from '../loot/provisions';
import { VINTAGE_IDS } from '../loot/vintages';
import { POTIONS, isPotion, potionPrice, type PotionId } from '../loot/potions';
import { buyPrice, sellPrice } from '../inn/tavernShop';
import { gearPrice, gearSellPrice } from '../smithy/smithShop';
import { buyFrom, openShop, sellTo, type Shop } from '../shops/shopStock';
import { doorNumber } from '../interiors/interiors';
import { COPPER_PER_SILVER } from '../hero/money';
import type { BagItem } from '../hero/bag';
import type { Hero } from '../types';
import { hashUnit } from '../../util/random';
import type { StallKind } from './townPlan';

export const STALL_KEY = 2 ** 41; // a stall's shop's key among the shops (past every door's number and every pedlar's)
const PURSE: Record<StallKind, number> = { relics: 6, wine: 4, cloth: 8, potions: 5 }; // silver, usually

// A piece of finery as the clothier has it made: the item's own level and rarity (the velvet's a chief's: level 5,
// uncommon), the same each time.
const made = (id: ItemId): GearKey => gearKey({ item: id, level: ITEMS[id].level ?? 1, rarity: ITEMS[id].rarity ?? 'common', roll: 500 });
const RELICS: readonly ItemId[] = ITEM_IDS.filter((id) => (ITEMS[id].soldBy?.relics ?? 0) > 0);
const VELVET: readonly ItemId[] = ['velvetDoublet', 'particolouredHose', 'poulaines'];
const CLOTH: readonly ItemId[] = [...ITEM_IDS.filter((id) => (ITEMS[id].soldBy?.clothier ?? 0) > 0), ...VELVET];
const DRINK: readonly ProvisionId[] = ['wine', 'mead', ...VINTAGE_IDS];
const RARE_POTIONS: readonly PotionId[] = (Object.keys(POTIONS) as PotionId[]).filter((id) => id.startsWith('greater'));

// What each stall sells, and how many it keeps of each.
export function stallWares(kind: StallKind): Array<[BagItem, number]> {
  if (kind === 'relics') return RELICS.map((id) => [id, ITEMS[id].soldBy!.relics!]);
  if (kind === 'cloth') return CLOTH.map((id) => [made(id), ITEMS[id].soldBy?.clothier ?? 1]);
  if (kind === 'wine') return DRINK.map((id) => [id, VINTAGE_IDS.includes(id as never) ? 3 : 5]);
  return RARE_POTIONS.map((id) => [id, 3]);
}

// Whether the stall of `kind` takes `id` off the hero: the sort of thing it sells.
export function stallBuys(kind: StallKind, id: string): boolean {
  if (kind === 'wine') return DRINK.includes(id as ProvisionId) || id === 'ale';
  if (kind === 'potions') return isPotion(id);
  if (!isGear(id)) return false;
  return (kind === 'relics' ? RELICS : CLOTH).includes(baseOf(id));
}

// What `id` costs at a stall, or what the stall pays for it.
export function stallPrice(id: BagItem, selling: boolean): number {
  if (isPotion(id)) return potionPrice(id, selling);
  if (isProvision(id)) return selling ? sellPrice(id) : buyPrice(id);
  return selling ? gearSellPrice(id as GearKey) : gearPrice(id as GearKey);
}

// The stall at (x, z)'s shop, made the first time it's opened.
export function stallShopAt(shops: Map<number, Shop>, seed: number, stall: { x: number; z: number; kind: StallKind }, now = Date.now()): Shop {
  const key = STALL_KEY + doorNumber(stall);
  const roll = hashUnit(stall.x, stall.z, (seed % 1_000_003) + 3301);
  return openShop(shops, key, { money: Math.round((PURSE[stall.kind] + roll * 2) * COPPER_PER_SILVER), stock: Object.fromEntries(stallWares(stall.kind)) }, now);
}

// The hero buying `id` at the stall, or selling it there.
export const buyAtStall = (shop: Shop, hero: Hero, id: BagItem) => buyFrom(shop, hero, id, stallPrice(id, false));
export const sellAtStall = (shop: Shop, hero: Hero, kind: StallKind, id: BagItem) => (stallBuys(kind, id) ? sellTo(shop, hero, id, stallPrice(id, true)) : 'not wanted');
