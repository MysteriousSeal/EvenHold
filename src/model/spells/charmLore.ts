// How a hero comes to know a charm in the world (spells.ts): taught by a hedge-witch (witch/witchTeaching.ts), or read
// off a scroll found in the dark (loot/scrolls.ts). Only those that harm, mend or change a body back and forth: the
// turnings (into a beast, a stone, a tree, a painting...) are taught by no one and written down nowhere (the cheat
// menu's alone: controller/cheats/charmCheats.ts). Learned: known from then on, and on the first free slot of the
// action bar (cast with the slot's key).
import { setAction } from '../hero/actionBar';
import { takeFromBag } from '../hero/bag';
import { SCROLL_SPELL, isScroll } from '../loot/scrolls';
import type { Hero } from '../types';
import { SPELLS, SPELL_IDS, knows, learn, spellKey, type SpellId } from './spells';

// The charms to be had in the world: none that turns someone into something.
export const LEARNABLE: readonly SpellId[] = SPELL_IDS.filter((id) => !SPELLS[id].turns);
export const isLearnable = (id: SpellId): boolean => LEARNABLE.includes(id);

// Known, and onto the first free slot of the bar (on it already: left where it is); what's said of it.
export function grantCharm(hero: Pick<Hero, 'spells' | 'actionBar'>, id: SpellId): string {
  learn(hero, id);
  if (hero.actionBar.includes(spellKey(id))) return `${SPELLS[id].name} is on your bar already.`;
  const free = hero.actionBar.indexOf(null);
  return free >= 0 && setAction(hero, free, spellKey(id)) ? `${SPELLS[id].name}: on your bar, key ${free + 1}.` : `${SPELLS[id].name}: known, but your bar is full. Clear a slot (right-click it) to cast it.`;
}

// The hero reading a scroll from their bag: its charm learned (and the scroll gone: it crumbles as it's read), or
// known already (kept); what's said of it. Null: no scroll of theirs.
export function readScroll(hero: Pick<Hero, 'spells' | 'actionBar' | 'bag'>, item: string): string | null {
  if (!isScroll(item) || !(hero.bag[item] ?? 0)) return null;
  const id = SCROLL_SPELL[item];
  if (knows(hero, id)) return `You know the ${SPELLS[id].name} already.`;
  takeFromBag(hero.bag, item);
  return `You read it through twice, and it crumbles. ${grantCharm(hero, id)}`;
}
