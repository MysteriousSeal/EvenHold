// The spellbook (N, or its tile on the toolbar): the charms the hero knows (model/spells/spells.ts), a slot each:
// what it is and does, what it costs. Dragged onto the action bar (or clicked: the first free slot), a shortcut to
// it there, cast with the slot's key. None known: where they're taught. A small window in the corner: the game goes
// on while it's open.
import type { GameModel } from '../../model/GameModel';
import { setAction } from '../../model/hero/actionBar';
import { SPELLS, spellKey, spellText, type SpellId } from '../../model/spells/spells';
import { createMenu, type Menu, type MenuSlot } from '../../view/ui/menu';
import { el } from '../../view/ui/dom';
import { SPELL_ICONS } from '../../view/ui/spellIcons';

const COLUMNS = 4;

export function createSpellbook(model: GameModel): { menu: Menu; update(): void } {
  const { hero } = model;
  // Onto the first free slot of the bar (already on it: left where it is); what's said of it.
  const ontoBar = (id: SpellId): string => {
    if (hero.actionBar.includes(spellKey(id))) return `${SPELLS[id].name} is on your bar already.`;
    const free = hero.actionBar.indexOf(null);
    return free >= 0 && setAction(hero, free, spellKey(id)) ? `${SPELLS[id].name}: on your bar, key ${free + 1}.` : 'Your bar is full: drag it onto the slot you want it in.';
  };
  const cell = (id: SpellId): MenuSlot => ({
    icon: SPELL_ICONS[id],
    title: SPELLS[id].name,
    lines: [
      { text: 'Charm', tone: 'kind' },
      { text: spellText(id), tone: 'stat' },
      { text: SPELLS[id].about, tone: 'flavor' },
      { text: 'Click to put it on the action bar, or drag it onto the slot you want', tone: 'hint' },
    ],
    use: () => ontoBar(id),
    dragOut: (over) => {
      const slot = over?.closest<HTMLElement>('.action-slot');
      if (slot) setAction(hero, Number(slot.dataset.slot), spellKey(id));
    },
  });
  const known = () => hero.spells ?? [];
  const menu = createMenu({
    title: 'Spellbook',
    toggleKey: 'KeyN',
    keyHints: false,
    modal: false,
    place: 'bottom-right',
    tabs: [
      {
        name: 'Charms',
        header: () => el('p', 'menu-detail-hint', known().length ? 'The charms you know. Each spends Breath, then wants a while before it works again.' : "You know no charms yet. A village's hedge-witch teaches them for coin: you'll find her in the herbalist's hut."),
        slots: () => ({ cells: known().map(cell), columns: COLUMNS }),
      },
    ],
  });
  // Kept up with while open: redrawn as one's learned.
  let seen = -1;
  const update = () => {
    if (!menu.isOpen || seen === known().length) return;
    seen = known().length;
    menu.refresh();
  };
  return { menu, update };
}
