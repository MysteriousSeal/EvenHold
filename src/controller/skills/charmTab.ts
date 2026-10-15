// The skills window's Charms tab: every charm the hero knows (model/spells/spells.ts), a row each, its icon, name and
// what it does; whether it's on the action bar (and on which key), else clicked (or dragged onto a slot of the bar)
// to put it back there: a charm cleared off the bar is never lost. None known yet: where charms are had.
import type { GameModel } from '../../model/GameModel';
import { setAction } from '../../model/hero/actionBar';
import { grantCharm } from '../../model/spells/charmLore';
import { AIM_WORDS, SPELLS, SPELL_IDS, knows, spellKey, spellText, type SpellId } from '../../model/spells/spells';
import { line } from '../../view/ui/dom';
import { toned, type MenuSlot, type MenuTab } from '../../view/ui/menuTypes';
import { SPELL_ICONS } from '../../view/ui/spellIcons';

const NONE = "You know no charms. A hedge-witch teaches some, in one village in three; others are written down in the dark, on the dead.";
const LEAD = 'Click a charm to put it on your action bar, or drag it onto a slot.';

// A known charm's row.
export function charmRow(model: Pick<GameModel, 'hero'>, id: SpellId): MenuSlot {
  const { hero } = model;
  const at = hero.actionBar.indexOf(spellKey(id));
  return {
    icon: SPELL_ICONS[id],
    title: SPELLS[id].name,
    note: at >= 0 ? `On your bar, key ${at + 1}` : 'Not on your bar: click to put it there',
    lines: [toned('kind', `Charm · ${AIM_WORDS[SPELLS[id].aim]}`), toned('stat', spellText(id)), toned('flavor', SPELLS[id].about)],
    use: () => grantCharm(hero, id),
    dragOut: (over) => {
      const slot = over?.closest<HTMLElement>('.action-slot');
      if (slot) setAction(hero, Number(slot.dataset.slot), spellKey(id));
    },
  };
}

export const charmsTab = (model: Pick<GameModel, 'hero'>): MenuTab => ({
  name: 'Charms',
  header: () => line('quest-board-lead', SPELL_IDS.some((id) => knows(model.hero, id)) ? LEAD : NONE),
  slots: () => ({ cells: SPELL_IDS.filter((id) => knows(model.hero, id)).map((id) => charmRow(model, id)), columns: 1, rows: true }),
});
