// The charms a hero may know: hedge-craft, taught by a village's herbalist for coin (spells/teaching.ts), kept in
// their spellbook and put on the action bar (hero/actionBar.ts: a slot points at one, as at food), cast with its key
// (spells/casting.ts). Each spends Breath (hero/combatMoves.ts) and then wants a while before it's cast again.
import type { Hero } from '../types';

export type SpellId = 'hex';
export interface Spell {
  name: string;
  about: string; // what it is, in the world
  level: number; // the hero's, to be taught it
  price: number; // copper, to be taught it
  breath: number; // spent as it's cast
  cooldown: number; // seconds before it's cast again
  range: number; // tiles to the foe it's cast at
  harm: number; // times a blow of the hero's
}

export const SPELLS: Record<SpellId, Spell> = {
  hex: { name: "Hedge-witch's hex", about: 'Three words and a pinch of grave dust, thrown at whoever you mean harm.', level: 1, price: 40, breath: 30, cooldown: 6, range: 5, harm: 2 },
};
export const SPELL_IDS = Object.keys(SPELLS) as SpellId[];

// A spell as the action bar holds it (its slots hold what they point at by name: a spell's, marked so).
export type SpellKey = `spell:${SpellId}`;
export const spellKey = (id: SpellId): SpellKey => `spell:${id}`;
export const isSpellKey = (item: string): item is SpellKey => item.startsWith('spell:') && item.slice(6) in SPELLS;
export const spellOf = (key: SpellKey): SpellId => key.slice(6) as SpellId;

type Learned = Pick<Hero, 'spells'>;
export const knows = (hero: Learned, id: SpellId): boolean => !!hero.spells?.includes(id);
// Taught: whether it was (not known already).
export function learn(hero: Learned, id: SpellId): boolean {
  if (knows(hero, id)) return false;
  hero.spells = [...(hero.spells ?? []), id];
  return true;
}
// Seconds before `id` may be cast again (0: now).
export const waitOf = (hero: Pick<Hero, 'spellWait'>, id: SpellId): number => hero.spellWait?.[id] ?? 0;
// A moment on: each spell's wait run down.
export function coolSpells(hero: Pick<Hero, 'spellWait'>, dt: number): void {
  for (const id of Object.keys(hero.spellWait ?? {}) as SpellId[]) hero.spellWait![id] = Math.max(0, hero.spellWait![id]! - dt);
}
// What it does, in a line (the spellbook, the bar's tip).
export const spellText = (id: SpellId): string => `${SPELLS[id].harm}× a blow's harm to your focused foe, up to ${SPELLS[id].range} tiles off · ${SPELLS[id].breath} Breath · ${SPELLS[id].cooldown} s`;
// A save's known spells, as far as they're sound (an older save's: none).
export const readSpells = (saved: unknown): SpellId[] => (Array.isArray(saved) ? SPELL_IDS.filter((id) => saved.includes(id)) : []);
