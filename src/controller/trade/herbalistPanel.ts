// Trading with a village's herbalist (E by them, at home): their potions, to
// buy; potions and raw ingredients the hero has, to sell them (the window:
// tradePanel.ts; their shop: herbalist/herbalistShop.ts).

import type { GameModel } from '../../model/GameModel';
import type { Npc } from '../../model/npcs/npcs';
import { POTIONS, isPotion, potionText } from '../../model/loot/potions';
import { LOOT } from '../../model/loot/loot';
import { HERBALIST_WARES, buyFromHerbalist, herbalistBuys, herbalistPrice, herbalistShopAt, sellToHerbalist } from '../../model/herbalist/herbalistShop';
import { kindOf } from '../../model/hero/bag';
import { toned, type Menu } from '../../view/ui/menu';
import { createTradePanel, pick, type TradeBag, type TradeLines } from './tradePanel';

const LINES: TradeLines = {
  hello: [
    'Mind the drying racks. What ails you?',
    'Red to mend you, blue to keep you going. Which is it?',
    "Brewed this week, every one. Don't shake them.",
    "Come in, come in. You've the look of someone who fights things.",
  ],
  bought: ['Drink it when you need it, not before.', 'Cork it tight, it keeps a month.', "That one's good. My grandmother's way."],
  sold: ["I'll find a use for that.", 'Into the pot, then. Here.', "Good, I was running low."],
  'sold out': ["None left. Give me a few days over the cauldron.", "Sold the last one. They go quick."],
  'too poor': ["Herbs aren't free, I'm afraid.", 'Come back when your purse is fuller.'],
  short: ["I can't pay that just now.", "My purse is near empty. After market day, maybe."],
};
const ABOUT = ['Not on an empty stomach.', 'You\'ll feel it in a breath or two.', "Don't tell the priest I make these."];
const JUNK = ["Bones and scraps? I can grind some of it. {paid}.", 'Hm. {paid}, and take the smell with you.'];
const BOUGHT_BACK = ['The {it} back? {paid}, as I paid.', 'Changed your mind? {paid}, then.'];

export function createHerbalistPanel(model: GameModel, hooks: { bag?: TradeBag }): { open(herbalist: Npc): void; update(): void; menu: Menu } {
  let herbalist: Npc | null = null;
  const shop = () => herbalistShopAt(model.shops, model.seed, herbalist!);
  const panel = createTradePanel(model, hooks, {
    title: 'Herbs & potions',
    shop,
    wares: () => [...HERBALIST_WARES],
    wanted: herbalistBuys,
    price: herbalistPrice,
    trade: (id, selling) => (selling ? sellToHerbalist(shop(), model.hero, id) : buyFromHerbalist(shop(), model.hero, id)),
    lines: LINES,
    about: () => pick(ABOUT),
    offered: (name) => `${name}? I can brew with that.`,
    junk: (_name, paid) => pick(JUNK).replace('{paid}', paid),
    boughtBack: (name, paid) => pick(BOUGHT_BACK).replace('{it}', name.toLowerCase()).replace('{paid}', paid),
    blurb: (id) => (isPotion(id) ? POTIONS[id].about : `${LOOT[id as keyof typeof LOOT].name}: good in a brew.`),
    facts: (id) => (isPotion(id) ? [toned('kind', 'Potion'), toned('stat', potionText(id))] : [toned('kind', kindOf(id))]),
  });
  return {
    ...panel,
    open(npc) {
      herbalist = npc;
      panel.open(npc);
    },
  };
}
