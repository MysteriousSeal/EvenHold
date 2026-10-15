// What the model knows about an item: its name, the slot it goes in, and
// who wears it out in the world. How it looks is the view's business
// (view/meshes/human/gear/items/, one file per slot; the head's two: head.ts, and the finer helms in helms.ts).

import type { EquipSlot } from '../equipment';
import type { Stat } from '../../hero/statKinds';
import type { EnemyKind } from '../../types';
import type { Rarity } from './gear';
import type { GearSet } from './sets';

// Kinds of people who dress themselves from the item catalog (bandits at random;
// the inns' bouncers always in their own studded leathers).
export type Wearer = 'bandit' | 'bouncer' | 'pedlar' | 'pilgrim' | 'guard' | 'finder'; // (the last four: travellers on the roads, travellers/travellers.ts; a finder, the bishop's man in grey)
// Those who sell items: the smith (weapons, shields, armour: smithy/smithShop.ts).
export type Merchant = 'smith' | 'pedlar' | 'relics' | 'clothier'; // (a pedlar: trinkets, carried along the roads: travellers/pedlarShop.ts; a relic-monger and a clothier: the cathedral town's stalls, town/stallShop.ts)

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
  // Found no lower than this level, and no plainer than this rarity (gear.ts rollGear): a showpiece of a crypt lord's
  // hoard is never a level 2 common thing. None: level 1, common (as anything worn in the world).
  level?: number;
  rarity?: Rarity;
  // The foes who leave it, slain, as a weight against their others (loot/gearDrops.ts: half the time one of theirs, if
  // any's of their level), and whose hoards hold it (loot/hoard.ts: its keeper's kind).
  droppedBy?: Partial<Record<EnemyKind, number>>;
  set?: GearSet; // the set it's one of (sets.ts): its pieces look of a piece together
  openBack?: boolean; // worn on the head, open behind: the hair hanging below it shows (long hair, braids, tails)
}

// A slot's items, each tagged with the slot.
export function slotItems<S extends EquipSlot, T extends Record<string, ItemEntry>>(slot: S, entries: T): { [K in keyof T]: T[K] & { slot: S } } {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, { ...entry, slot }])) as { [K in keyof T]: T[K] & { slot: S } };
}
