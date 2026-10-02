// What the model knows about an item: its name, the slot it goes in, and
// who wears it out in the world. How it looks is the view's business
// (view/meshes/human/gear/items/, one file per slot).

import type { EquipSlot } from '../equipment';
import type { Stat } from '../../hero/statKinds';

// Kinds of people who dress themselves from the item catalog (bandits at random;
// the inns' bouncers always in their own studded leathers).
export type Wearer = 'bandit' | 'bouncer' | 'pedlar' | 'pilgrim' | 'guard'; // (the last three: travellers on the roads, travellers/travellers.ts)
// Those who sell items: the smith (weapons, shields, armour: smithy/smithShop.ts).
export type Merchant = 'smith' | 'pedlar'; // (a pedlar: trinkets, carried along the roads: travellers/pedlarShop.ts)

export interface ItemEntry {
  name: string;
  // How often each kind of wearer picks this item for its slot, as a weight
  // against the slot's other items (and against leaving it empty, see
  // EMPTY_SLOT_WEIGHT in equipment.ts). Anyone not listed never picks it,
  // though the hero can wear anything.
  wornBy?: Partial<Record<Wearer, number>>;
  value?: number; // what it's worth, in copper (sold at it, bought back at half); none: only bought back cheap
  // Who sells it, and how many they usually keep in stock.
  soldBy?: Partial<Record<Merchant, number>>;
  // Worn by the hero: how much it shields them (armour, off each blow taken), and what it adds to their stats.
  armor?: number;
  stats?: Partial<Record<Stat, number>>;
}

// A slot's items, each tagged with the slot.
export function slotItems<S extends EquipSlot, T extends Record<string, ItemEntry>>(slot: S, entries: T): { [K in keyof T]: T[K] & { slot: S } } {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, { ...entry, slot }])) as { [K in keyof T]: T[K] & { slot: S } };
}
