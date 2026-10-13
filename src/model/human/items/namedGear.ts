// Named pieces: one of a kind each, with a name of its own and lines that
// never change, yet an item of the catalog as any other (so it's worn, drawn,
// kept in a bag and a save as its base is: no id of its own). What makes one
// is its key's roll (gear.ts: "broadAxe@7l1005"): a found piece's roll is
// under NAMED_FROM, a named piece's is its number here, on its own base. Its
// own armour and stats are its base's, grown with its level; its extra lines
// are those listed (not rolled), as many as its rarity has, each as strong as
// a line of that rarity at its level.
//
// Whose they are: a bandit stronghold's four wings' bosses' and its king's
// (strongholds/strongholdLoot.ts), found nowhere else.

import type { Stat } from '../../hero/statKinds';
import type { Affix, Rarity } from './gear';
import type { ItemId } from './index';

export const NAMED_FROM = 1000; // rolls from here up are named pieces' numbers (a found piece's: 0..999)

export interface Named {
  item: ItemId; // its base
  name: string;
  rarity: Rarity;
  lines: ReadonlyArray<Stat | 'armor' | Affix>; // its extra lines, in order (as many as its rarity's)
  tale: string; // whose it was
}

export const NAMED = {
  1001: { item: 'wolfToothNecklace', name: "Packleader's Fangs", rarity: 'epic', lines: ['agility', 'strength', 'speed'], tale: "The houndmaster's, strung from his best dogs' teeth." },
  1002: { item: 'torch', name: 'The Last Fuse', rarity: 'epic', lines: ['strength', 'endurance', 'crit'], tale: "The quartermaster's slow match, never once out." },
  1003: { item: 'hatchet', name: "The Gaoler's Cleaver", rarity: 'epic', lines: ['strength', 'stamina', 'leech'], tale: "The gaoler's, notched on a chain." },
  1004: { item: 'parryingDagger', name: "The Captain's Second Blade", rarity: 'epic', lines: ['agility', 'dodge', 'crit'], tale: "The captain's, drawn when a fight turned." },
  1005: { item: 'broadAxe', name: 'Kingsplitter', rarity: 'legendary', lines: ['strength', 'stamina', 'leech', 'crit'], tale: "The bandit king's great axe." },
} as const satisfies Record<number, Named>;

export type NamedId = keyof typeof NAMED;

// The named piece a key's item and roll make, or null (a found piece; or that number on some other base).
export function namedOf(item: ItemId, roll: number): Named | null {
  const named = (NAMED as Record<number, Named>)[roll];
  return named && named.item === item ? named : null;
}
