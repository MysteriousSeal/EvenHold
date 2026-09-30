// A piece of gear's armour and what it adds to the hero's stats, as its
// tooltip's lines ("Armour 4", "+1 Stamina"): in the bag, on the hero
// sheet, at the smith's.

import { ITEMS, type ItemId } from '../../model/human/equipment';
import { STATS, STAT_NAMES } from '../../model/hero/statKinds';

export function gearLines(id: ItemId): string[] {
  const { armor, stats = {} } = ITEMS[id];
  return [...(armor ? [`Armour ${armor}`] : []), ...STATS.filter((s) => stats[s]).map((s) => `+${stats[s]} ${STAT_NAMES[s]}`)];
}
