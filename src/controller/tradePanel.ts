// Trading with a shopkeeper (the barmaid, the smith), the way of the old
// vendors: their wares in a list two to a row, 12 to a page with buttons
// to turn them, each with its price; hover one for what it is, right-click
// to buy it. The hero's bag opens beside it: right-click there (or drag onto
// this window) to sell. A Buyback tab holds what they last sold, at what they
// got. Both purses under it all, the keeper's face and word over it. A window
// in the middle of the screen; the game waits while it's open. What's traded,
// at what price, and what they say, is the shop's own (a Trade).

import './shopPanel.css';
import type { GameModel } from '../model/GameModel';
import type { Npc } from '../model/npcs/npcs';
import { nameOf, type BagItem } from '../model/hero/bag';
import { BUYBACK, buyBack, restockIn, type Shop } from '../model/shops/shopStock';
import { coinParts, coinWords } from '../view/ui/coins';
import { bagIcon } from '../view/ui/itemIcons';
import { createMenu, type Menu, type MenuSlot } from '../view/ui/menu';
import { voxelIcon } from '../view/ui/voxelIcon';
import { humanBust } from '../view/meshes/human/humanFigure';
import type { Seller } from './inventoryPanel';

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
  about(id: BagItem): string; // their word on one of their wares, just bought
  offered(name: string): string; // their word on what the hero's just sold them
  blurb(id: BagItem): string; // what it is
  facts(id: BagItem): Array<[string, string]>; // besides its price and count
}

// The hero's bag, as a shop's window opens it beside itself.
export interface TradeBag {
  menu: Menu;
  trade(seller: Seller | null): void;
}

export const pick = (lines: readonly string[]) => lines[Math.floor(Math.random() * lines.length)];

// A time left as minutes and seconds: "0:42".
export const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const COLUMNS = 2;
export const PAGE = { buy: COLUMNS * 6, buyback: BUYBACK }; // to a page: wares, and sales to buy back (all of them)
const LEAST = COLUMNS * 2; // an empty list is still two rows high

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

export function createTradePanel(model: GameModel, hooks: { setPaused(paused: boolean): void; bag?: TradeBag }, trade: Trade): { open(keeper: Npc): void; menu: Menu } {
  const shop = () => trade.shop();
  let keeper: Npc | null = null;
  let says = ''; // what they're saying: a greeting, or an answer to a trade
  // The keeper answers a trade (or a word of their own), and the window's redrawn with it.
  const answer = (result: string, word?: string) => {
    says = word ?? (result in trade.lines ? pick(trade.lines[result as keyof TradeLines]) : says);
    menu.refresh();
  };
  // Each tab's page (Buy, Buyback), how many it has now, and how many rows to one.
  const pages = [{ at: 0, of: 1, size: PAGE.buy }, { at: 0, of: 1, size: PAGE.buyback }];
  // One page of a tab's rows; more than a page, every page is a whole one, so the window keeps its size.
  const fill = (tab: number, all: MenuSlot[]) => {
    const page = pages[tab];
    page.of = Math.max(1, Math.ceil(all.length / page.size));
    page.at = Math.min(page.at, page.of - 1); // (bought back the last of a page's)
    const cells: Array<MenuSlot | null> = all.slice(page.at * page.size, (page.at + 1) * page.size);
    while (cells.length < (page.of > 1 ? page.size : LEAST) || cells.length % COLUMNS) cells.push(null);
    return { cells, columns: COLUMNS, rows: true };
  };
  // Under the list: the buttons to turn the pages (if there's more than one), then both purses.
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
  // One of their wares: its price, how many are left (or, sold out, faded, with the time till more);
  // hover it for what it is, right-click to buy one.
  const ware = (id: BagItem): MenuSlot => {
    const count = shop().stock[id] ?? 0;
    const price = trade.price(id, false);
    const back = clock(restockIn(shop()));
    return {
      icon: bagIcon(id),
      title: nameOf(id),
      key: id,
      tag: coinParts(price),
      badge: count > 0 ? `×${count}` : `↻ ${back}`,
      dim: count <= 0,
      lines: [
        trade.blurb(id),
        ...trade.facts(id).map(([label, value]) => `${label}: ${value}`),
        count > 0 ? `${count} in stock` : `Sold out · back in ${back}`,
        model.hero.money < price ? "You can't afford it" : 'Right-click to buy one',
      ],
      alt: () => {
        const result = trade.trade(id, false);
        answer(result, result === 'bought' ? trade.about(id) : undefined);
      },
    };
  };
  // One of the hero's last sales here: right-click to buy it back, at what they got.
  const sale = ({ id, price }: { id: BagItem; price: number }, i: number): MenuSlot => ({
    icon: bagIcon(id),
    title: nameOf(id),
    key: `${i}:${id}`,
    tag: coinParts(price),
    lines: [`You sold it for ${coinWords(price)}`, model.hero.money < price ? "You can't afford it" : 'Right-click to buy it back'],
    alt: () => answer(buyBack(shop(), model.hero, i)),
  });
  // Selling from the bag beside the window.
  const seller: Seller = {
    wants: (id) => trade.wanted(id),
    price: (id) => trade.price(id, true),
    sell: (id) => {
      const result = trade.trade(id, true);
      answer(result, result === 'sold' ? trade.offered(nameOf(id)) : undefined);
    },
  };
  // While open, and anything's sold out, the countdowns tick each second; when one runs out, what's restocked shows at once.
  let ticker = 0;
  const tick = () => {
    if (trade.wares().some((id) => (shop().stock[id] ?? 0) <= 0)) menu.refresh();
  };
  let bagWasOpen = false;
  const menu = createMenu({
    title: trade.title,
    keyHints: false,
    onOpenChange: (open) => {
      hooks.setPaused(open);
      window.clearInterval(ticker);
      if (open) ticker = window.setInterval(tick, 1000);
      // The bag opens beside the window, to sell from, and shuts with it (unless it was open already).
      const { bag } = hooks;
      if (!bag) return;
      if (open) {
        bagWasOpen = bag.menu.isOpen;
        bag.menu.open();
      } else if (!bagWasOpen) bag.menu.close();
      bag.trade(open ? seller : null);
    },
    tabs: [
      {
        name: 'Buy',
        slots: () => fill(0, trade.wares().map(ware)),
        header: () => talk(keeper!, says),
        footer: footer(0),
      },
      {
        name: 'Buyback',
        slots: () => fill(1, (shop().buyback ?? []).map(sale)),
        header: () => talk(keeper!, says),
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
