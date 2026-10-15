// What the hero does at a key (GameModel's): a blow started; a slot of the action bar used.
import { FOCUS_TURN_RANGE } from '../constants';
import type { GameModel } from '../GameModel';
import { armsSheathed } from '../interiors/indoors';
import { castSpell } from '../spells/casting';
import { SPELLS, isSpellKey, spellOf } from '../spells/spells';
import { useAction as useSlot } from './actionBar';
import type { BagItem } from './bag';
import { isPotion } from '../loot/potions';
import { PROVISIONS, isProvision } from '../loot/provisions';

// Starts a blow (combatMoves.ts) unless one's under way, they're rolling or out of breath, or arms are put away
// (an inn); whether it did. Turned to face the focused enemy if it's close by.
export function startAttack(m: GameModel): boolean {
  if (m.seated || armsSheathed(m.inside) || !m.moves.startBlow()) return false;
  m.report({ kind: 'swing' }); // (its whoosh)
  const focus = m.focused;
  if (focus && focus.state !== 'dead' && Math.hypot(focus.x - m.hero.x, focus.z - m.hero.z) <= FOCUS_TURN_RANGE) {
    m.hero.facing = Math.atan2(focus.x - m.hero.x, focus.z - m.hero.z);
  }
  return true;
}

// Off the action bar (hero/actionBar.ts): a bedroll, lain down on; a spell, cast (spells/casting.ts); else food, drink or a potion, had. Whether it did anything.
export function useAction(m: GameModel, i: number): boolean {
  const item = m.hero.actionBar[i];
  if (item === 'bedroll') return m.lieDown();
  // (A charm that harms no one, where arms are sheathed: cast all the same, in an inn, at its barkeep.)
  if (item && isSpellKey(item)) return (m.canFight || (!m.seated && !m.yard && !SPELLS[spellOf(item)].harm)) && castSpell(m, spellOf(item)) === 'cast';
  return useSlot(m.hero, i, (why) => m.report({ kind: 'poor', text: why })) && consumed(m, item!); // (a potion not to be drunk just now: told why, as from the bag)
}

// Something had (drunk, or eaten), told (its sound: view/audio/): true.
export function consumed(m: Pick<GameModel, 'report'>, item: BagItem): true {
  m.report({ kind: 'consumed', drink: isPotion(item) || (isProvision(item) && !!PROVISIONS[item].drink) });
  return true;
}
