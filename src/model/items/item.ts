// What the model knows about an item: its name, the slot it goes in, and
// who wears it out in the world. How it looks is the view's business
// (view/meshes/human/gear/, one file per slot like here).

import type { EquipSlot } from '../equipment';

// Kinds of people who dress themselves from the item catalog.
export type Wearer = 'bandit';

export interface ItemEntry {
  name: string;
  // How often each kind of wearer picks this item for its slot, as a weight
  // against the slot's other items (and against leaving it empty, see
  // EMPTY_SLOT_WEIGHT in equipment.ts). Anyone not listed never picks it,
  // though the hero can wear anything.
  wornBy?: Partial<Record<Wearer, number>>;
}

// A slot's items, each tagged with the slot.
export function slotItems<S extends EquipSlot, T extends Record<string, ItemEntry>>(slot: S, entries: T): { [K in keyof T]: T[K] & { slot: S } } {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, { ...entry, slot }])) as { [K in keyof T]: T[K] & { slot: S } };
}
