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
import { voxelIcon } from '../view/ui/voxelIcon';
import { humanBust } from '../view/meshes/human/humanFigure';

// What she says: a greeting when the window opens, and her answer to each trade.
const LINES = {
  hello: [
    "What'll it be, love?",
    'Warm yourself by the fire, then tell me what you fancy.',
    "Back again? I've kept a seat for you.",
    'Ale, bread, a hot pie... I\'ve a bit of everything.',
    'Mind the step, it\'s a new floor. Now, what can I get you?',
    "You look like you've walked a long road. Hungry?",
  ],
  bought: ['Enjoy it!', "That'll put the colour back in your cheeks.", 'Good choice, that.', 'Anything else, love?'],
  sold: [
    "I'll take that off your hands.",
    'That will do nicely on the shelf.',
    'Fair enough, here you are.',
    "Someone'll be glad of that come supper.",
    "Not bad at all. Here's your coin, don't spend it all in one tavern. Well, do.",
    'Straight into the pantry with you.',
    "A fair trade. My da would be proud of me.",
  ],
  'sold out': [
    "All gone, I'm afraid. Come back later.",
    "The last one went an hour ago. There's a fellow snoring by the fire who had it.",
    'Not a crumb left. Give me a while to fetch more from the cellar.',
    "Sold clean out. Busy night, it's been.",
    "Nothing left, love. Ask me again after the next delivery.",
  ],
  'too poor': [
    'Come back when your purse is heavier, love.',
    "That's not enough coin, and I don't keep a slate for strangers.",
    'Short a few coppers there. Try the apples, they come cheaper.',
    "I'd love to, truly, but the brewer won't take smiles as payment.",
    'Go and bash a few bandits, then come back with their purses.',
  ],
  'she is short': [
    "I can't pay you for that just now, the till's near empty.",
    "My purse is lighter than a feather tonight. Sell me something smaller?",
    "I'd take it if I could, but I've spent the last of my coin on barrels.",
    'Come back once some thirsty folk have filled my till.',
    "Not today, love. I've barely enough to pay the cook.",
  ],
} as const;
// What she says of each of her wares when the hero picks it out (one of
// several, at random); and of
// what the hero offers her, when selling.
const ABOUT: Record<ProvisionId, readonly string[]> = {
  bread: [
    'Fresh from the oven this morning, still soft.',
    'Tear it while it steams. That smell alone is worth the copper.',
    "Baker's lad swears he kneads it with his elbows. I don't ask.",
    'Crust you could knock on a door with, and soft as a cloud inside.',
  ],
  cheese: [
    'From the dairy up the valley. Sharp, mind.',
    "Aged in a cave for a whole winter. It's earned its bite.",
    "The goats that made it are meaner than any bandit. You can taste it.",
    'Goes lovely with a crust of bread and a quiet evening.',
  ],
  apple: [
    'Picked this week, from the tree out back.',
    'Crisp enough to wake the dead. Well, nearly.',
    "Wash it in the trough first. The birds got to that tree before me.",
    'An apple a day keeps the healer away, my gran always said.',
  ],
  roastLeg: [
    'Been turning on the spit since dawn.',
    "Rubbed with salt and thyme. The dogs have been sulking all day.",
    'Fall off the bone, it will. Mind your fingers, it drips.',
    "Hunter brought it in yesterday. Don't ask me what it was.",
  ],
  meatPie: [
    "My mother's recipe. Don't tell the cook.",
    "What's in it? Meat. Good meat. Mostly meat. Eat up.",
    'Gravy right to the crust. Best eaten hot, over the fire.',
    'Last traveller who had two of these slept till noon.',
  ],
  ale: [
    'Our own brew. Strong enough to curl a beard.',
    "Brewed in the cellar, where it's dark and it's cold and it's happy.",
    'Frothing over the top, just how it should be.',
    "One's thirsty work, two's a song, three's a brawl. Mind yourself.",
  ],
  mead: [
    'Sweet as summer. Goes straight to the head.',
    'Honey from our own hives. The bees drove a hard bargain.',
    "The old folk drink it at weddings. And funerals. And Tuesdays.",
    'Warms you from the toes up, that does.',
  ],
  wine: [
    'From the south, that. Only for special days.',
    "Came by cart over the pass. Half the barrels didn't make it.",
    'Red as a sunset, sealed in wax. The lord upstairs orders it.',
    'Sip it slow, love. Wine like that deserves a little patience.',
  ],
};
const offered = (name: string) => `A ${name.toLowerCase()}? I could use that.`;
const pick = (lines: readonly string[]) => lines[Math.floor(Math.random() * lines.length)];

const COLUMNS = 4;
const ROWS = 2;

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
  let barmaid: Npc | null = null;
  let says = ''; // what she's saying: a greeting, her word on what's picked, or her answer to a trade
  let saysLine: HTMLElement | null = null; // where it's shown now
  let drawn = false; // the tab was just drawn: its first pick is the menu's, not the hero's
  let trading = false; // redrawing after a trade: its picks are the menu's too
  const fill = (cells: Array<MenuSlot | null>) => {
    while (cells.length < COLUMNS * ROWS) cells.push(null);
    return { cells, columns: COLUMNS };
  };
  const slotOf = (id: ProvisionId, count: number, price: number): MenuSlot => {
    const slot: MenuSlot = { icon: bagIcon(id), badge: count > 0 ? `×${count}` : 'Sold out', dim: count <= 0, title: PROVISIONS[id].name, tag: coinParts(price) };
    items.set(slot, id);
    return slot;
  };
  // The panel on the right: the item chosen, what it's worth, and the button to trade it.
  const detail = (selling: boolean) => (slot: MenuSlot | null) => {
    const pane = document.createElement('div');
    const id = slot && items.get(slot);
    // The hero picking something out (again, too): she says a word about it.
    if (id && !drawn && !trading && saysLine) {
      says = selling ? offered(PROVISIONS[id].name) : (shop().stock[id] ?? 0) <= 0 ? pick(LINES['sold out']) : pick(ABOUT[id]); // sold out: she says so
      saysLine.textContent = `“${says}”`;
    }
    drawn = false;
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
    // Can't be had: it looks it, but a click still asks her, and she says why.
    button.classList.toggle('unavailable', !!why);
    button.addEventListener('click', () => {
      const result = selling ? sell(shop(), model.hero, id) : buy(shop(), model.hero, id);
      if (result in LINES) says = pick(LINES[result as keyof typeof LINES]);
      trading = true; // her answer stands through the redraw
      menu.refresh();
      trading = false;
    });
    pane.append(line('menu-detail-said', why), button);
    return pane;
  };
  // Her talking, over the tab (drawn afresh with it: its first pick isn't the hero's).
  const header = () => {
    drawn = true;
    const row = talk(barmaid!, says);
    saysLine = row.querySelector('.shop-talk-says');
    return row;
  };
  const menu = createMenu({
    title: 'Wares',
    keyHints: false,
    onOpenChange: (open) => hooks.setPaused(open),
    tabs: [
      {
        name: 'Buy',
        slots: () => fill(PROVISION_IDS.map((id) => slotOf(id, shop().stock[id] ?? 0, buyPrice(id)))), // sold out too: shown, not to be had
        detail: detail(false),
        header: () => header(),
        footer: () => purses(barmaid!.name, shop(), model.hero.money),
      },
      {
        name: 'Sell',
        slots: () =>
          fill((Object.keys(model.hero.bag) as string[]).filter((id): id is ProvisionId => isProvision(id) && (model.hero.bag[id] ?? 0) > 0).map((id) => slotOf(id, model.hero.bag[id]!, sellPrice(id)))),
        detail: detail(true),
        header: () => header(),
        footer: () => purses(barmaid!.name, shop(), model.hero.money),
      },
    ],
  });
  return {
    menu,
    open(npc) {
      barmaid = npc;
      says = pick(LINES.hello);
      menu.setTitle(`${npc.name}'s wares`);
      menu.open();
    },
  };
}

// Her, talking: her face on the left, her name and what she says in a bubble.
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
