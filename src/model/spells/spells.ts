// The charms a hero may know: hedge-craft, put on the action bar (hero/actionBar.ts: a slot points at one, as at
// food) and cast with its key (spells/casting.ts). Each spends Breath (hero/combatMoves.ts) and then wants a while
// before it's cast again. None's taught or sold in the game: handed out from the cheat menu (controller/cheats/).
// Two kinds, by whom they may be aimed at (`aim`): at foes only (what harms), or at anyone (a foe, a villager or
// traveller picked out: hero/selection.ts; no one picked out, the hero themselves).
import type { Hero } from '../types';
import type { Into } from './turned';

export type SpellId = 'hex' | 'mend' | 'chicken' | 'cow' | 'horse' | 'swap' | 'statue' | 'tree' | 'pig' | 'sheep' | 'goat' | 'donkey' | 'toad' | 'rat' | 'cat' | 'ghost' | 'painting' | 'doll';
export type Aim = 'foes' | 'anyone';
export const AIM_WORDS: Record<Aim, string> = { foes: 'Foes only', anyone: 'Anyone' };
export interface Spell {
  name: string;
  about: string; // what it is, in the world
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
  hex: { name: "Hedge-witch's hex", about: 'Three words and a pinch of grave dust, thrown at whoever you mean harm.', breath: 30, cooldown: 6, range: 5, aim: 'foes', harm: 2 },
  mend: { name: 'Mending charm', about: 'A verse over a wound, and a thumb pressed to it. It knits what it can.', breath: 40, cooldown: 12, range: 5, aim: 'anyone', heal: 0.3 },
  chicken: { name: "Hen-wife's turn", about: 'A feather burnt, a word said backwards, and whoever you point at is poultry. There is no word that says it back.', breath: 50, cooldown: 0, range: 5, aim: 'anyone', turns: 'chicken', needsTarget: true },
  cow: { name: "Herdsman's call", about: 'The call that brings the herd in at dusk, sung to one who was never in it, with a pinch of salt held out. A man comes to it a bull, a woman a cow. They stay for the grass.', breath: 55, cooldown: 0, range: 5, aim: 'anyone', turns: 'cow', needsTarget: true },
  horse: { name: "Horse-coper's word", about: 'A hair from a mane knotted three times, and a name called as you would call one in from the field. Whoever answers to it stays in the field.', breath: 60, cooldown: 0, range: 5, aim: 'anyone', turns: 'horse', needsTarget: true },
  statue: { name: "Mason's curse", about: 'A pebble from a churchyard wall, held under the tongue while you look at them. Out of doors only: whoever you look at stays where they stand, in stone, in all weathers.', breath: 65, cooldown: 0, range: 5, aim: 'anyone', turns: 'statue', needsTarget: true },
  tree: { name: "Woodward's rooting", about: 'An acorn split with the thumbnail and a word breathed into the halves. Out of doors only: whoever it is said at takes root, and is a tree like any other. A woodcutter would not know the difference.', breath: 70, cooldown: 0, range: 5, aim: 'anyone', turns: 'tree', needsTarget: true },
  pig: { name: "Swineherd's whistle", about: 'Two notes through the teeth and a fistful of acorns thrown down. Whoever stoops for them stays stooped, and is glad of the mud.', breath: 55, cooldown: 0, range: 5, aim: 'anyone', turns: 'pig', needsTarget: true },
  sheep: { name: "Shepherd's tally", about: 'The old count said over them, yan, tan, tethera, with a tuft of wool rubbed between the fingers. Whoever is counted is one of the flock, and was never anything else.', breath: 55, cooldown: 0, range: 5, aim: 'anyone', turns: 'sheep', needsTarget: true },
  goat: { name: "Goatherd's grudge", about: 'A thistle head crushed in the fist and a name said sourly. Whoever it is said of comes away bearded and slot-eyed, and no better tempered.', breath: 55, cooldown: 0, range: 5, aim: 'anyone', turns: 'goat', needsTarget: true },
  donkey: { name: "Carter's oath", about: 'What a carter says to a load that will not shift, said to a body instead, with a thorn switch in the hand. They will carry from now on, and be slow about it.', breath: 60, cooldown: 0, range: 5, aim: 'anyone', turns: 'donkey', needsTarget: true },
  toad: { name: "Ditch-wife's spit", about: 'Spit on a dock leaf, the leaf folded over and trodden into wet ground. Whoever you were looking at as you trod is under the next one, blinking.', breath: 50, cooldown: 0, range: 5, aim: 'anyone', turns: 'toad', needsTarget: true },
  rat: { name: "Ratcatcher's due", about: 'A crust left on a sill and a debt named over it. Whoever is named comes for the crust, small and grey, and for every crust after.', breath: 50, cooldown: 0, range: 5, aim: 'anyone', turns: 'rat', needsTarget: true },
  cat: { name: "Goodwife's hearth-word", about: 'A saucer set down by the fire and a name called soft, as to something already asleep there. Whoever answers to it will answer to nothing else again.', breath: 50, cooldown: 0, range: 5, aim: 'anyone', turns: 'cat', needsTarget: true },
  ghost: { name: "Sexton's knell", about: 'A bell rung once for someone not yet dead, a thumb of grave earth pressed to the rope. They hear it, and are what is left: pale, thin as breath, and still about the place.', breath: 65, cooldown: 0, range: 5, aim: 'anyone', turns: 'ghost', needsTarget: true },
  painting: { name: "Limner's likeness", about: 'A thumb of lampblack and one eye held half shut, as a limner takes a face. Under a roof only: whoever is looked at is taken, and hangs on the nearest wall in a plain frame.', breath: 65, cooldown: 0, range: 5, aim: 'anyone', turns: 'painting', needsTarget: true },
  doll: { name: "Poppet-maker's stitch", about: 'A knot of rag, a hair of theirs if you have one, and a needle put through it. Not under a roof: whoever it is made of is the poppet, lying where they stood, to be picked up like any other.', breath: 65, cooldown: 0, range: 5, aim: 'anyone', turns: 'doll', needsTarget: true },
  swap: { name: 'Moon-turn charm', about: 'Said at a crossroads under a waning moon, it is told; said anywhere, it works as well. Whoever hears it wakes into the other half of the parish.', breath: 40, cooldown: 0, range: 5, aim: 'anyone', swaps: true, needsTarget: true },
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
// What it does, in a line (the bar's tip, the cheat menu).
export function spellText(id: SpellId): string {
  const spell = SPELLS[id];
  const does = spell.swaps ? "Changes the sex of whoever you've picked out (a villager, a traveller, a bandit): body, hair and name; cast again, they're as they were" : spell.turns ? `Turns whoever you've picked out into a ${spell.turns}, for good: gone as if slain, nothing had for it (no boss)` : spell.harm ? `${spell.harm}× a blow's harm to your focused foe` : `Mends ${Math.round((spell.heal ?? 0) * 100)}% of the health of whoever you've picked out (no one: your own)`;
  return `${does}, up to ${spell.range} tiles off · ${spell.breath} Breath · ${spell.cooldown ? `${spell.cooldown} s` : 'no wait'}`;
}
// A save's known spells, as far as they're sound (an older save's: none).
export const readSpells = (saved: unknown): SpellId[] => (Array.isArray(saved) ? SPELL_IDS.filter((id) => saved.includes(id)) : []);
