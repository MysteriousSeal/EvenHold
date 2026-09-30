// @vitest-environment happy-dom
// The shops' windows (tradePanel.ts, through the smith's and the barmaid's
// panels) and the bag beside them, in a stand-in page: icons are plain
// canvases named for their item.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { SMITH_WARES, gearPrice, gearSellPrice, smithShopAt } from '../src/model/smithy/smithShop';
import { PROVISION_IDS } from '../src/model/loot/provisions';
import type { ItemId } from '../src/model/human/equipment';
import type { Npc } from '../src/model/npcs/npcs';
import { createSmithPanel } from '../src/controller/smithPanel';
import { createShopPanel } from '../src/controller/shopPanel';
import { createInventoryPanel } from '../src/controller/inventoryPanel';
import { PAGE as PAGES } from '../src/controller/tradePanel';

const PAGE = PAGES.buy;
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({
  voxelIcon: (key: string) => {
    const canvas = document.createElement('canvas');
    canvas.dataset.key = key;
    return canvas;
  },
}));

// A fresh world with the hero inside the nearest building of `type`, its keeper, and the shop's window with the bag beside it.
function trading(type: 'smithy' | 'inn') {
  for (const seed of TEST_SEEDS) {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    if (!enterNearest(model, type, new Set())) continue;
    const keeper = model.npcs.find((n) => n.role === (type === 'smithy' ? 'smith' : 'barkeep') && n.where === model.inside!.entrance);
    if (!keeper) continue;
    const bag = createInventoryPanel(model);
    const paused: boolean[] = [];
    const hooks = { setPaused: (p: boolean) => paused.push(p), bag };
    const panel = type === 'smithy' ? createSmithPanel(model, hooks) : createShopPanel(model, hooks);
    const shop = () => smithShopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    return { model, keeper: keeper as Npc, bag, panel, paused, shop };
  }
  throw new Error(`no ${type}`);
}

const menus = () => Array.from(document.querySelectorAll<HTMLElement>('.menu'));
const shopEl = () => menus().find((m) => m.querySelector('.shop-talk'))!;
const bagEl = () => menus().find((m) => m.getAttribute('aria-label') === 'Bag')!;
const rows = () => Array.from(shopEl().querySelectorAll<HTMLElement>('.menu-grid .menu-slot'));
const shown = () => rows().map((s) => s.querySelector('canvas')?.dataset.key ?? null); // what each row holds (null: empty)
const pager = () => shopEl().querySelector('.shop-pager');
const turn = (label: 'Previous' | 'Next') => Array.from(shopEl().querySelectorAll<HTMLButtonElement>('.shop-page-turn')).find((b) => b.textContent!.includes(label))!;
const tab = (name: 'Buy' | 'Buyback') => Array.from(shopEl().querySelectorAll<HTMLButtonElement>('.menu-tab')).find((b) => b.textContent!.trim() === name)!.click();
const says = () => shopEl().querySelector('.shop-talk-says')!.textContent;
const rightClick = (el: Element) => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
const hover = (el: Element) => el.dispatchEvent(new MouseEvent('mouseenter'));
const tooltips = () => Array.from(document.querySelectorAll<HTMLElement>('.menu-tooltip')).filter((t) => !t.hidden);
const inBag = (key: string) => Array.from(bagEl().querySelectorAll<HTMLElement>('.menu-slot')).find((s) => s.querySelector('canvas')?.dataset.key === key)!;

beforeEach(() => document.body.replaceChildren());

describe("the smith's window", () => {
  it('opens on his greeting, pausing the game, the bag beside it; his wares a list, two to a row, 12 to a page', () => {
    expect(SMITH_WARES.length).toBeGreaterThan(PAGE);
    const { keeper, bag, panel, paused } = trading('smithy');
    panel.open(keeper);
    expect(paused).toEqual([true]);
    expect(bag.menu.isOpen).toBe(true); // to sell from
    expect(shopEl().querySelector('.menu-title')!.textContent).toBe(`${keeper.name}'s wares`);
    expect(says()).toMatch(/^“.+”$/);
    expect(shopEl().querySelector<HTMLElement>('.menu-grid')!.style.gridTemplateColumns).toBe('repeat(2, 1fr)');
    expect(shown()).toEqual(SMITH_WARES.slice(0, PAGE).map((id) => `item:${id}`));
    for (const row of rows()) {
      expect(row.querySelector('.menu-slot-title')!.textContent).toBeTruthy(); // its name…
      expect(row.querySelector('.menu-slot-tag .coin')).not.toBeNull(); // …its price…
      expect(row.querySelector('.menu-slot-badge')!.textContent).toMatch(/^(×\d+|↻ \d+:\d\d)$/); // …how many are left
    }
    expect(pager()!.textContent).toContain(`Page 1 of ${Math.ceil(SMITH_WARES.length / PAGE)}`);
    panel.menu.close();
    expect(paused).toEqual([true, false]);
    expect(bag.menu.isOpen).toBe(false); // shut with it
  });

  it('leaves the bag open when it was already', () => {
    const { keeper, bag, panel } = trading('smithy');
    bag.menu.open();
    panel.open(keeper);
    panel.menu.close();
    expect(bag.menu.isOpen).toBe(true);
  });

  it('tells of a ware on hover: what it is, what it goes on, how many, and how to buy it', () => {
    const { model, keeper, panel, shop } = trading('smithy');
    model.hero.money = 100_000;
    panel.open(keeper);
    const id = SMITH_WARES[0] as ItemId;
    hover(rows()[0]);
    const text = tooltips().map((t) => t.textContent).join(' ');
    expect(text).toContain('Forged here, by the smith.');
    expect(text).toContain('Worn on: ');
    expect(text).toContain((shop().stock[id] ?? 0) > 0 ? `${shop().stock[id]} in stock` : 'Sold out');
    expect(text).toContain('Right-click to buy one');
  });

  it('turns the pages: the next wares, a last page filled out to a whole one, and back to the first when opened again', () => {
    const { keeper, panel } = trading('smithy');
    panel.open(keeper);
    const pages = Math.ceil(SMITH_WARES.length / PAGE);
    expect(turn('Previous').disabled).toBe(true);
    for (let p = 1; p < pages; p++) turn('Next').click();
    const last = SMITH_WARES.slice((pages - 1) * PAGE).map((id) => `item:${id}`);
    const padded = [...last];
    while (padded.length < PAGE) padded.push(null as unknown as string);
    expect(shown()).toEqual(padded); // the window keeps its size
    expect(turn('Next').disabled).toBe(true);
    panel.menu.close();
    panel.open(keeper);
    expect(pager()!.textContent).toContain('Page 1 of');
  });

  it('buys with a right-click: coin to him, one fewer in stock, the page kept; sold out, nothing', () => {
    const { model, keeper, panel, shop } = trading('smithy');
    model.hero.money = 100_000;
    panel.open(keeper);
    turn('Next').click();
    const at = SMITH_WARES.slice(PAGE).findIndex((id) => (shop().stock[id] ?? 0) > 0);
    const id = SMITH_WARES[PAGE + at] as ItemId;
    const [stock, money] = [shop().stock[id]!, shop().money];
    rightClick(rows()[at]);
    expect(model.hero.bag[id]).toBe(1);
    expect(model.hero.money).toBe(100_000 - gearPrice(id));
    expect(shop().money).toBe(money + gearPrice(id));
    expect(shop().stock[id]).toBe(stock - 1);
    expect(pager()!.textContent).toContain('Page 2 of');
    // Bought out: the row fades, and another right-click buys nothing.
    for (let i = 1; i < stock; i++) rightClick(rows()[at]);
    expect(shop().stock[id]).toBe(0);
    expect(rows()[at].classList.contains('dim')).toBe(true);
    rightClick(rows()[at]);
    expect(model.hero.bag[id]).toBe(stock);
  });

  it("sells from the bag beside it with a right-click (only what he'd take), and buys it back from the Buyback tab at what it fetched", () => {
    const { model, keeper, panel, shop } = trading('smithy');
    const id = SMITH_WARES[0] as ItemId;
    model.hero.bag[id] = 2;
    model.hero.bag.bread = 1; // not his to buy
    model.hero.money = 0;
    shop().money = 100_000;
    panel.open(keeper);
    hover(inBag(`item:${id}`));
    expect(tooltips().map((t) => t.textContent).join(' ')).toContain('Right-click to sell for');
    hover(inBag('loot:bread'));
    expect(tooltips().map((t) => t.textContent).join(' ')).not.toContain('sell');
    rightClick(inBag(`item:${id}`));
    expect(model.hero.bag[id]).toBe(1);
    expect(model.hero.money).toBe(gearSellPrice(id));
    tab('Buyback');
    expect(shown().filter(Boolean)).toEqual([`item:${id}`]);
    expect(pager()).toBeNull();
    rightClick(rows()[0]);
    expect(model.hero.bag[id]).toBe(2);
    expect(model.hero.money).toBe(0); // paid back what it fetched
    expect(shown().filter(Boolean)).toEqual([]);
  });

  it('shows every sale to buy back on one page, 12 at most', () => {
    const { keeper, panel, shop } = trading('smithy');
    shop().buyback = (SMITH_WARES.slice(0, PAGES.buyback) as ItemId[]).map((id) => ({ id, price: 1 }));
    panel.open(keeper);
    tab('Buyback');
    expect(pager()).toBeNull();
    expect(shown()).toEqual(SMITH_WARES.slice(0, PAGES.buyback).map((id) => `item:${id}`));
  });
});

describe("the barmaid's window", () => {
  it('shows her few wares on one page, with no pager; nothing sold back yet, an empty list two rows high', () => {
    const { keeper, panel } = trading('inn');
    panel.open(keeper);
    expect(PROVISION_IDS.length).toBeLessThanOrEqual(PAGE);
    expect(pager()).toBeNull();
    expect(shown().filter(Boolean)).toEqual(PROVISION_IDS.map((id) => `loot:${id}`));
    tab('Buyback');
    expect(shown()).toEqual(Array(4).fill(null)); // two rows of two
  });
});
