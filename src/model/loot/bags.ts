// Bags: fitted to the hero's bag (its four bag sockets: hero/bagSlots.ts),
// each six more slots in it. Four of them, all the same room, from the
// cheapest to the finest: a rough sack, a leather satchel, a traveller's
// pack, a tooled leather bag. Pedlars sell them (travellers/pedlarShop.ts);
// now and then a bandit or a draugr drops one.

import type { LootEntry } from './lootEntry';

export const BAG_ITEMS = {
  roughSack: { name: 'Rough sack', value: 30, droppedBy: { humanoid: 0.4 } },
  leatherSatchel: { name: 'Leather satchel', value: 70, droppedBy: { humanoid: 0.2, draugr: 0.3 } },
  travellersPack: { name: "Traveller's pack", value: 120, droppedBy: { draugr: 0.2 } },
  tooledBag: { name: 'Tooled leather bag', value: 200, droppedBy: { draugr: 0.1 } },
} satisfies Record<string, LootEntry>;

export type BagId = keyof typeof BAG_ITEMS;
export const BAG_IDS = Object.keys(BAG_ITEMS) as BagId[];
export const isBagItem = (item: string): item is BagId => item in BAG_ITEMS;
