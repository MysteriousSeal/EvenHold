// Charms taught for coin (spells.ts) by a village's hedge-witch (npcs/hedgeWitch.ts: in the herbalist's hut), as a
// keeper sells wares: each at its price, to a hero of level enough who doesn't know it yet; paid, it's known, and in
// their spellbook.
import type { Hero } from '../types';
import { SPELLS, SPELL_IDS, knows, learn, type SpellId } from './spells';

// What she teaches, in the order shown.
export const TAUGHT: readonly SpellId[] = SPELL_IDS;

export type Taught = 'taught' | 'known' | 'level' | 'too poor';
// Whether `id` may be taught `hero` now ('taught': it may), without teaching it.
export function mayLearn(hero: Pick<Hero, 'spells' | 'level' | 'money'>, id: SpellId): Taught {
  if (knows(hero, id)) return 'known';
  if (hero.level < SPELLS[id].level) return 'level';
  return hero.money < SPELLS[id].price ? 'too poor' : 'taught';
}
// Taught, if it may be: its price paid.
export function teach(hero: Pick<Hero, 'spells' | 'level' | 'money'>, id: SpellId): Taught {
  const result = mayLearn(hero, id);
  if (result !== 'taught') return result;
  hero.money -= SPELLS[id].price;
  learn(hero, id);
  return result;
}
