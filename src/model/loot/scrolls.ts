// Charms found in the dark: now and then, in the hoard of a crypt's lord, a brood mother or a stronghold's king
// (loot/hoard.ts rollCharm), a scroll or a grimoire with a charm written in it, read (right-click in the bag) to learn
// it (spells/charmLore.ts readScroll). Never a turning (none is ever written down: spells/charmLore.ts LEARNABLE).
// The Moon-turn is found only here, and least often; the hedge-witch's two (witch/witchTeaching.ts) for the villages
// with none. Worth nothing to the shops: read, or kept.

import type { LootEntry } from './lootEntry';
import type { SpellId } from '../spells/spells';

export const SCROLL_ITEMS = {
  hexScroll: { name: 'Scrawled hex', value: 0, droppedBy: {} }, // a strip of hide, the words burnt into it
  mendScroll: { name: 'Mending verse', value: 0, droppedBy: {} }, // a leaf of vellum, folded small
  moonGrimoire: { name: 'Moon-turn grimoire', value: 0, droppedBy: {} }, // a little black book, its clasp rusted
} satisfies Record<string, LootEntry>;

export type ScrollId = keyof typeof SCROLL_ITEMS;
export const SCROLL_IDS = Object.keys(SCROLL_ITEMS) as ScrollId[];
export const isScroll = (item: string): item is ScrollId => item in SCROLL_ITEMS;

// The charm each holds.
export const SCROLL_SPELL: Record<ScrollId, SpellId> = { hexScroll: 'hex', mendScroll: 'mend', moonGrimoire: 'swap' };

// What each says, in the bag.
export const SCROLL_ABOUT: Record<ScrollId, string> = {
  hexScroll: 'A strip of hide with three words burnt into it, and a smear of something that was never ink.',
  mendScroll: 'A leaf of vellum folded small, a verse on it in a cramped brown hand. It smells of camphor.',
  moonGrimoire: 'A little black book, its clasp rusted shut till you force it. Half the pages are drawings no one should have made.',
};

const FIND_CHANCE = 0.25; // of a hoard in the dark holding one
const WEIGHTS: ReadonlyArray<[ScrollId, number]> = [['hexScroll', 4], ['mendScroll', 4], ['moonGrimoire', 2]]; // (the Moon-turn the rarest)

// The scroll in a hoard, if any, by two rolls (0..1, from where it is: hoard.ts), the same every time: whether
// there's one, and which.
export function charmIn(unit: number, pick: number): ScrollId | null {
  if (unit >= FIND_CHANCE) return null;
  let left = pick * WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of WEIGHTS) if ((left -= w) < 0) return id;
  return WEIGHTS[WEIGHTS.length - 1][0];
}
