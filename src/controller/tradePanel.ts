// Trading with a shopkeeper (the barmaid, the smith): their wares to buy,
// and what the hero has they'll take, in a grid on the left; the one chosen
// is told of on the right, with the button to buy (or sell) it at its price;
// PAGE of them to a page, with buttons to turn the pages; both purses under them, and the keeper's face and word over them. A
// window in the middle of the screen; the game waits while it's open. What's
// traded, at what price, and what they say, is the shop's own (a Trade).

import './shopPanel.css';
import type { GameModel } from '../model/GameModel';
import type { Npc } from '../model/npcs/npcs';
import { nameOf, type BagItem } from '../model/hero/bag';
import { restockIn, type Shop } from '../model/shops/shopStock';
import { coinParts } from '../view/ui/coins';
import { bagIcon } from '../view/ui/itemIcons';
import { createMenu, type Menu, type MenuSlot } from '../view/ui/menu';
import { detailParts } from '../view/ui/menuDetail';
import { voxelIcon } from '../view/ui/voxelIcon';
import { humanBust } from '../view/meshes/human/humanFigure';

// What a trade's keeper says, by occasion: on opening, and answering each trade.
export type TradeLines = Record<'hello' | 'bought' | 'sold' | 'sold out' | 'too poor' | 'short', readonly string[]>;

// A shop, as its window needs it.
export interface Trade {
  title: string; // "Wares"
  shop(): Shop;
  wares(): BagItem[]; // to buy (sold out too: shown, not to be had)
  wanted(id: string): id is BagItem; // what they'll buy off the hero
  price(id: BagItem, selling: boolean): number;
  trade(id: BagItem, selling: boolean): 'bought' | 'sold' | 'sold out' | 'too poor' | 'short' | 'none' | 'not wanted';
  lines: TradeLines;
  about(id: BagItem): string; // their word on one of their wares, picked out
  offered(name: string): string; // their word on what the hero offers
  blurb(id: BagItem): string; // what it is
  facts(id: BagItem): Array<[string, string]>; // besides its price and count
  pays: string; // "She pays"
  cantPay: string; // "She hasn't the coin for that."
  none: { buy: string; sell: string }; // an empty tab's hint
}

export const pick = (lines: readonly string[]) => lines[Math.floor(Math.random() * lines.length)];

// A time left as minutes and seconds: "0:42".
export const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const COLUMNS = 4;
const ROWS = 2; // at least, so an empty tab isn't a sliver
const PAGE = COLUMNS * 5; // wares to a page

// Both purses, the keeper's on the left and the hero's on the right, each named.
function purses(name: string, shop: Shop, hero: number): HTMLElement {
  const row = document.createElement('div');
  row.className = 'menu-purse shop-purses';
  const purse = (who: string, money: number) => {
    const side = document.createElement('span');
    side.className = 'shop-purse';
    const label = document.createElement('b');
    label.textContent = who;
    side.append(label, ...coinParts(money, true));
    return side;
  };
  row.append(purse(name, shop.money), purse('You', hero));
  return row;
}

export function createTradePanel(model: GameModel, hooks: { setPaused(paused: boolean): void }, trade: Trade): { open(keeper: Npc): void; menu: Menu } {
  const shop = () => trade.shop();
  const items = new WeakMap<MenuSlot, BagItem>(); // what each slot shown is
  let keeper: Npc | null = null;
  let says = ''; // what they're saying: a greeting, a word on what's picked, or an answer to a trade
  let saysLine: HTMLElement | null = null; // where it's shown now
  let drawn = false; // the tab was just drawn: its first pick is the menu's, not the hero's
  let trading = false; // redrawing after a trade: its picks are the menu's too
  // Each tab's page (Buy, Sell), and how many it has now.
  const pages = [{ at: 0, of: 1 }, { at: 0, of: 1 }];
  // One page of a tab's slots; more than a page, every page is a whole one, so the window keeps its size.
  const fill = (tab: number, all: MenuSlot[]) => {
    const page = pages[tab];
    page.of = Math.max(1, Math.ceil(all.length / PAGE));
    page.at = Math.min(page.at, page.of - 1); // (sold the last of a page's)
    const cells: Array<MenuSlot | null> = all.slice(page.at * PAGE, (page.at + 1) * PAGE);
    while (cells.length < (page.of > 1 ? PAGE : COLUMNS * ROWS)) cells.push(null);
    return { cells, columns: COLUMNS };
  };
  // Under the grid: the buttons to turn the pages (if there's more than one), then both purses.
  const footer = (tab: number) => () => {
    const box = document.createElement('div');
    const page = pages[tab];
    if (page.of > 1) {
      const pager = document.createElement('div');
      pager.className = 'shop-pager';
      const turn = (label: string, to: number) => {
        const button = document.createElement('button');
        button.className = 'shop-page-turn';
        button.textContent = label;
        button.disabled = to < 0 || to >= page.of;
        button.addEventListener('click', () => {
          page.at = to;
          menu.refresh();
        });
        return button;
      };
      pager.append(turn('‹ Previous', page.at - 1), line('shop-page', `Page ${page.at + 1} of ${page.of}`), turn('Next ›', page.at + 1));
      box.append(pager);
    }
    box.append(purses(keeper!.name, shop(), model.hero.money));
    return box;
  };
  const slotOf = (id: BagItem, count: number, price: number): MenuSlot => {
    // Sold out: faded, with the time until there's more in its corner.
    const slot: MenuSlot = { icon: bagIcon(id), badge: count > 0 ? `×${count}` : `↻ ${clock(restockIn(shop()))}`, dim: count <= 0, title: nameOf(id), tag: coinParts(price) };
    items.set(slot, id);
    return slot;
  };
  // The panel on the right: the item chosen, what it's worth, and the button to trade it.
  const detail = (selling: boolean) => (slot: MenuSlot | null) => {
    const pane = document.createElement('div');
    const id = slot && items.get(slot);
    // The hero picking something out (again, too): the keeper says a word about it.
    if (id && !drawn && !trading && saysLine) {
      says = selling ? trade.offered(nameOf(id)) : (shop().stock[id] ?? 0) <= 0 ? pick(trade.lines['sold out']) : trade.about(id); // sold out: they say so
      saysLine.textContent = `“${says}”`;
    }
    drawn = false;
    if (!id) {
      pane.append(line('menu-detail-hint', selling ? trade.none.sell : trade.none.buy));
      return pane;
    }
    const price = trade.price(id, selling);
    const { icon, facts, fact } = detailParts(bagIcon(id)(72));
    fact(selling ? trade.pays : 'Price', coinParts(price));
    for (const [label, value] of trade.facts(id)) fact(label, [value]);
    const soldOut = !selling && (shop().stock[id] ?? 0) <= 0;
    fact(selling ? 'You have' : 'In stock', [selling ? String(model.hero.bag[id] ?? 0) : soldOut ? 'Sold out' : String(shop().stock[id])]);
    if (soldOut) fact('Back in', [clock(restockIn(shop()))]);
    pane.append(icon, line('menu-detail-name', nameOf(id)), line('menu-detail-about', trade.blurb(id)), facts);
    const why = selling
      ? shop().money < price
        ? trade.cantPay
        : ''
      : soldOut
        ? `Sold out · back in ${clock(restockIn(shop()))}`
        : model.hero.money < price
          ? "You can't afford that."
          : '';
    const button = document.createElement('button');
    button.className = 'menu-detail-button';
    button.textContent = selling ? 'Sell one' : 'Buy one';
    // Can't be had: it looks it, but a click still asks, and they say why.
    button.classList.toggle('unavailable', !!why);
    button.addEventListener('click', () => {
      const result = trade.trade(id, selling);
      if (result in trade.lines) says = pick(trade.lines[result as keyof TradeLines]);
      trading = true; // their answer stands through the redraw
      menu.refresh();
      trading = false;
    });
    pane.append(line('menu-detail-said', why), button);
    return pane;
  };
  // The keeper talking, over the tab (drawn afresh with it: its first pick isn't the hero's).
  const header = () => {
    drawn = true;
    const row = talk(keeper!, says);
    saysLine = row.querySelector('.shop-talk-says');
    return row;
  };
  // While open, and anything's sold out, the countdowns tick each second (quietly:
  // they don't speak for it); when one runs out, what's restocked shows at once.
  let ticker = 0;
  const tick = () => {
    if (!trade.wares().some((id) => (shop().stock[id] ?? 0) <= 0)) return;
    trading = true;
    menu.refresh();
    trading = false;
  };
  const menu = createMenu({
    title: trade.title,
    keyHints: false,
    onOpenChange: (open) => {
      hooks.setPaused(open);
      window.clearInterval(ticker);
      if (open) ticker = window.setInterval(tick, 1000);
    },
    tabs: [
      {
        name: 'Buy',
        slots: () => fill(0, trade.wares().map((id) => slotOf(id, shop().stock[id] ?? 0, trade.price(id, false)))),
        detail: detail(false),
        header: () => header(),
        footer: footer(0),
      },
      {
        name: 'Sell',
        slots: () => fill(1, (Object.keys(model.hero.bag) as string[]).filter((id): id is BagItem => trade.wanted(id) && (model.hero.bag[id] ?? 0) > 0).map((id) => slotOf(id, model.hero.bag[id]!, trade.price(id, true)))),
        detail: detail(true),
        header: () => header(),
        footer: footer(1),
      },
    ],
  });
  return {
    menu,
    open(npc) {
      keeper = npc;
      for (const page of pages) page.at = 0;
      says = pick(trade.lines.hello);
      menu.setTitle(`${npc.name}'s ${trade.title.toLowerCase()}`);
      menu.open();
    },
  };
}

// The keeper, talking: their face on the left, their name and what they say in a bubble.
function talk(npc: Npc, says: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'shop-talk';
  const face = document.createElement('div');
  face.className = 'shop-talk-face';
  face.append(voxelIcon(`npc:${npc.id}`, () => humanBust(npc.look, npc.equipment, 'right'), 56));
  const bubble = document.createElement('div');
  bubble.className = 'shop-talk-bubble';
  bubble.append(line('shop-talk-name', npc.name), line('shop-talk-says', `“${says}”`));
  row.append(face, bubble);
  return row;
}

function line(className: string, text: string): HTMLElement {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  return node;
}
