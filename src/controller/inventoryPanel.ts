// The hero's bag, opened and closed with B: a grid of slots in the shared
// menu (view/ui/menu.ts), one per kind of thing carried, loot and gear, with
// its voxel icon and how many; hover one for what it is. Drag loot out onto
// the world to drop it; drag gear onto the hero sheet (C) to wear it, or
// onto the world to put it down; drag it onto another slot of the bag to
// move it there. The game plays on around it: it only takes Escape and B.
// While trading (a shop's window open beside it), right-clicking what the
// keeper would buy, or dragging it onto their window, sells it; what they
// wouldn't is greyed out. Away from shops, each thing says what it'd fetch.
// A button by the purse tidies it (bag.ts: sortedBag).

import { coinParts, coinWords } from '../view/ui/coins';
import type { GameModel } from '../model/GameModel';
import { bagLayout, moveInBag, sortedBag, type BagItem } from '../model/hero/bag';
import { ITEMS, SLOT_NAMES, type ItemId } from '../model/human/equipment';
import { LOOT, LOOT_QUALITY } from '../model/loot/loot';
import { PROVISIONS, isProvision } from '../model/loot/provisions';
import { sellValue } from '../model/shops/sellValue';
import { createMenu, type Menu, type MenuSlot } from '../view/ui/menu';
import { bagIcon, isLoot } from '../view/ui/itemIcons';

const COLUMNS = 6;
const ROWS = 4;
const QUALITY_NAMES = { junk: 'Junk', ingredient: 'Cooking ingredient', common: 'Food & drink', quest: 'Quest item' } as const;

// A shop the hero's trading with: what its keeper would buy, for how much, and selling it them.
export interface Seller {
  wants(item: BagItem): boolean;
  price(item: BagItem): number;
  sell(item: BagItem): void;
}

// Onto the shop's window (the one with its keeper talking).
const ontoShop = (over: Element | null) => !!over?.closest('.menu')?.querySelector('.shop-talk');

function slotFor(model: GameModel, item: BagItem, count: number, seller: Seller | null): MenuSlot {
  const base = baseSlot(model, item, count);
  const value = sellValue(item);
  const slot = value === null ? base : { ...base, lines: [...(base.lines ?? []), `Sell price: ${coinWords(value)}`] };
  if (!seller) return slot;
  if (!seller.wants(item)) return { ...slot, dim: true, lines: [...(slot.lines ?? []), 'Not bought here'] };
  // Trading: right-click (or drag onto the shop) sells it, instead of what it'd do.
  const dragOut = slot.dragOut;
  return {
    ...slot,
    lines: [...(slot.lines ?? []).filter((line) => !line.startsWith('Right-click') && !line.startsWith('Sell price')), `Right-click to sell for ${coinWords(seller.price(item))}`],
    alt: () => seller.sell(item),
    dragOut: (over) => (ontoShop(over) ? seller.sell(item) : dragOut?.(over)),
  };
}

function baseSlot(model: GameModel, item: BagItem, count: number): MenuSlot {
  if (isLoot(item)) {
    return {
      icon: bagIcon(item),
      count,
      title: LOOT[item].name,
      tone: LOOT_QUALITY[item],
      lines: isProvision(item)
        ? [`${QUALITY_NAMES[LOOT_QUALITY[item]]} · heals ${PROVISIONS[item].heal}`, `Right-click to ${PROVISIONS[item].drink ? 'drink' : 'eat'} it`]
        : [QUALITY_NAMES[LOOT_QUALITY[item]]],
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

// Under the bag: the button to tidy it, and the purse (gold, silver and copper, each by its coin).
function footer(money: number, tidy: () => void): HTMLElement {
  const line = document.createElement('div');
  line.className = 'menu-purse bag-footer';
  const sort = document.createElement('button');
  sort.className = 'bag-sort';
  sort.textContent = 'Sort';
  sort.title = 'Tidy the bag: gear, food and drink, ingredients, quest items, junk';
  sort.addEventListener('click', tidy);
  const coins = document.createElement('span');
  coins.className = 'bag-coins';
  coins.append(...coinParts(money, true));
  line.append(sort, coins);
  return line;
}

// Returns the bag's menu, and the function to call each frame (it redraws
// the bag when what's in it changed).
// `trade(seller)`: a shop opened beside it (null: closed).
export function createInventoryPanel(model: GameModel): { menu: Menu; update(): void; trade(seller: Seller | null): void } {
  let seller: Seller | null = null;
  const menu = createMenu({
    title: 'Bag',
    toggleKey: 'KeyB',
    keyHints: false,
    modal: false,
    tabs: [
      {
        name: 'Bag',
        // Each thing in its own slot, where the hero's put it; drag one onto
        // another slot to move it there (swapping with what's there).
        slots: () => {
          const { hero } = model;
          const cells = bagLayout(hero.bag, hero.bagOrder, COLUMNS * ROWS).map((item, i): MenuSlot | null => {
            if (!item) return null;
            const slot = slotFor(model, item, hero.bag[item]!, seller);
            slot.move = (to) => (hero.bagOrder = moveInBag(hero.bag, hero.bagOrder, i, to, COLUMNS * ROWS));
            return slot;
          });
          return { cells, columns: COLUMNS };
        },
        footer: () =>
          footer(model.hero.money, () => {
            model.hero.bagOrder = sortedBag(model.hero.bag);
            menu.refresh();
          }),
      },
    ],
  });
  let shown = '';
  const update = () => {
    const contents = JSON.stringify([model.hero.bag, model.hero.bagOrder, model.hero.money]);
    if (contents === shown) return;
    shown = contents;
    menu.refresh();
  };
  const trade = (next: Seller | null) => {
    seller = next;
    menu.refresh();
  };
  return { menu, update, trade };
}
