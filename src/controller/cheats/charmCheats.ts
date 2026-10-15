// The charms, handed out from the cheat menu (cheatPanel.ts: its Charms tab), the turnings too (taught by no one
// in the game, nor written down: model/spells/charmLore.ts): a row each. Picked: known to the hero from then on, and
// on the first free slot of their action bar (cast with the slot's key, at whoever's picked out or the foe before them).
import type { GameModel } from '../../model/GameModel';
import { grantCharm as grant } from '../../model/spells/charmLore';
import { AIM_WORDS, SPELLS, SPELL_IDS, spellText, type SpellId } from '../../model/spells/spells';
import type { MenuAction } from '../../view/ui/menu';
import { SPELL_ICONS } from '../../view/ui/spellIcons';

// Known, and onto the first free slot of the bar (on it already: left where it is); what's said of it.
export const grantCharm = (model: Pick<GameModel, 'hero'>, id: SpellId): string => grant(model.hero, id);

// A row for each charm: those that turn someone first (what they're for), then the rest.
export function charmActions(model: Pick<GameModel, 'hero'>): MenuAction[] {
  const row = (id: SpellId): MenuAction => ({ icon: SPELL_ICONS[id], title: SPELLS[id].name, detail: `${AIM_WORDS[SPELLS[id].aim]} · ${spellText(id)}`, run: () => grantCharm(model, id) });
  const turning = SPELL_IDS.filter((id) => SPELLS[id].turns || SPELLS[id].swaps);
  const rest = SPELL_IDS.filter((id) => !turning.includes(id));
  const under = (section: string, ids: SpellId[]) => ids.map((id, i) => (i === 0 ? { ...row(id), section } : row(id)));
  return [...under('Turn someone', turning), ...under('Others', rest), { section: 'All of them', icon: SPELL_ICONS.swap, title: 'Every charm', detail: 'All known, as many on your bar as it has room for', run: () => (SPELL_IDS.forEach((id) => grantCharm(model, id)), 'Every charm known.') }];
}
