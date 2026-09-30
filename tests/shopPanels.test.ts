// @vitest-environment happy-dom
// The shops' windows (tradePanel.ts, through the smith's and the barmaid's
// panels), in a stand-in page: icons are plain canvases named for their item.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enterNearest } from '../src/model/cheats';
import { SMITH_WARES, gearPrice, smithShopAt } from '../src/model/smithy/smithShop';
import { PROVISION_IDS } from '../src/model/loot/provisions';
import type { ItemId } from '../src/model/human/equipment';
import type { Npc } from '../src/model/npcs/npcs';
import { createSmithPanel } from '../src/controller/smithPanel';
import { createShopPanel } from '../src/controller/shopPanel';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({
  voxelIcon: (key: string) => {
    const canvas = document.createElement('canvas');
    canvas.dataset.key = key;
    return canvas;
  },
}));

const PAGE = 20;

// A fresh world with the hero inside the nearest building of `type`, and who keeps it.
function inside(type: 'smithy' | 'inn', role: Npc['role']): { model: GameModel; keeper: Npc } {
  for (const seed of TEST_SEEDS) {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    if (!enterNearest(model, type, new Set())) continue;
    const keeper = model.npcs.find((n) => n.role === role && n.where === model.inside!.entrance);
    if (keeper) return { model, keeper };
  }
  throw new Error(`no ${type}`);
}

const menuEl = () => document.querySelector('.menu') as HTMLElement;
const slots = () => Array.from(menuEl().querySelectorAll<HTMLElement>('.menu-grid .menu-slot'));
const shown = () => slots().map((s) => s.querySelector('canvas')?.dataset.key ?? null); // what each slot holds (null: empty)
const pager = () => menuEl().querySelector('.shop-pager');
const turn = (label: 'Previous' | 'Next') => Array.from(menuEl().querySelectorAll<HTMLButtonElement>('.shop-page-turn')).find((b) => b.textContent!.includes(label))!;
const tab = (name: 'Buy' | 'Sell') => Array.from(menuEl().querySelectorAll<HTMLButtonElement>('.menu-tab')).find((b) => b.textContent!.includes(name))!.click();
const says = () => menuEl().querySelector('.shop-talk-says')!.textContent;

beforeEach(() => document.body.replaceChildren());

describe("the smith's window", () => {
  it('opens on his greeting, pausing the game, his wares 20 to a page', () => {
    expect(SMITH_WARES.length).toBeGreaterThan(PAGE); // (else there'd be nothing to turn)
    const { model, keeper } = inside('smithy', 'smith');
    const paused: boolean[] = [];
    const panel = createSmithPanel(model, { setPaused: (p) => paused.push(p) });
    panel.open(keeper);
    expect(paused).toEqual([true]);
    expect(menuEl().querySelector('.menu-title')!.textContent).toBe(`${keeper.name}'s wares`);
    expect(menuEl().querySelector('.shop-talk-name')!.textContent).toBe(keeper.name);
    expect(says()).toMatch(/^“.+”$/);
    expect(shown()).toEqual(SMITH_WARES.slice(0, PAGE).map((id) => `item:${id}`));
    const pages = Math.ceil(SMITH_WARES.length / PAGE);
    expect(pager()!.textContent).toContain(`Page 1 of ${pages}`);
    expect(turn('Previous').disabled).toBe(true);
    expect(turn('Next').disabled).toBe(false);
    panel.menu.close();
    expect(paused).toEqual([true, false]);
  });

  it('turns the pages: the next wares, a last page filled out to a whole one, and back', () => {
    const { model, keeper } = inside('smithy', 'smith');
    const panel = createSmithPanel(model, { setPaused: () => {} });
    panel.open(keeper);
    const pages = Math.ceil(SMITH_WARES.length / PAGE);
    for (let p = 1; p < pages; p++) turn('Next').click();
    const last = SMITH_WARES.slice((pages - 1) * PAGE).map((id) => `item:${id}`);
    expect(shown()).toEqual([...last, ...Array(PAGE - last.length).fill(null)]); // the window keeps its size
    expect(pager()!.textContent).toContain(`Page ${pages} of ${pages}`);
    expect(turn('Next').disabled).toBe(true);
    turn('Previous').click();
    expect(pager()!.textContent).toContain(`Page ${pages - 1} of ${pages}`);
    // Shut and opened again: back on the first page.
    panel.menu.close();
    panel.open(keeper);
    expect(pager()!.textContent).toContain('Page 1 of');
    expect(shown()[0]).toBe(`item:${SMITH_WARES[0]}`);
  });

  it('buys through the button: coin to him, one fewer in stock, the count shown, the page kept', () => {
    const { model, keeper } = inside('smithy', 'smith');
    const shop = smithShopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    const panel = createSmithPanel(model, { setPaused: () => {} });
    panel.open(keeper);
    turn('Next').click();
    const at = SMITH_WARES.slice(PAGE).findIndex((id) => (shop.stock[id] ?? 0) > 0);
    const id = SMITH_WARES[PAGE + at] as ItemId;
    model.hero.money = 10_000;
    const [stock, money] = [shop.stock[id]!, shop.money];
    slots()[at].click(); // picked out…
    expect(menuEl().querySelector('.menu-detail-name')!.textContent).toBeTruthy();
    menuEl().querySelector<HTMLButtonElement>('.menu-detail-button')!.click(); // …and bought
    expect(model.hero.bag[id]).toBe(1);
    expect(model.hero.money).toBe(10_000 - gearPrice(id));
    expect(shop.money).toBe(money + gearPrice(id));
    expect(shop.stock[id]).toBe(stock - 1);
    expect(pager()!.textContent).toContain('Page 2 of'); // still where they were
    const badge = slots()[at].querySelector('.menu-slot-badge')!.textContent;
    expect(badge).toEqual(stock - 1 > 0 ? `×${stock - 1}` : expect.stringMatching(/^↻ \d+:\d\d$/)); // sold out: the time till more
  });

  it("offers to buy only what he'd take off the hero, and turns to the page before once a page's last is sold", () => {
    const { model, keeper } = inside('smithy', 'smith');
    const panel = createSmithPanel(model, { setPaused: () => {} });
    const gear = SMITH_WARES.slice(0, PAGE + 1); // a page and one over
    for (const id of gear) model.hero.bag[id] = 1;
    model.hero.bag.bread = 3; // not his to buy
    const shop = smithShopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
    shop.money = 1_000_000;
    panel.open(keeper);
    tab('Sell');
    expect(shown().filter(Boolean)).toHaveLength(PAGE);
    expect(shown()).not.toContain('loot:bread');
    turn('Next').click();
    expect(pager()!.textContent).toContain('Page 2 of 2');
    expect(shown().filter(Boolean)).toHaveLength(1);
    slots()[0].click();
    menuEl().querySelector<HTMLButtonElement>('.menu-detail-button')!.click(); // sells the one on page 2
    expect(pager()).toBeNull(); // one page left: no pager, and it's on it
    expect(shown().filter(Boolean)).toHaveLength(PAGE);
  });
});

describe("the barmaid's window", () => {
  it('shows her few wares on one page, with no pager, and at least two rows', () => {
    const { model, keeper } = inside('inn', 'barkeep');
    const panel = createShopPanel(model, { setPaused: () => {} });
    panel.open(keeper);
    expect(PROVISION_IDS.length).toBeLessThanOrEqual(PAGE);
    expect(pager()).toBeNull();
    expect(shown().filter(Boolean)).toEqual(PROVISION_IDS.map((id) => `loot:${id}`));
    expect(slots().length).toBeGreaterThanOrEqual(8);
    tab('Sell'); // nothing to sell her: empty, but still two rows
    expect(shown().filter(Boolean)).toEqual([]);
    expect(slots()).toHaveLength(8);
  });
});
