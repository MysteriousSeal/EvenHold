// Trading with a pedlar on the road (E by them): food for the road and the
// trinkets in their pack, to buy; food, drink and trinkets the hero has, to
// sell them (the window: tradePanel.ts; their pack: travellers/pedlarShop.ts).

import { POTIONS, isPotion, potionText } from '../../model/loot/potions';
import type { GameModel } from '../../model/GameModel';
import { ITEMS, SLOT_NAMES, type ItemId } from '../../model/human/equipment';
import { PROVISIONS, givesText, isProvision } from '../../model/loot/provisions';
import { PEDLAR_WARES, buyFromPedlar, pedlarBuys, pedlarPrice, pedlarShopAt, sellToPedlar } from '../../model/travellers/pedlarShop';
import { WORD_HOLD, type Traveller } from '../../model/travellers/travellers';
import { isBagItem } from '../../model/loot/bags';
import { ROOM_PER_BAG } from '../../model/hero/bagSlots';
import { toned, type Menu } from '../../view/ui/menu';
import { againstWorn, gearLines } from '../hero/gearLines';
import { createTradePanel, pick, type TradeBag, type TradeLines } from './tradePanel';

const LINES: TradeLines = {
  hello: [
    'Trinkets and travel bread! Have a look, have a look.',
    "Fresh from the last village, all of it. Mostly.",
    "My pack's heavy and my purse is light. Let's fix both.",
    'A charm for the road? You look like you need one.',
    "Stop a while, friend. My feet need the rest.",
  ],
  bought: ['A fine choice, if I say so myself.', "That'll bring you luck. Or at least it won't hurt.", 'Pleasure doing business.', 'Lighter pack, happier pedlar.'],
  sold: ["I'll find a buyer down the road.", 'Hm, I can sell that on.', "Fair's fair. Here.", 'Into the pack it goes.'],
  'sold out': ["Sold the last of those two villages back.", "None left, I'm afraid. Next time.", "Gone. Should've come by sooner."],
  'too poor': ["I can't give it away, friend.", "Short of coin? So am I, always.", 'Come back when your purse is fatter.'],
  short: ["My purse can't stretch that far.", "I'm near enough skint myself. Not today.", "Can't pay for that till I've sold a few things."],
};
const ABOUT = ["Wear it in good health.", "Bought it off a sailor. Or so he said.", "It's older than it looks.", 'Lucky, that one. I think.'];
const JUNK = ["Odds and ends? I'll take them, for a copper or two. {paid}.", "One pedlar's junk... is still junk. {paid}, then.", 'Into the bottom of the pack. {paid} for it.'];
const BOUGHT_BACK = ['Back again, the {it}? {paid}, same as I paid.', "Changed your mind? Can't blame you. {paid}."];

export function createPedlarPanel(model: GameModel, hooks: { bag?: TradeBag }): { open(pedlar: Traveller): void; update(): void; menu: Menu } {
  // (Theirs stood still while the window's open: held each frame, a moment's grace past it.)
  let pedlar: Traveller | null = null;
  const shop = () => pedlarShopAt(model.shops, model.seed, pedlar!);
  const panel = createTradePanel(model, hooks, {
    title: 'Pack',
    shop,
    wares: () => [...PEDLAR_WARES],
    wanted: pedlarBuys,
    price: pedlarPrice,
    trade: (id, selling) => (selling ? sellToPedlar(shop(), model.hero, id) : buyFromPedlar(shop(), model.hero, id)),
    lines: LINES,
    about: () => pick(ABOUT),
    offered: (name) => `${name}? I know just the buyer.`,
    junk: (_name, paid) => pick(JUNK).replace('{paid}', paid),
    boughtBack: (name, paid) => pick(BOUGHT_BACK).replace('{it}', name.toLowerCase()).replace('{paid}', paid),
    blurb: (id) => (isProvision(id) ? PROVISIONS[id].about : isPotion(id) ? POTIONS[id].about : isBagItem(id) ? 'Fitted to your bag (B), it holds that much more.' : 'From the bottom of a pedlar\'s pack.'),
    facts: (id) =>
      isProvision(id) ? [toned('kind', PROVISIONS[id].drink ? 'Drink' : 'Food'), toned('stat', givesText(id))] : isPotion(id) ? [toned('kind', 'Potion'), toned('stat', potionText(id))] : isBagItem(id) ? [toned('kind', 'Bag'), toned('stat', `+${ROOM_PER_BAG} bag slots`)] : [toned('kind', SLOT_NAMES[ITEMS[id as ItemId].slot]), ...gearLines(id as ItemId), ...againstWorn(id as ItemId, model.hero.equipment)],
  });
  return {
    ...panel,
    open(t) {
      pedlar = t;
      model.travellers.hold(t, WORD_HOLD);
      panel.open(t);
    },
    update() {
      panel.update();
      if (panel.menu.isOpen && pedlar) model.travellers.hold(pedlar, 0.5); // (trading: they stand)
    },
  };
}
