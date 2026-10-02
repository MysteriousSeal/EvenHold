// Trading with a shopkeeper (the barmaid, the smith), the way of the old
// vendors: their wares in a list two to a row, 12 to a page with buttons
// to turn them, each with its price; hover one for what it is, right-click
// to buy it (its price in red when it's more than the hero has). The hero's
// bag opens beside it: right-click there (or drag onto this window) to sell,
// or sell every bit of junk at once (anyone buys junk). A Buyback tab holds
// what they last sold, at what they got, in its 12 slots. Both purses under it
// all, the keeper's face and word over it. A window in the middle of the
// screen, but the game plays on around it: walk away from the keeper, and it
// shuts. What's traded, at what price, and what they say, is the shop's own (a Trade).

import './shopPanel.css';
import type { GameModel } from '../../model/GameModel';
import type { Npc } from '../../model/npcs/npcs';
import { nameOf, qualityOf, type BagItem } from '../../model/hero/bag';
import { BUYBACK, buyBack, restockIn, sellTo, type Sale, type Shop } from '../../model/shops/shopStock';
import { isJunk, sellValue } from '../../model/shops/sellValue';
import { TALK_RANGE } from '../../model/npcs/talk';
import { coinParts, coinWords } from '../../view/ui/coins';
import { bagIcon } from '../../view/ui/itemIcons';
import { createMenu, toned, type Menu, type MenuLine, type MenuSlot } from '../../view/ui/menu';
import { voxelIcon } from '../../view/ui/voxelIcon';
import { humanBust } from '../../view/meshes/human/humanFigure';
import type { Seller } from '../hero/inventoryPanel';
import { line } from '../../view/ui/dom';
import { plural } from '../../view/ui/words';

// What a trade's keeper says, by occasion: on opening, and answering each trade.
export type TradeLines = Record<'hello' | 'bought' | 'sold' | 'sold out' | 'too poor' | 'short', readonly string[]>;

// A shop, as its window needs it.
export interface Trade {
  title: string; // "Wares"
  shop(): Shop;
  wares(): BagItem[]; // to buy (sold out too: shown, not to be had)
  wanted(id: string): id is BagItem; // what they'll buy off the hero
  price(id: BagItem, selling: boolean): number;
  trade(id: BagItem, selling: boolean): 'bought' | 'sold' | 'sold out' | 'too poor' | 'short' | 'none' | 'not wanted' | 'full';
  lines: TradeLines;
  about(id: BagItem): string; // their word on one of their wares, just bought
  offered(name: string): string; // their word on what the hero's just sold them
  junk(name: string | null, paid: string): string; // and on junk sold them: one thing (its name), or a whole lot at once (null), and what they paid ("5 copper")
  boughtBack(name: string, paid: string): string; // and on the hero buying back what they'd sold (its name, "3 wolf fangs"), for what
  blurb(id: BagItem): string; // what it is
  facts(id: BagItem): MenuLine[]; // lines on what it is and does ("Armour 4"; what wearing it would change), besides its price and count
}

// Whom the hero trades with: a villager behind their counter, a pedlar on the road (their face, name and where they are).
export type Keeper = Pick<Npc, 'name' | 'look' | 'equipment' | 'x' | 'z'> & { where: Npc['where'] };

// The hero's bag, as a shop's window opens it beside itself.
export interface TradeBag {
  menu: Menu;
  trade(seller: Seller | null): void;
}

// What any keeper says to a hero with no room left in their bag.
const BAG_FULL = ["Your bag's full, friend. Make some room first.", "Where would you put it? Your bag's bursting.", 'No room in that bag of yours.'];

export const pick = (lines: readonly string[]) => lines[Math.floor(Math.random() * lines.length)];

// A time left as minutes and seconds: "0:42".
export const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const COLUMNS = 2;
export const PAGE = { buy: COLUMNS * 6, buyback: BUYBACK }; // to a page: wares, and sales to buy back (all of them)
const LEAST = COLUMNS * 2; // an empty list of wares is still two rows high

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

export function createTradePanel(model: GameModel, hooks: { bag?: TradeBag }, trade: Trade): { open(keeper: Keeper): void; update(): void; menu: Menu } {
  const shop = () => trade.shop();
  let keeper: Keeper | null = null;
  let says = ''; // what they're saying: a greeting, or an answer to a trade
  // The keeper answers a trade (or a word of their own), and the window's redrawn with it.
  const answer = (result: string, word?: string) => {
    says = word ?? (result === 'full' ? pick(BAG_FULL) : result in trade.lines ? pick(trade.lines[result as keyof TradeLines]) : says);
    menu.refresh();
  };
  // Each tab's page (Buy, Buyback), how many it has now, how many rows to one, and how many at least
  // (Buyback: all its slots, empty or not).
  const pages = [
    { at: 0, of: 1, size: PAGE.buy, least: LEAST },
    { at: 0, of: 1, size: PAGE.buyback, least: BUYBACK },
  ];
  // One page of a tab's rows; more than a page, every page is a whole one, so the window keeps its size.
  const fill = (tab: number, all: MenuSlot[]) => {
    const page = pages[tab];
    page.of = Math.max(1, Math.ceil(all.length / page.size));
    page.at = Math.min(page.at, page.of - 1); // (bought back the last of a page's)
    const cells: Array<MenuSlot | null> = all.slice(page.at * page.size, (page.at + 1) * page.size);
    while (cells.length < (page.of > 1 ? page.size : page.least) || cells.length % COLUMNS) cells.push(null);
    return { cells, columns: COLUMNS, rows: true };
  };
  // Under the list: a button to sell all junk, the buttons to turn the pages (if there's more than one), then both purses.
  const footer = (tab: number) => () => {
    const box = document.createElement('div');
    const bar = document.createElement('div');
    bar.className = 'shop-bar';
    const junk = document.createElement('button');
    junk.className = 'menu-button shop-junk';
    junk.textContent = 'Sell junk';
    junk.disabled = !(Object.keys(model.hero.bag) as BagItem[]).some(isJunk);
    junk.addEventListener('click', sellJunk);
    bar.append(junk);
    box.append(bar);
    const page = pages[tab];
    if (page.of > 1) {
      const pager = document.createElement('div');
      pager.className = 'shop-pager';
      const turn = (label: string, to: number) => {
        const button = document.createElement('button');
        button.className = 'menu-button shop-page-turn';
        button.textContent = label;
        button.disabled = to < 0 || to >= page.of;
        button.addEventListener('click', () => {
          page.at = to;
          menu.refresh();
        });
        return button;
      };
      pager.append(turn('‹ Previous', page.at - 1), line('shop-page', `Page ${page.at + 1} of ${page.of}`), turn('Next ›', page.at + 1));
      bar.append(pager);
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
      tone: qualityOf(id),
      key: id,
      tag: coinParts(price),
      badge: count > 0 ? `×${count}` : `↻ ${back}`,
      dim: count <= 0,
      warn: count > 0 && model.hero.money < price,
      lines: [
        ...trade.facts(id),
        toned('flavor', trade.blurb(id)),
        toned('price', count > 0 ? `${coinWords(price)} · ${count} in stock` : `Sold out · back in ${back}`),
        model.hero.money < price ? toned('loss', "You can't afford it") : toned('hint', 'Right-click to buy one'),
      ],
      alt: () => {
        const result = trade.trade(id, false);
        answer(result, result === 'bought' ? trade.about(id) : undefined);
      },
    };
  };
  // One of the hero's last sales here (a stack of the same, sold at the same price): right-click to buy it all back, at what they got.
  const sale = ({ id, price, count }: Sale, i: number): MenuSlot => {
    const cost = price * count;
    const them = count > 1 ? `${count}, ${coinWords(price)} each` : 'it';
    return {
      icon: bagIcon(id),
      title: nameOf(id),
      tone: qualityOf(id),
      key: `${i}:${id}`,
      tag: coinParts(cost),
      badge: count > 1 ? `×${count}` : undefined,
      warn: model.hero.money < cost,
      lines: [toned('price', `You sold ${them} for ${coinWords(cost)}`), model.hero.money < cost ? toned('loss', "You can't afford it") : toned('hint', `Right-click to buy ${count > 1 ? 'them' : 'it'} back`)],
      alt: () => {
        const result = buyBack(shop(), model.hero, i);
        const what = count > 1 ? `${count} ${plural(nameOf(id).toLowerCase())}` : nameOf(id).toLowerCase();
        answer(result, result === 'bought' ? trade.boughtBack(what, coinWords(cost)) : undefined);
      },
    };
  };
  // Selling from the bag beside the window: what the shop deals in at its price, and junk (anyone's) at what it's worth.
  const sellOne = (id: BagItem) => (isJunk(id) ? sellTo(shop(), model.hero, id, sellValue(id)!) : trade.trade(id, true));
  const seller: Seller = {
    wants: (id) => trade.wanted(id) || isJunk(id),
    price: (id) => (isJunk(id) ? sellValue(id)! : trade.price(id, true)),
    sell: (id) => {
      const result = sellOne(id);
      answer(result, result === 'sold' ? (isJunk(id) ? trade.junk(nameOf(id).toLowerCase(), coinWords(sellValue(id)!)) : trade.offered(nameOf(id))) : undefined);
    },
  };
  // Every bit of junk in the bag, sold while the keeper's purse holds.
  function sellJunk(): void {
    let result = 'none';
    const before = model.hero.money;
    for (const id of (Object.keys(model.hero.bag) as BagItem[]).filter(isJunk)) {
      while ((model.hero.bag[id] ?? 0) > 0 && (result = sellOne(id)) === 'sold');
      if (result === 'short') break;
    }
    const paid = model.hero.money - before;
    answer(result, result !== 'short' && paid > 0 ? trade.junk(null, coinWords(paid)) : undefined); // (their purse ran dry: they say so)
  }
  // While open, and anything's sold out, the countdowns tick each second; when one runs out, what's restocked shows at once.
  let ticker = 0;
  const tick = () => {
    if (trade.wares().some((id) => (shop().stock[id] ?? 0) <= 0)) menu.refresh();
  };
  let bagWasOpen = false;
  const menu = createMenu({
    title: trade.title,
    keyHints: false,
    modal: false, // the game plays on around it
    place: 'center',
    onOpenChange: (open) => {
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
        header: () => talk(keeper!, says, 'buy'),
        footer: footer(0),
      },
      {
        name: 'Buyback',
        slots: () => fill(1, (shop().buyback ?? []).map(sale)),
        header: () => talk(keeper!, says, 'buyback'),
        footer: footer(1),
      },
    ],
  });
  return {
    menu,
    open(npc) {
      if (menu.isOpen && keeper === npc) return; // already trading with them
      keeper = npc;
      for (const page of pages) page.at = 0;
      says = pick(trade.lines.hello);
      menu.setTitle(`${npc.name}'s ${trade.title.toLowerCase()}`);
      menu.open(0); // on Buy, whichever tab it was left on
    },
    // Each frame: the hero walked off (out of the keeper's reach, or out of the room), the window shuts.
    update() {
      if (!menu.isOpen || !keeper) return;
      const { hero, inside } = model;
      if ((inside?.entrance ?? null) !== keeper.where || Math.hypot(hero.x - keeper.x, hero.z - keeper.z) > TALK_RANGE + 0.5) menu.close(); // (outdoors: none, as a pedlar on the road)
    },
  };
}

// The keeper, talking: their face on the left, their name and what they say in a bubble (over `tab`).
function talk(npc: Keeper, says: string, tab: 'buy' | 'buyback'): HTMLElement {
  const row = document.createElement('div');
  row.className = `shop-talk ${tab}`;
  const face = document.createElement('div');
  face.className = 'shop-talk-face';
  face.append(voxelIcon(`face:${JSON.stringify(npc.look)}:${JSON.stringify(npc.equipment)}`, () => humanBust(npc.look, npc.equipment, 'right'), 56)); // (by how they look: a villager or a traveller)
  const bubble = document.createElement('div');
  bubble.className = 'shop-talk-bubble';
  bubble.append(line('shop-talk-name', npc.name), line('shop-talk-says', `“${says}”`));
  row.append(face, bubble);
  return row;
}

