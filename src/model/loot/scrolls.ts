// Charms found in the dark: now and then, in the hoard of a crypt's lord, a brood mother or a stronghold's king
// (loot/hoard.ts rollCharm), a scroll or a grimoire with a charm written in it, read (right-click in the bag) to learn
// it (spells/charmLore.ts readScroll). Never a turning (none is ever written down: spells/charmLore.ts LEARNABLE).
// The Moon-turn is found only here, and least often; the hedge-witch's two (witch/witchTeaching.ts) for the villages
// with none. Worth nothing to the shops: read, or kept.

import type { LootEntry } from './lootEntry';
import type { SpellId } from '../spells/spells';

// Each charm written down, a line each (one more found in the dark: a line here; its look, scrollVoxels.ts, else a
// plain scroll's): its name, the charm in it, what it says in the bag, and how often it's found (of the others).
const SCROLLS = {
  hexScroll: { name: 'Scrawled hex', spell: 'hex', weight: 4, about: 'A strip of hide with three words burnt into it, and a smear of something that was never ink.' },
  mendScroll: { name: 'Mending verse', spell: 'mend', weight: 4, about: 'A leaf of vellum folded small, a verse on it in a cramped brown hand. It smells of camphor.' },
  moonGrimoire: { name: 'Moon-turn grimoire', spell: 'swap', weight: 2, about: 'A little black book, its clasp rusted shut till you force it. Half the pages are drawings no one should have made.' }, // (the rarest)
} satisfies Record<string, { name: string; spell: SpellId; weight: number; about: string }>;

export type ScrollId = keyof typeof SCROLLS;
export const SCROLL_IDS = Object.keys(SCROLLS) as ScrollId[];
export const isScroll = (item: string): item is ScrollId => item in SCROLLS;
const each = <T>(of: (id: ScrollId) => T) => Object.fromEntries(SCROLL_IDS.map((id) => [id, of(id)])) as Record<ScrollId, T>;

export const SCROLL_ITEMS: Record<ScrollId, LootEntry> = each((id) => ({ name: SCROLLS[id].name, value: 0, droppedBy: {} }));
export const SCROLL_SPELL: Record<ScrollId, SpellId> = each((id) => SCROLLS[id].spell); // the charm each holds
export const SCROLL_ABOUT: Record<ScrollId, string> = each((id) => SCROLLS[id].about); // what each says, in the bag

const FIND_CHANCE = 0.25; // of a hoard in the dark holding one
const WEIGHTS: ReadonlyArray<[ScrollId, number]> = SCROLL_IDS.map((id) => [id, SCROLLS[id].weight]);

// The scroll in a hoard, if any, by two rolls (0..1, from where it is: hoard.ts), the same every time: whether
// there's one, and which.
export function charmIn(unit: number, pick: number): ScrollId | null {
  if (unit >= FIND_CHANCE) return null;
  let left = pick * WEIGHTS.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of WEIGHTS) if ((left -= w) < 0) return id;
  return WEIGHTS[WEIGHTS.length - 1][0];
}
