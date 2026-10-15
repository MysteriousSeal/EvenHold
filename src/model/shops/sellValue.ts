// What the hero's things fetch from the shops, and who'll buy them: the
// barmaid (and a pedlar) her food and drink, a woodworker's wares (a pedlar; the
// inn its cups and casks, dearer), the smith weapons and armour, a
// pedlar jewellery, potions, bags and a rod, a herbalist potions and what's
// had from the wild (raw fish a pedlar too), and anyone junk, at what it's
// worth; the smith salvaged iron, a pedlar salvaged silver and stones, and
// resin and heartwood, at half (logs for firewood, at their worth). Quest items, planks, leather and linen (a
// crafter's): no one.

import { isLootItem, type BagItem } from '../hero/bag';
import { LOOT, LOOT_QUALITY } from '../loot/loot';
import { isProvision } from '../loot/provisions';
import { isPotion, potionPrice } from '../loot/potions';
import { isBagItem } from '../loot/bags';
import { isGear, slotOfGear } from '../human/items/gear';
import { isJewelrySlot } from '../human/equipment';
import { innWants, sellPrice } from '../inn/tavernShop';
import { gearSellPrice, metalPrice, pickPrice, smithBuys, smithTakesMetal, smithTakesPick, smithTakesWood, woodPrice } from '../smithy/smithShop';
import { herbalistBuys, herbalistPrice } from '../herbalist/herbalistShop';
import { WARES, pedlarBuys, pedlarPrice } from '../travellers/pedlarShop';
import { isFish } from '../skills/fishing';

// (A woodworker's wares, travellers/pedlarShop.ts WARES: not junk, but a pedlar's and the inn's.)
export const isJunk = (item: BagItem): boolean => isLootItem(item) && LOOT_QUALITY[item] === 'junk' && !WARES.has(item);

// What it sells for, and to whom ("a herbalist"); null if no one buys it.
export function saleOf(item: BagItem): { price: number; to: string } | null {
  if (isJunk(item)) return { price: LOOT[item as keyof typeof LOOT].value, to: 'anyone' };
  if (isProvision(item)) return { price: sellPrice(item), to: 'the inn or a pedlar' };
  if (WARES.has(item)) return innWants(item) ? { price: sellPrice(item), to: 'the inn (a pedlar for less)' } : { price: pedlarPrice(item, true), to: 'a pedlar' };
  if (smithBuys(item)) return { price: gearSellPrice(item), to: 'a smith' };
  if (smithTakesMetal(item)) return { price: metalPrice(item), to: 'a smith' };
  if (smithTakesWood(item)) return { price: woodPrice(item), to: 'a smith or a pedlar' };
  if (smithTakesPick(item)) return { price: pickPrice(item, true), to: 'a smith' };
  if (isFish(item)) return { price: LOOT[item].value, to: 'a pedlar or a herbalist' };
  if (isPotion(item)) return { price: potionPrice(item, true), to: 'a herbalist or a pedlar' };
  if (herbalistBuys(item)) return { price: herbalistPrice(item, true), to: 'a herbalist' };
  if (isGear(item) && isJewelrySlot(slotOfGear(item))) return { price: gearSellPrice(item), to: 'a pedlar' };
  if (isBagItem(item) || (pedlarBuys(item) && !isProvision(item))) return { price: pedlarPrice(item, true), to: 'a pedlar' };
  return null;
}

// What it sells for, where it sells; null if no one buys it.
export const sellValue = (item: BagItem): number | null => saleOf(item)?.price ?? null;
