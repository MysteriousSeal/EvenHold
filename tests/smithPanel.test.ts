// @vitest-environment happy-dom
// The smith's window at its edges (controller/trade/smithPanel.ts): what he says when he won't take more, what he says of
// what's sold him, and his Mend.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { smithShopIn } from '../src/model/smithy/smithShop';
import { WANTS } from '../src/model/shops/shopStock';
import type { Npc } from '../src/model/npcs/npcs';
import { createSmithPanel } from '../src/controller/trade/smithPanel';
import { createInventoryPanel } from '../src/controller/hero/inventoryPanel';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({
  voxelIcon: (key: string) => {
    const canvas = document.createElement('canvas');
    canvas.dataset.key = key;
    return canvas;
  },
}));

function trading() {
  for (const seed of TEST_SEEDS) {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    if (!enterNearest(model, 'smithy', new Set())) continue;
    const keeper = model.npcs.find((n) => n.role === 'smith' && n.where === model.inside!.entrance);
    if (!keeper) continue;
    const bag = createInventoryPanel(model);
    const panel = createSmithPanel(model, { bag });
    return { model, keeper: keeper as Npc, bag, panel, shop: () => smithShopIn(model) };
  }
  throw new Error('no smithy');
}

const menus = () => Array.from(document.querySelectorAll<HTMLElement>('.menu'));
const shopEl = () => menus().find((m) => m.querySelector('.shop-talk'))!;
const bagEl = () => menus().find((m) => m.getAttribute('aria-label') === 'Bag')!;
const says = () => shopEl().querySelector('.shop-talk-says')!.textContent!;
const rightClick = (el: Element) => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
const inBag = (key: string) => Array.from(bagEl().querySelectorAll<HTMLElement>('.menu-slot')).find((s) => s.querySelector('canvas')?.dataset.key === key)!;
const hover = (el: Element) => el.dispatchEvent(new MouseEvent('mouseenter'));
const tooltips = () => Array.from(document.querySelectorAll<HTMLElement>('.menu-tooltip')).filter((t) => !t.hidden);
const mend = () => Array.from(shopEl().querySelectorAll<HTMLButtonElement>('.shop-junk')).find((b) => b.textContent!.startsWith('Mend'))!;

beforeEach(() => document.body.replaceChildren());

describe("the smith's window", () => {
  it("has him say so when he's bought enough of a kind for now, rather than nothing", () => {
    const { model, keeper, panel, shop } = trading();
    model.hero.bag.mace = WANTS.gear + 1;
    shop().money = 100_000;
    panel.open(keeper);
    for (let i = 0; i < WANTS.gear; i++) rightClick(inBag('item:mace'));
    const before = says();
    rightClick(inBag('item:mace'));
    expect(model.hero.bag.mace).toBe(1);
    expect(says()).not.toBe(before);
    expect(says()).toMatch(/enough|plenty|more/i);
    expect(says()).not.toMatch(/days|a while/); // (the real wait, or none)
    expect(inBag('item:mace').classList.contains('dim')).toBe(true); // (the bag tells it before he does)
    hover(inBag('item:mace'));
    const tip = tooltips().map((t) => t.textContent).join(' ');
    expect(tip).not.toContain('Right-click to sell');
    expect(tip).toMatch(/enough of these for now · more wanted in \d+:\d\d/);
  });

  it("names more than one of a thing rightly: no hobnail bootss", () => {
    const { model, keeper, panel, shop } = trading();
    model.hero.bag.hobnailBoots = WANTS.gear + 1;
    shop().money = 100_000;
    panel.open(keeper);
    for (let i = 0; i < WANTS.gear; i++) rightClick(inBag('item:hobnailBoots'));
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5); // ("No more {them}…")
    rightClick(inBag('item:hobnailBoots'));
    random.mockRestore();
    expect(says()).toMatch(/hobnail boots/i);
    expect(says()).not.toMatch(/bootss/);
  });

  it("doesn't call wood iron: what he says of resin, or a wooden stave, is his word on wood", () => {
    const { model, keeper, panel, shop } = trading();
    model.hero.bag.pineResin = 1;
    shop().money = 100_000;
    panel.open(keeper);
    rightClick(inBag('loot:pineResin'));
    expect(says()).not.toMatch(/iron/i);
  });

  it("mends what's carried, worn, from the window's Mend, and says what it'll cost", () => {
    const { model, keeper, panel } = trading();
    model.hero.bag.mace = 1;
    model.hero.wear = { mace: 100 };
    model.hero.money = 100_000;
    panel.open(keeper);
    expect(mend().disabled).toBe(false);
    expect(mend().title).toContain('Mace');
    mend().click();
    expect(model.hero.wear.mace).toBeUndefined();
    expect(mend().disabled).toBe(true);
  });

  it('greets the hero, now and then, with a word on their broken blade, or their bare hands', () => {
    const { model, keeper, panel } = trading();
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.9);
    model.hero.equipment.mainHand = 'mace';
    model.hero.wear = { mace: 100 };
    panel.open(keeper);
    expect(says()).toMatch(/mace/);
    expect(says()).toMatch(/broken/i);
    panel.menu.close();
    model.hero.equipment.mainHand = undefined;
    panel.open(keeper);
    expect(says()).toMatch(/hands|blade/);
    random.mockRestore();
  });

  it("at night opens no window: the forge is cold, he says, come back in the morning", () => {
    const { model, keeper, panel } = trading();
    model.minutes = 2 * 60;
    model.takeEvents();
    panel.open(keeper);
    expect(panel.menu.isOpen).toBe(false);
    expect(model.takeEvents().some((e) => e.kind === 'say' && /Forge is cold/.test(e.text))).toBe(true);
    model.minutes = 10 * 60;
    panel.open(keeper);
    expect(panel.menu.isOpen).toBe(true);
    model.minutes = 23 * 60 + 1; // (night falls, trading)
    panel.update();
    expect(panel.menu.isOpen).toBe(false);
  });
});
