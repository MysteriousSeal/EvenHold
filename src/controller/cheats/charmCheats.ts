// The charms, handed out from the cheat menu (cheatPanel.ts: its Charms tab), there being no one to teach them nor
// any book of them in the game (model/spells/spells.ts): a row each. Picked: known to the hero from then on, and on
// the first free slot of their action bar (cast with the slot's key, at whoever's picked out or the foe before them).
import type { GameModel } from '../../model/GameModel';
import { setAction } from '../../model/hero/actionBar';
import { AIM_WORDS, SPELLS, SPELL_IDS, learn, spellKey, spellText, type SpellId } from '../../model/spells/spells';
import type { MenuAction } from '../../view/ui/menu';
import { SPELL_ICONS } from '../../view/ui/spellIcons';

// Known, and onto the first free slot of the bar (on it already: left where it is); what's said of it.
export function grantCharm(model: Pick<GameModel, 'hero'>, id: SpellId): string {
  const { hero } = model;
  learn(hero, id);
  if (hero.actionBar.includes(spellKey(id))) return `${SPELLS[id].name} is on your bar already.`;
  const free = hero.actionBar.indexOf(null);
  return free >= 0 && setAction(hero, free, spellKey(id)) ? `${SPELLS[id].name}: on your bar, key ${free + 1}.` : `${SPELLS[id].name}: known, but your bar is full. Clear a slot (right-click it) and pick it again.`;
}

// A row for each charm: those that turn someone first (what they're for), then the rest.
export function charmActions(model: Pick<GameModel, 'hero'>): MenuAction[] {
  const row = (id: SpellId): MenuAction => ({ icon: SPELL_ICONS[id], title: SPELLS[id].name, detail: `${AIM_WORDS[SPELLS[id].aim]} · ${spellText(id)}`, run: () => grantCharm(model, id) });
  const turning = SPELL_IDS.filter((id) => SPELLS[id].turns || SPELLS[id].swaps);
  const rest = SPELL_IDS.filter((id) => !turning.includes(id));
  const under = (section: string, ids: SpellId[]) => ids.map((id, i) => (i === 0 ? { ...row(id), section } : row(id)));
  return [...under('Turn someone', turning), ...under('Others', rest), { section: 'All of them', icon: SPELL_ICONS.swap, title: 'Every charm', detail: 'All known, as many on your bar as it has room for', run: () => (SPELL_IDS.forEach((id) => grantCharm(model, id)), 'Every charm known.') }];
}
