// The charms a hero may know: hedge-craft, taught by a village's herbalist for coin (spells/teaching.ts), kept in
// their spellbook and put on the action bar (hero/actionBar.ts: a slot points at one, as at food), cast with its key
// (spells/casting.ts). Each spends Breath (hero/combatMoves.ts) and then wants a while before it's cast again.
// Two kinds, by whom they may be aimed at (`aim`): at foes only (what harms), or at anyone (a foe, a villager or
// traveller picked out: hero/selection.ts; no one picked out, the hero themselves).
import type { Hero } from '../types';
import type { Into } from './turned';

export type SpellId = 'hex' | 'mend' | 'chicken' | 'cow' | 'horse' | 'swap';
export type Aim = 'foes' | 'anyone';
export const AIM_WORDS: Record<Aim, string> = { foes: 'Foes only', anyone: 'Anyone' };
export interface Spell {
  name: string;
  about: string; // what it is, in the world
  level: number; // the hero's, to be taught it
  price: number; // copper, to be taught it
  breath: number; // spent as it's cast
  cooldown: number; // seconds before it's cast again (0: at once)
  range: number; // tiles to whoever it's cast at
  aim: Aim; // whom it may be cast at
  harm?: number; // times a blow of the hero's, done to a foe
  heal?: number; // of their whole health, given back
  turns?: Into; // what it turns them into, for good (turned.ts)
  swaps?: boolean; // changes their sex (swaps.ts): cast again, back as they were
  needsTarget?: boolean; // one for anyone that's never cast at the hero themselves: no one picked out, not cast
}

export const SPELLS: Record<SpellId, Spell> = {
  hex: { name: "Hedge-witch's hex", about: 'Three words and a pinch of grave dust, thrown at whoever you mean harm.', level: 1, price: 40, breath: 30, cooldown: 6, range: 5, aim: 'foes', harm: 2 },
  mend: { name: 'Mending charm', about: 'A verse over a wound, and a thumb pressed to it. It knits what it can.', level: 1, price: 60, breath: 40, cooldown: 12, range: 5, aim: 'anyone', heal: 0.3 },
  chicken: { name: "Hen-wife's turn", about: 'A feather burnt, a word said backwards, and whoever you point at is poultry. There is no word that says it back.', level: 3, price: 150, breath: 50, cooldown: 0, range: 5, aim: 'anyone', turns: 'chicken', needsTarget: true },
  cow: { name: "Herdsman's call", about: 'The call that brings the herd in at dusk, sung to one who was never in it, with a pinch of salt held out. A man comes to it a bull, a woman a cow. They stay for the grass.', level: 4, price: 200, breath: 55, cooldown: 0, range: 5, aim: 'anyone', turns: 'cow', needsTarget: true },
  horse: { name: "Horse-coper's word", about: 'A hair from a mane knotted three times, and a name called as you would call one in from the field. Whoever answers to it stays in the field.', level: 5, price: 250, breath: 60, cooldown: 0, range: 5, aim: 'anyone', turns: 'horse', needsTarget: true },
  swap: { name: 'Moon-turn charm', about: 'Said at a crossroads under a waning moon, it is told; said anywhere, it works as well. Whoever hears it wakes into the other half of the parish.', level: 4, price: 200, breath: 40, cooldown: 0, range: 5, aim: 'anyone', swaps: true, needsTarget: true },
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
export function spellText(id: SpellId): string {
  const spell = SPELLS[id];
  const does = spell.swaps ? "Changes the sex of whoever you've picked out (a villager, a traveller, a bandit): body, hair and name; cast again, they're as they were" : spell.turns ? `Turns whoever you've picked out into a ${spell.turns}, for good: gone as if slain, nothing had for it (no boss)` : spell.harm ? `${spell.harm}× a blow's harm to your focused foe` : `Mends ${Math.round((spell.heal ?? 0) * 100)}% of the health of whoever you've picked out (no one: your own)`;
  return `${does}, up to ${spell.range} tiles off · ${spell.breath} Breath · ${spell.cooldown ? `${spell.cooldown} s` : 'no wait'}`;
}
// A save's known spells, as far as they're sound (an older save's: none).
export const readSpells = (saved: unknown): SpellId[] => (Array.isArray(saved) ? SPELL_IDS.filter((id) => saved.includes(id)) : []);
