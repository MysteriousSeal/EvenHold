// Bags: fitted to the hero's bag (its four bag sockets: hero/bagSlots.ts),
// each so many more slots in it (room). Four to be had, all of six, from the
// cheapest to the finest: a rough sack, a leather satchel, a traveller's
// pack, a tooled leather bag. Pedlars sell them (travellers/pedlarShop.ts);
// now and then a bandit or a draugr drops one. And three a woodworker makes
// (skills/woodworking.ts), roomier each: a birch-framed pack, a pine pack, a
// heartwood pack, their frames of planks, strapped in salvaged leather.

import type { LootEntry } from './lootEntry';

export const BAG_ITEMS = {
  roughSack: { name: 'Rough sack', value: 30, droppedBy: { humanoid: 0.4 } },
  leatherSatchel: { name: 'Leather satchel', value: 70, droppedBy: { humanoid: 0.2, draugr: 0.3 } },
  travellersPack: { name: "Traveller's pack", value: 120, droppedBy: { draugr: 0.2 } },
  tooledBag: { name: 'Tooled leather bag', value: 200, droppedBy: { draugr: 0.1 } },
  birchFramedPack: { name: 'Birch-framed pack', value: 60, droppedBy: {}, room: 6 },
  pinePack: { name: 'Pine pack', value: 130, droppedBy: {}, room: 8 },
  heartwoodPack: { name: 'Heartwood pack', value: 260, droppedBy: {}, room: 10 },
} satisfies Record<string, LootEntry & { room?: number }>;

export type BagId = keyof typeof BAG_ITEMS;
export const BAG_IDS = Object.keys(BAG_ITEMS) as BagId[];
export const isBagItem = (item: string): item is BagId => item in BAG_ITEMS;
export const ROOM_OF_A_BAG = 6; // slots a bag adds, unless it says otherwise
export const roomOf = (bag: BagId): number => (BAG_ITEMS[bag] as { room?: number }).room ?? ROOM_OF_A_BAG;
