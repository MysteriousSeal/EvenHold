// @vitest-environment happy-dom
// The shops' windows (tradePanel.ts, through the smith's and the barmaid's
// panels) and the bag beside them, in a stand-in page: icons are plain
// canvases named for their item.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { SMITH_WARES, gearPrice, gearSellPrice, smithShopIn } from '../src/model/smithy/smithShop';
import { PROVISION_IDS } from '../src/model/loot/provisions';
import { LOOT } from '../src/model/loot/loot';
import { sellPrice } from '../src/model/inn/tavernShop';
import { ITEMS, SLOT_NAMES, type ItemId } from '../src/model/human/equipment';
import type { Npc } from '../src/model/npcs/npcs';
import { createSmithPanel } from '../src/controller/trade/smithPanel';
import { createShopPanel } from '../src/controller/trade/shopPanel';
import { createInventoryPanel } from '../src/controller/hero/inventoryPanel';
import { againstWorn } from '../src/controller/hero/gearLines';
import { PAGE as PAGES } from '../src/controller/trade/tradePanel';
import { plural } from '../src/view/ui/words';

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
    const hooks = { bag };
    const panel = type === 'smithy' ? createSmithPanel(model, hooks) : createShopPanel(model, hooks);
    const shop = () => smithShopIn(model);
    return { model, keeper: keeper as Npc, bag, panel, shop };
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
  it('opens on his greeting, the bag beside it; his wares a list, two to a row, 12 to a page', () => {
    expect(SMITH_WARES.length).toBeGreaterThan(PAGE);
    const { keeper, bag, panel } = trading('smithy');
    panel.open(keeper);
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
    expect(text).toContain(SLOT_NAMES[ITEMS[id].slot]); // (what it goes on, under its name)
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
    // Left on Buyback, it opens on Buy again.
    tab('Buyback');
    panel.menu.close();
    panel.open(keeper);
    expect(shopEl().querySelector('.menu-tab.active')!.textContent!.trim()).toBe('Buy');
    expect(shown()[0]).toBe(`item:${SMITH_WARES[0]}`);
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
    const { model, keeper, bag, panel, shop } = trading('smithy');
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
    expect(tooltips().map((t) => t.textContent).join(' ')).toContain('Not bought here');
    expect(inBag('loot:bread').classList.contains('dim')).toBe(true); // greyed out: he won't take it
    expect(inBag(`item:${id}`).classList.contains('dim')).toBe(false);
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
    // Done trading: the bag, opened again, has nothing greyed out.
    panel.menu.close();
    bag.menu.open();
    expect(inBag('loot:bread').classList.contains('dim')).toBe(false);
  });

  it('shows every sale to buy back on one page, 12 at most', () => {
    const { keeper, panel, shop } = trading('smithy');
    shop().buyback = (SMITH_WARES.slice(0, PAGES.buyback) as ItemId[]).map((id) => ({ id, price: 1, count: 1 }));
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
    expect(shown()).toEqual(Array(PAGES.buyback).fill(null)); // its slots all there, empty
  });
});

describe('trading, the WoW way', () => {
  it("doesn't stop the game, and shuts once the hero walks away from the keeper; opened again on them, it stays as it was", () => {
    const { model, keeper, panel } = trading('smithy');
    Object.assign(model.hero, { x: keeper.x, z: keeper.z + 1.5 });
    panel.open(keeper);
    turn('Next').click();
    panel.update();
    expect(panel.menu.isOpen).toBe(true); // still by him
    panel.open(keeper); // (E again) keeps its page
    expect(pager()!.textContent).toContain('Page 2 of');
    Object.assign(model.hero, { x: keeper.x, z: keeper.z + 5 });
    panel.update();
    expect(panel.menu.isOpen).toBe(false);
  });

  it('shows in red what the hero can\'t pay for, and names things in their quality\'s color', () => {
    const { model, keeper, panel, shop } = trading('smithy');
    model.hero.money = 0;
    shop().buyback = [{ id: 'wolfFang', price: 3, count: 1 }];
    panel.open(keeper);
    const inStock = rows().filter((r) => !r.classList.contains('dim'));
    expect(inStock.length).toBeGreaterThan(0);
    expect(inStock.every((r) => r.classList.contains('warn'))).toBe(true);
    model.hero.money = 1_000_000;
    panel.menu.refresh();
    expect(rows().some((r) => r.classList.contains('warn'))).toBe(false);
    tab('Buyback');
    expect(rows()[0].querySelector<HTMLElement>('.menu-slot-title')!.dataset.tone).toBe('junk');
  });

  it('sells all junk at once, to the smith as to the barmaid, at what it\'s worth', () => {
    for (const type of ['smithy', 'inn'] as const) {
      document.body.replaceChildren(); // (the other shop's window gone)
      const { model, keeper, panel, shop } = trading(type);
      shop().money = 100_000;
      Object.assign(model.hero, { money: 0, bag: { wolfFang: 3, rustyBuckle: 2, bread: 1 } });
      panel.open(keeper);
      const sellJunk = shopEl().querySelector<HTMLButtonElement>('.shop-junk')!;
      expect(sellJunk.disabled).toBe(false);
      sellJunk.click();
      expect(model.hero.bag).toEqual({ bread: 1 }); // the junk gone, the bread kept
      expect(model.hero.money).toBe(3 * LOOT.wolfFang.value + 2 * LOOT.rustyBuckle.value);
      expect(shopEl().querySelector<HTMLButtonElement>('.shop-junk')!.disabled).toBe(true); // none left
      // Buyback: each kind stacked, the last sold first, bought back whole.
      tab('Buyback');
      expect(shown().filter(Boolean)).toEqual(['loot:rustyBuckle', 'loot:wolfFang']);
      expect(rows()[1].querySelector('.menu-slot-badge')!.textContent).toBe('×3');
      rightClick(rows()[1]);
      expect(says()).toContain('3 wolf fangs'); // bought back: they name it, and what it cost
      expect(says().match(/\d+ copper/)?.[0] ?? `${3 * LOOT.wolfFang.value} copper`).toBe(`${3 * LOOT.wolfFang.value} copper`);
      expect(says()).not.toContain('{');
      expect(model.hero.bag.wolfFang).toBe(3);
      expect(model.hero.money).toBe(2 * LOOT.rustyBuckle.value);
      panel.menu.close();
    }
  });

  it('tells in every bag tooltip what a thing would fetch, away from any shop; what no one buys, nothing', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const bag = createInventoryPanel(model);
    Object.assign(model.hero, { bag: { bread: 1, wolfFang: 1, alphaFang: 1 } });
    bag.menu.open();
    hover(inBag('loot:bread'));
    expect(tooltips().map((t) => t.textContent).join(' ')).toContain(`Sells for ${sellPrice('bread')} copper`);
    hover(inBag('loot:wolfFang'));
    expect(tooltips().map((t) => t.textContent).join(' ')).toContain(`Sells for ${LOOT.wolfFang.value} copper`);
    hover(inBag('loot:alphaFang')); // a quest item
    expect(tooltips().map((t) => t.textContent).join(' ')).not.toContain('Sells for');
  });
});

describe('selling junk', () => {
  it("gets the keeper's word on junk, naming it (not on iron, not on food); the whole lot, a word on the lot", () => {
    for (const type of ['smithy', 'inn'] as const) {
      document.body.replaceChildren();
      const { model, keeper, panel, shop } = trading(type);
      shop().money = 100_000;
      Object.assign(model.hero, { bag: { mattedPelt: 1, wolfFang: 2 } });
      panel.open(keeper);
      model.hero.money = 0;
      rightClick(inBag('loot:mattedPelt'));
      expect(says()).toContain('matted pelt');
      expect(says().match(/\d+ copper/)?.[0] ?? `${LOOT.mattedPelt.value} copper`).toBe(`${LOOT.mattedPelt.value} copper`); // what it fetched, if said
      expect(says()).not.toMatch(/iron|could use that|\{/);
      shopEl().querySelector<HTMLButtonElement>('.shop-junk')!.click();
      expect(says()).not.toContain('wolf fang'); // the lot, not one thing
      expect(says().match(/\d+ copper/)?.[0] ?? `${2 * LOOT.wolfFang.value} copper`).toBe(`${2 * LOOT.wolfFang.value} copper`); // and what the lot fetched, if said
      expect(says()).toMatch(/^“[^{]+”$/);
      panel.menu.close();
    }
  });
});

describe('the bag', () => {
  it('tidies itself with its Sort button', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const bag = createInventoryPanel(model);
    Object.assign(model.hero, { bag: { wolfFang: 1, bread: 1, nasalCap: 1 }, bagOrder: [null, 'wolfFang', null, 'bread', 'nasalCap'] });
    bag.menu.open();
    bagEl().querySelector<HTMLButtonElement>('.bag-sort')!.click();
    expect(model.hero.bagOrder).toEqual(['nasalCap', 'bread', 'wolfFang']);
    const keys = Array.from(bagEl().querySelectorAll('.menu-slot')).map((s) => s.querySelector('canvas')?.dataset.key ?? null);
    expect(keys.slice(0, 4)).toEqual(['bag-socket', 'bag-socket', 'bag-socket', 'bag-socket']); // (the sockets on top)
    expect(keys.slice(4, 8)).toEqual(['item:nasalCap', 'loot:bread', 'loot:wolfFang', null]); // (no empty cells by the sockets)
  });

  it('a slot hovered is lit, its tooltip shown; left, neither (none lit on opening)', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const bag = createInventoryPanel(model);
    Object.assign(model.hero, { bag: { wolfFang: 1 }, bagOrder: [], bagCounts: [] });
    bag.menu.open();
    expect(bagEl().querySelector('.menu-slot.selected')).toBeNull();
    const fang = Array.from(bagEl().querySelectorAll<HTMLElement>('.menu-slot')).find((s) => s.querySelector('canvas')?.dataset.key === 'loot:wolfFang')!;
    fang.dispatchEvent(new MouseEvent('mouseenter'));
    expect(fang.classList.contains('selected')).toBe(true);
    expect(Array.from(document.querySelectorAll<HTMLElement>('.menu-tooltip')).some((t) => !t.hidden)).toBe(true);
    fang.dispatchEvent(new MouseEvent('mouseleave'));
    expect(bagEl().querySelector('.menu-slot.selected')).toBeNull();
    expect(Array.from(document.querySelectorAll<HTMLElement>('.menu-tooltip')).every((t) => t.hidden)).toBe(true);
    bag.menu.close();
  });

  it('in rows by what things are: a titled header over each group carried, the free slots at the bottom', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const bag = createInventoryPanel(model);
    Object.assign(model.hero, { bag: { wolfFang: 1, bread: 2, nasalCap: 1, ale: 1 }, bagOrder: ['wolfFang', null, 'bread', 'nasalCap', 'ale'], bagCounts: [] });
    bag.menu.open();
    const titles = Array.from(bagEl().querySelectorAll('.menu-section')).map((h) => h.textContent);
    expect(titles).toEqual(['', 'Gear', 'Food & drink', 'Junk', '']); // (the sockets' line; the groups; a line, then the free slots)
    const keys = Array.from(bagEl().querySelectorAll('.menu-slot')).map((s) => s.querySelector('canvas')?.dataset.key ?? null);
    expect(keys.slice(4, 8)).toEqual(['item:nasalCap', 'loot:bread', 'loot:ale', 'loot:wolfFang']);
    expect(keys.slice(8).every((k) => k === null)).toBe(true);
  });
});

describe('naming several of a thing', () => {
  it('makes it plural as English would', () => {
    expect(['wolf fang', 'torn pouch', 'leather gloves', 'rusty buckle'].map(plural)).toEqual(['wolf fangs', 'torn pouches', 'leather gloves', 'rusty buckles']);
  });
});

describe('gear against what\'s worn', () => {
  it('as WoW tells it: what wearing it instead would change, only what changes, gains green and losses red', () => {
    expect(againstWorn('nasalCap', { head: 'leatherCap' })).toEqual([
      { text: 'If you replace your Leather cap:', tone: 'head' },
      { text: 'Overall: +50%', tone: 'gain' }, // (worth 4 against 6: armour 2 and a stat point at 2, against armour 4 and a point)
      { text: '+2 Armour', tone: 'gain' },
      { text: '−1 Agility', tone: 'loss' },
      { text: '+1 Stamina', tone: 'gain' },
    ]);
    expect(againstWorn('nasalCap', {})).toEqual([{ text: 'If you wear it (your head slot is empty):', tone: 'head' }, { text: 'Overall: an upgrade', tone: 'gain' }, { text: '+4 Armour', tone: 'gain' }, { text: '+1 Stamina', tone: 'gain' }]);
    expect(againstWorn('leatherCap', { head: 'nasalCap' })[1]).toEqual({ text: 'Overall: −33%', tone: 'loss' });
    expect(againstWorn('nasalCap', { head: 'nasalCap' })).toEqual([{ text: 'You wear one already', tone: 'head' }]);
  });

  it('in the bag\'s tooltips', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const bag = createInventoryPanel(model);
    Object.assign(model.hero, { bag: { nasalCap: 1 }, bagOrder: [], bagCounts: [], equipment: { head: 'leatherCap' } });
    bag.menu.open();
    const cap = Array.from(bagEl().querySelectorAll<HTMLElement>('.menu-slot')).find((s) => s.querySelector('canvas')?.dataset.key === 'item:nasalCap')!;
    cap.dispatchEvent(new MouseEvent('mouseenter'));
    const tip = Array.from(document.querySelectorAll<HTMLElement>('.menu-tooltip')).find((t) => !t.hidden)!;
    expect(tip.textContent).toContain('If you replace your Leather cap:');
    const gain = Array.from(tip.querySelectorAll<HTMLElement>('small')).find((l) => l.textContent === '+2 Armour')!;
    expect(gain.dataset.tone).toBe('gain');
    expect(Array.from(tip.querySelectorAll<HTMLElement>('small')).find((l) => l.textContent === '−1 Agility')!.dataset.tone).toBe('loss');
    // Its parts, each in its look: what it goes on under its name, its stats, the comparison's header and the hint each
    // starting a new part (a rule before them).
    const lines = Array.from(tip.querySelectorAll<HTMLElement>('small'));
    expect(lines[0].dataset.tone).toBe('kind');
    expect(lines.filter((l) => l.dataset.tone === 'stat').map((l) => l.textContent)).toEqual(['Armour 4', '+1 Stamina']);
    expect(lines.filter((l) => l.classList.contains('ruled')).map((l) => l.dataset.tone)).toEqual(['head', 'price', 'hint'].filter((t) => lines.some((l) => l.dataset.tone === t)));
    bag.menu.close();
  });
});
