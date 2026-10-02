// @vitest-environment happy-dom
// A pedlar's window, out on the road (pedlarPanel.ts through tradePanel.ts): it opens, and stays open while the hero's
// by them; buying and selling go through; walking off shuts it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { createPedlarPanel } from '../src/controller/trade/pedlarPanel';
import { createInventoryPanel } from '../src/controller/hero/inventoryPanel';
import { PEDLAR_WARES, pedlarPrice, pedlarShopAt } from '../src/model/travellers/pedlarShop';
import { nearestTraveller } from '../src/model/cheats';

vi.mock('../src/view/ui/voxelIcon', () => ({
  voxelIcon: (key: string) => {
    const canvas = document.createElement('canvas');
    canvas.dataset.key = key;
    return canvas;
  },
}));

beforeEach(() => document.body.replaceChildren());

const menus = () => Array.from(document.querySelectorAll<HTMLElement>('.menu'));
const shopEl = () => menus().find((m) => m.querySelector('.shop-talk'))!;
const rows = () => Array.from(shopEl().querySelectorAll<HTMLElement>('.menu-grid .menu-slot'));
const rightClick = (el: Element) => el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));

// The hero by the nearest pedlar, out on the road, the window and the bag made.
function byPedlar() {
  const model = new GameModel(1, { width: 512, depth: 512 });
  const { traveller, at } = nearestTraveller(model, model.hero, 'pedlar')!;
  model.teleport(at.x, at.z);
  const bag = createInventoryPanel(model);
  const panel = createPedlarPanel(model, { bag });
  return { model, pedlar: traveller, panel, shop: () => pedlarShopAt(model.shops, model.seed, traveller) };
}

describe("a pedlar's window", () => {
  it('opens on the road, named for them, and stays open while the hero stands by them', () => {
    const { model, pedlar, panel } = byPedlar();
    panel.open(pedlar);
    expect(panel.menu.isOpen).toBe(true);
    expect(shopEl().querySelector('.menu-title')!.textContent).toBe(`${pedlar.name}'s pack`);
    for (let i = 0; i < 30; i++) {
      model.update(0, 0, 1 / 60);
      panel.update();
    }
    expect(panel.menu.isOpen).toBe(true); // (outdoors, as they are: not taken for having left their room)
  });

  it('buys with a right-click: coin to them, one fewer in the pack, one more in the bag', () => {
    const { model, pedlar, panel, shop } = byPedlar();
    model.hero.money = 10_000;
    panel.open(pedlar);
    const at = PEDLAR_WARES.findIndex((id) => (shop().stock[id] ?? 0) > 0);
    const id = PEDLAR_WARES[at];
    const [stock, purse] = [shop().stock[id]!, shop().money];
    rightClick(rows()[at]);
    expect(model.hero.bag[id]).toBe(1);
    expect(model.hero.money).toBe(10_000 - pedlarPrice(id, false));
    expect(shop().money).toBe(purse + pedlarPrice(id, false));
    expect(shop().stock[id]).toBe(stock - 1);
  });

  it('shuts once the hero walks off', () => {
    const { model, pedlar, panel } = byPedlar();
    panel.open(pedlar);
    model.teleport(model.hero.x + 10, model.hero.z);
    panel.update();
    expect(panel.menu.isOpen).toBe(false);
  });
});
