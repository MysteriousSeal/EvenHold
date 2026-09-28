// The hero's bag, opened and closed with B: a grid of slots in the shared
// menu (view/ui/menu.ts), one per kind of thing carried, loot and gear, with
// its voxel icon and how many; hover one for what it is. Drag loot out onto
// the world to drop it; drag gear onto the hero sheet (C) to wear it, or
// onto the world to put it down. The
// game plays on around it: it only takes Escape and B.

import { coinParts } from '../view/ui/coins';
import type { GameModel } from '../model/GameModel';
import type { BagItem } from '../model/hero/bag';
import { ITEMS, SLOT_NAMES, type ItemId } from '../model/human/equipment';
import { LOOT, LOOT_QUALITY } from '../model/loot/loot';
import { PROVISIONS, isProvision } from '../model/loot/provisions';
import { createMenu, type Menu, type MenuSlot } from '../view/ui/menu';
import { bagIcon, isLoot } from '../view/ui/itemIcons';

const COLUMNS = 6;
const ROWS = 4;
const QUALITY_NAMES = { junk: 'Junk', common: 'Food & drink' } as const;

function slotFor(model: GameModel, item: BagItem, count: number): MenuSlot {
  if (isLoot(item)) {
    return {
      icon: bagIcon(item),
      count,
      title: LOOT[item].name,
      tone: LOOT_QUALITY[item],
      lines: isProvision(item)
        ? [`${QUALITY_NAMES[LOOT_QUALITY[item]]} · heals ${PROVISIONS[item].heal}`, `Right-click to ${PROVISIONS[item].drink ? 'drink' : 'eat'} it`]
        : [`${QUALITY_NAMES[LOOT_QUALITY[item]]} · sells for ${LOOT[item].value} copper${count > 1 ? ' each' : ''}`],
      alt: isProvision(item)
        ? () => (model.consume(item) ? `You ${PROVISIONS[item].drink ? 'drink' : 'eat'} the ${LOOT[item].name}.` : '')
        : undefined,
      dragOut: (over) => {
        if (!over?.closest('.menu')) model.dropFromBag(item); // onto the world, not another window
      },
    };
  }
  const gear = item as ItemId;
  return {
    icon: bagIcon(gear),
    count,
    title: ITEMS[gear].name,
    lines: [SLOT_NAMES[ITEMS[gear].slot], `Drag onto your hero's ${SLOT_NAMES[ITEMS[gear].slot].toLowerCase()} slot to wear it`],
    fits: ITEMS[gear].slot,
    // Only its own slot on the hero sheet takes it; the world, the ground.
    dragOut: (over) => {
      const target = over?.closest<HTMLElement>('[data-accepts]');
      if (target?.dataset.accepts === ITEMS[gear].slot) model.equipFromBag(gear);
      else if (!over?.closest('.menu')) model.dropFromBag(gear);
    },
  };
}

// The purse, under the bag: gold, silver and copper, each by its coin.
function purse(money: number): HTMLElement {
  const line = document.createElement('div');
  line.className = 'menu-purse';
  line.append(...coinParts(money, true));
  return line;
}

// Returns the bag's menu, and the function to call each frame (it redraws
// the bag when what's in it changed).
export function createInventoryPanel(model: GameModel): { menu: Menu; update(): void } {
  const menu = createMenu({
    title: 'Bag',
    toggleKey: 'KeyB',
    keyHints: false,
    modal: false,
    tabs: [
      {
        name: 'Bag',
        slots: () => {
          const carried = (Object.entries(model.hero.bag) as Array<[BagItem, number]>).filter(([, count]) => count > 0);
          const cells: Array<MenuSlot | null> = carried.map(([item, count]) => slotFor(model, item, count));
          while (cells.length < COLUMNS * ROWS) cells.push(null);
          return { cells, columns: COLUMNS };
        },
        footer: () => purse(model.hero.money),
      },
    ],
  });
  let shown = '';
  const update = () => {
    const contents = JSON.stringify([model.hero.bag, model.hero.money]);
    if (contents === shown) return;
    shown = contents;
    menu.refresh();
  };
  return { menu, update };
}
