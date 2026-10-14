// What the hero's things fetch from the shops, and who'll buy them: the
// barmaid her food and drink, the smith weapons and armour, and anyone junk,
// at what it's worth; raw fish, a pedlar or a herbalist, at its worth. Quest items, the other ingredients and
// jewellery: no one (yet).

import { isLootItem, type BagItem } from '../hero/bag';
import { LOOT, LOOT_QUALITY } from '../loot/loot';
import { isProvision } from '../loot/provisions';
import { sellPrice } from '../inn/tavernShop';
import { gearSellPrice, smithBuys } from '../smithy/smithShop';
import { isFish } from '../skills/fishing';

export const isJunk = (item: BagItem): boolean => isLootItem(item) && LOOT_QUALITY[item] === 'junk';

// What it sells for, where it sells; null if no one buys it.
export function sellValue(item: BagItem): number | null {
  if (isJunk(item)) return LOOT[item as keyof typeof LOOT].value;
  if (isProvision(item)) return sellPrice(item);
  if (smithBuys(item)) return gearSellPrice(item);
  if (isFish(item)) return LOOT[item].value;
  return null;
}
