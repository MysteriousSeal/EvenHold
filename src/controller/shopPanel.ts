// Trading with the barmaid (E by her bar): her wares to buy, and the hero's
// food and drink to sell her, in a grid on the left; the one chosen is told
// of on the right, with the button to buy (or sell) it at its price; her
// purse and the hero's shown under them. She has only so much of each and only so
// much money (npcs/tavernShop.ts). A window in the middle of the screen;
// the game waits while it's open.

import type { GameModel } from '../model/GameModel';
import type { Npc } from '../model/npcs/npcs';
import { buy, buyPrice, sell, sellPrice, shopAt, type Shop } from '../model/npcs/tavernShop';
import { PROVISIONS, PROVISION_IDS, isProvision, type ProvisionId } from '../model/loot/provisions';
import { coinParts } from '../view/ui/coins';
import { bagIcon } from '../view/ui/itemIcons';
import { createMenu, type Menu, type MenuSlot } from '../view/ui/menu';

const COLUMNS = 4;
const ROWS = 2;
const BUY_SAYS = { bought: '', 'sold out': 'Sold out.', 'too poor': "You can't afford that." } as const;
const SELL_SAYS = { sold: '', 'not wanted': 'She only buys food and drink.', none: '', 'she is short': "She hasn't the coin for that." } as const;

// Both purses, hers on the left and the hero's on the right, each named.
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

export function createShopPanel(model: GameModel, hooks: { setPaused(paused: boolean): void }): { open(barmaid: Npc): void; menu: Menu } {
  const shop = () => shopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
  const items = new WeakMap<MenuSlot, ProvisionId>(); // what each slot shown is
  let said = ''; // what the last trade came to, shown under its button
  let name = 'She';
  const fill = (cells: Array<MenuSlot | null>) => {
    while (cells.length < COLUMNS * ROWS) cells.push(null);
    return { cells, columns: COLUMNS };
  };
  const slotOf = (id: ProvisionId, count: number, price: number): MenuSlot => {
    const slot: MenuSlot = { icon: bagIcon(id), badge: `×${count}`, title: PROVISIONS[id].name, tag: coinParts(price) };
    items.set(slot, id);
    return slot;
  };
  // The panel on the right: the item chosen, what it's worth, and the button to trade it.
  const detail = (selling: boolean) => (slot: MenuSlot | null) => {
    const pane = document.createElement('div');
    const id = slot && items.get(slot);
    if (!id) {
      pane.append(line('menu-detail-hint', selling ? 'You have no food or drink to sell.' : 'She has nothing left.'));
      return pane;
    }
    const item = PROVISIONS[id];
    const price = selling ? sellPrice(id) : buyPrice(id);
    const icon = document.createElement('div');
    icon.className = 'menu-detail-icon';
    icon.append(bagIcon(id)(72));
    // Its facts, label on the left and value on the right.
    const facts = document.createElement('dl');
    facts.className = 'menu-detail-facts';
    const fact = (label: string, value: Array<string | HTMLElement>) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.append(...value);
      facts.append(dt, dd);
    };
    fact(selling ? 'She pays' : 'Price', coinParts(price));
    fact(item.drink ? 'Drink, heals' : 'Food, heals', [String(item.heal)]);
    fact(selling ? 'You have' : 'In stock', [String(selling ? (model.hero.bag[id] ?? 0) : (shop().stock[id] ?? 0))]);
    pane.append(icon, line('menu-detail-name', item.name), line('menu-detail-about', item.about), facts);
    const why = selling ? (shop().money < price ? "She hasn't the coin for that." : '') : (shop().stock[id] ?? 0) <= 0 ? 'Sold out.' : model.hero.money < price ? "You can't afford that." : '';
    const button = document.createElement('button');
    button.className = 'menu-detail-button';
    button.textContent = selling ? 'Sell one' : 'Buy one';
    button.disabled = !!why;
    button.addEventListener('click', () => {
      const result = selling ? sell(shop(), model.hero, id) : buy(shop(), model.hero, id);
      said = result === 'bought' ? `Bought a ${item.name}.` : result === 'sold' ? `Sold a ${item.name}.` : selling ? SELL_SAYS[result as keyof typeof SELL_SAYS] : BUY_SAYS[result as keyof typeof BUY_SAYS];
      menu.refresh();
      said = '';
    });
    pane.append(line('menu-detail-said', why || said), button);
    return pane;
  };
  const menu = createMenu({
    title: 'Wares',
    keyHints: false,
    onOpenChange: (open) => hooks.setPaused(open),
    tabs: [
      {
        name: 'Buy',
        slots: () => fill(PROVISION_IDS.filter((id) => (shop().stock[id] ?? 0) > 0).map((id) => slotOf(id, shop().stock[id]!, buyPrice(id)))),
        detail: detail(false),
        footer: () => purses(name, shop(), model.hero.money),
      },
      {
        name: 'Sell',
        slots: () =>
          fill((Object.keys(model.hero.bag) as string[]).filter((id): id is ProvisionId => isProvision(id) && (model.hero.bag[id] ?? 0) > 0).map((id) => slotOf(id, model.hero.bag[id]!, sellPrice(id)))),
        detail: detail(true),
        footer: () => purses(name, shop(), model.hero.money),
      },
    ],
  });
  return {
    menu,
    open(npc) {
      name = npc.name;
      menu.setTitle(`${npc.name}'s wares`);
      menu.open();
    },
  };
}

function line(className: string, text: string): HTMLElement {
  const node = document.createElement('div');
  node.className = className;
  node.textContent = text;
  return node;
}
