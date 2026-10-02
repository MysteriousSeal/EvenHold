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

import { coinParts, coinWords } from '../../view/ui/coins';
import type { GameModel } from '../../model/GameModel';
import { bagLayout, layoutCounts, moveInBag, sortedBag, type BagItem } from '../../model/hero/bag';
import { BAG_SOCKETS, ROOM_PER_BAG, bagRoom, fitBag, unfitBag } from '../../model/hero/bagSlots';
import { isBagItem, type BagId } from '../../model/loot/bags';
import { ITEMS, SLOT_NAMES, type ItemId } from '../../model/human/equipment';
import { LOOT, LOOT_QUALITY } from '../../model/loot/loot';
import { PROVISIONS, givesText, isProvision } from '../../model/loot/provisions';
import { sellValue } from '../../model/shops/sellValue';
import { gearLines } from './gearLines';
import { createMenu, type Menu, type MenuSlot } from '../../view/ui/menu';
import { bagIcon, isLoot } from '../../view/ui/itemIcons';
import { voxelIcon } from '../../view/ui/voxelIcon';
import { BAG_MODELS } from '../../view/meshes/loot/bagVoxels';

const COLUMNS = 6;
const SOCKET_ROW = BAG_SOCKETS; // the sockets, the first row; the bag's own slots from there (on a row of their own: the separator spans the grid)
const QUALITY_NAMES = { junk: 'Junk', ingredient: 'Cooking ingredient', common: 'Food & drink', quest: 'Quest item', bag: `Bag · +${ROOM_PER_BAG} slots` } as const;

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
        ? [`${QUALITY_NAMES[LOOT_QUALITY[item]]} · ${givesText(item)}`, `Right-click to ${PROVISIONS[item].drink ? 'drink' : 'eat'} it`]
        : isBagItem(item)
          ? [QUALITY_NAMES.bag, 'Drag onto a bag socket (or right-click) to fit it']
          : [QUALITY_NAMES[LOOT_QUALITY[item]]],
      alt: isProvision(item)
        ? () => (model.consume(item) ? `You ${PROVISIONS[item].drink ? 'drink' : 'eat'} the ${LOOT[item].name}.` : '')
        : isBagItem(item)
          ? () => (fitBag(model.hero, item) ? `The ${LOOT[item].name} is fitted: ${ROOM_PER_BAG} more slots.` : 'Every bag socket is taken.')
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
    lines: [SLOT_NAMES[ITEMS[gear].slot], ...gearLines(gear), `Drag onto your hero's ${SLOT_NAMES[ITEMS[gear].slot].toLowerCase()} slot to wear it`],
    fits: ITEMS[gear].slot,
    // Only its own slot on the hero sheet takes it; the world, the ground.
    dragOut: (over) => {
      const target = over?.closest<HTMLElement>('[data-accepts]');
      if (target?.dataset.accepts === ITEMS[gear].slot) model.equipFromBag(gear);
      else if (!over?.closest('.menu')) model.dropFromBag(gear);
    },
  };
}

// A fitted bag in socket `socket`: off with a right-click, or dragged down into the bag's slots (from `slotsFrom` on).
function socketSlot(model: GameModel, socket: number, fitted: BagId, slotsFrom: number): MenuSlot {
  const off = () => (unfitBag(model.hero, socket) ? `The ${LOOT[fitted].name} is off, back in the bag.` : 'Make room first: what it holds has nowhere else to go.');
  return {
    icon: bagIcon(fitted),
    title: LOOT[fitted].name,
    tone: 'bag',
    lines: [`Fitted · +${ROOM_PER_BAG} slots`, 'Right-click (or drag it down into the bag) to take it off'],
    alt: off,
    move: (to) => void (to >= slotsFrom && off()),
  };
}

// A socket with no bag in it.
const emptySocket = (): MenuSlot => ({
  icon: (size) => voxelIcon('bag-socket', () => ({ grid: BAG_MODELS.roughSack.build(), palette: BAG_MODELS.roughSack.palette, alpha: 0.22 }), size), // (a faint sack: a bag goes here)
  title: 'Bag socket',
  lines: [`Empty: fit a bag for ${ROOM_PER_BAG} more slots`, 'Drag one here, or right-click it in the bag'],
  dim: true,
});

// Under the bag: the button to tidy it, and the purse (gold, silver and copper, each by its coin).
function footer(money: number, tidy: () => void): HTMLElement {
  const line = document.createElement('div');
  line.className = 'menu-purse bag-footer';
  const sort = document.createElement('button');
  sort.className = 'menu-button bag-sort';
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
          const room = bagRoom(hero);
          // The sockets on top, a row to themselves: a fitted bag (right-click, or drag it down into the bag, to take it
          // off), or an empty socket; then the bag's own slots.
          const top: Array<MenuSlot | null> = hero.bags.map((fitted, s) => (fitted ? socketSlot(model, s, fitted, SOCKET_ROW) : emptySocket()));
          const layout = bagLayout(hero.bag, hero.bagOrder, room);
          const counts = layoutCounts(hero.bag, layout); // (a stack's own: junk twenty to a slot at most)
          const cells = layout.map((item, i): MenuSlot | null => {
            if (!item) return null;
            const slot = slotFor(model, item, counts[i], seller);
            // Onto another of the bag's slots: moved there; a bag onto a free socket (on top): fitted there.
            slot.move = (to) => {
              if (to >= SOCKET_ROW) hero.bagOrder = moveInBag(hero.bag, hero.bagOrder, i, to - SOCKET_ROW, room);
              else if (isBagItem(item)) fitBag(hero, item, to);
            };
            return slot;
          });
          return { cells: [...top, ...cells], columns: COLUMNS, sections: [{ title: '', from: SOCKET_ROW }] }; // (the sockets the first row; a separator, then what's carried)
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
    const contents = JSON.stringify([model.hero.bag, model.hero.bagOrder, model.hero.bags, model.hero.money]);
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
