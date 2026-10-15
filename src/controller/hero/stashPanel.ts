// The hero's strongbox (E at an inn's strongbox, or the let room's chest: model/hero/stash.ts), in the shared menu: its
// STASH_SLOTS slots, a stack to each, with how many of them are taken. The bag opens beside it: right-click a stack
// there (or drag it onto this window) to put it in; right-click one here (or drag it onto the bag) to take it out. Two
// buttons put all the junk, or all the crafting materials, in at once. Modeless, on the left (the bag on the right): walk off
// from the strongbox and it shuts (the bag too, unless it was open already).
import './stashPanel.css';
import type { GameModel } from '../../model/GameModel';
import { nameOf, qualityOf, kindOf, type BagItem } from '../../model/hero/bag';
import { STASH_SLOTS, retrieve, stashSlots, stashUsed, store, storeAll, strongboxInReach } from '../../model/hero/stash';
import { bagIcon, bagItemPreview } from '../../view/ui/itemIcons';
import { createMenu, toned, type Menu, type MenuSlot } from '../../view/ui/menu';
import { el, line } from '../../view/ui/dom';
import { counted } from '../../view/ui/words';

const COLUMNS = 10;

// The bag beside it, as the strongbox opens it: putting things in from it.
export interface StashBag {
  menu: Menu;
  store(storer: Storer | null): void;
}

// What the bag beside it does with a stack: puts it in the strongbox (what's said of it, for the window's foot).
export interface Storer {
  put(item: BagItem, count: number): void;
}

// Onto the strongbox's window.
export const ontoStash = (over: Element | null) => !!over?.closest('.menu')?.querySelector('.stash-note');

export function createStashPanel(model: GameModel, hooks: { bag?: StashBag }): { open(): void; update(): void; menu: Menu } {
  const { hero } = model;
  let said = '';
  const tell = (text: string) => {
    said = text;
    menu.refresh();
  };
  const storer: Storer = {
    put: (item, count) => {
      const n = store(hero, item, count);
      tell(n > 0 ? `Put away: ${n > 1 ? `${n} ` : ''}${nameOf(item)}.` : 'The strongbox is full.');
    },
  };
  // A stack in it: right-click (or drag it onto the bag) to take it out.
  const cell = (item: BagItem, count: number): MenuSlot => {
    const out = () => {
      const n = retrieve(hero, item, count);
      tell(n > 0 ? `Taken out: ${n > 1 ? `${n} ` : ''}${nameOf(item)}.` : 'Your bag is full.');
    };
    return {
      icon: bagIcon(item),
      count,
      title: nameOf(item),
      tone: qualityOf(item),
      key: item,
      preview: bagItemPreview(item),
      lines: [toned('kind', kindOf(item)), toned('hint', 'Right-click (or drag it onto your bag) to take it out')],
      alt: out,
      dragOut: (over) => void (over?.closest('.menu') && !ontoStash(over) && out()),
    };
  };
  const all = (group: 'junk' | 'ingredient', what: string) => {
    const { stored, left } = storeAll(hero, group);
    tell(stored === 0 ? (left ? 'The strongbox is full.' : `No ${what} in your bag.`) : `Put away ${counted(stored, 'thing')}${left ? ': the strongbox is full' : ''}.`);
  };
  const footer = () => {
    const box = el('div', 'stash-foot');
    const bar = el('div', 'stash-bar');
    for (const [label, group, what] of [['Store junk', 'junk', 'junk'], ['Store materials', 'ingredient', 'crafting materials']] as const) {
      const button = el('button', 'menu-button stash-all', label);
      button.addEventListener('click', () => all(group, what));
      bar.append(button);
    }
    box.append(bar, line('stash-note', `${stashUsed(hero.stash ?? {})} of ${STASH_SLOTS} slots · the same strongbox at every inn`));
    if (said) box.append(line('stash-said', said));
    return box;
  };
  let bagWasOpen = false;
  const menu = createMenu({
    title: 'Strongbox',
    keyHints: false,
    modal: false,
    place: 'left', // (beside the bag, at the bottom right: neither over the other)
    onOpenChange: (open) => {
      said = '';
      const { bag } = hooks;
      if (!bag) return;
      if (open) {
        bagWasOpen = bag.menu.isOpen;
        bag.menu.open();
      } else if (!bagWasOpen) bag.menu.close();
      bag.store(open ? storer : null);
    },
    tabs: [
      {
        name: 'Strongbox',
        slots: () => {
          const cells: Array<MenuSlot | null> = stashSlots(hero.stash ?? {}).map(({ item, count }) => cell(item, count));
          while (cells.length < STASH_SLOTS) cells.push(null);
          return { cells, columns: COLUMNS };
        },
        footer,
      },
    ],
  });
  let shown = '';
  return {
    menu,
    open: () => menu.open(0),
    // Each frame: walked off from the strongbox, it shuts; what's in it changed (a stack put in from the bag), redrawn.
    update() {
      if (!menu.isOpen) return;
      if (!strongboxInReach(model)) return menu.close();
      const contents = JSON.stringify(hero.stash ?? {});
      if (contents !== shown) [(shown = contents), menu.refresh()];
    },
  };
}
