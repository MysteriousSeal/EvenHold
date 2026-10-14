// What the hero's things fetch from the shops, and who'll buy them: the
// barmaid (and a pedlar) her food and drink, the smith weapons and armour, a
// pedlar jewellery, potions, bags and a rod, a herbalist potions and what's
// had from the wild (raw fish a pedlar too), and anyone junk, at what it's
// worth. Quest items, logs, planks and scrap (a crafter's): no one.

import { isLootItem, type BagItem } from '../hero/bag';
import { LOOT, LOOT_QUALITY } from '../loot/loot';
import { isProvision } from '../loot/provisions';
import { isPotion, potionPrice } from '../loot/potions';
import { isBagItem } from '../loot/bags';
import { isGear, slotOfGear } from '../human/items/gear';
import { isJewelrySlot } from '../human/equipment';
import { sellPrice } from '../inn/tavernShop';
import { gearSellPrice, smithBuys } from '../smithy/smithShop';
import { herbalistBuys, herbalistPrice } from '../herbalist/herbalistShop';
import { pedlarBuys, pedlarPrice } from '../travellers/pedlarShop';
import { isFish } from '../skills/fishing';

export const isJunk = (item: BagItem): boolean => isLootItem(item) && LOOT_QUALITY[item] === 'junk';

// What it sells for, and to whom ("a herbalist"); null if no one buys it.
export function saleOf(item: BagItem): { price: number; to: string } | null {
  if (isJunk(item)) return { price: LOOT[item as keyof typeof LOOT].value, to: 'anyone' };
  if (isProvision(item)) return { price: sellPrice(item), to: 'the inn or a pedlar' };
  if (smithBuys(item)) return { price: gearSellPrice(item), to: 'a smith' };
  if (isFish(item)) return { price: LOOT[item].value, to: 'a pedlar or a herbalist' };
  if (isPotion(item)) return { price: potionPrice(item, true), to: 'a herbalist or a pedlar' };
  if (herbalistBuys(item)) return { price: herbalistPrice(item, true), to: 'a herbalist' };
  if (isGear(item) && isJewelrySlot(slotOfGear(item))) return { price: gearSellPrice(item), to: 'a pedlar' };
  if (isBagItem(item) || (pedlarBuys(item) && item === 'fishingRod')) return { price: pedlarPrice(item, true), to: 'a pedlar' };
  return null;
}

// What it sells for, where it sells; null if no one buys it.
export const sellValue = (item: BagItem): number | null => saleOf(item)?.price ?? null;
