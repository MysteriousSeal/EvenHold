// Trading with a pedlar on the road (E by them): food for the road, a fishing rod and the
// trinkets in their pack, to buy; food, drink and trinkets the hero has, to
// sell them, and the crypts' bones as relics (the window: tradePanel.ts; their pack: travellers/pedlarShop.ts).
// They greet the hero by how they find them, camped for the night or not; the news of the road at the foot of their
// window; a rumour to buy, a place inked on the map (travellers/pedlarNews.ts). Gone from the road mid-trade (turned
// into something by a charm), the window shuts.

import { POTIONS, isPotion, potionText } from '../../model/loot/potions';
import type { GameModel } from '../../model/GameModel';
import { ITEMS, SLOT_NAMES, type ItemId } from '../../model/human/equipment';
import { PROVISIONS, givesText, isProvision } from '../../model/loot/provisions';
import { buyFromPedlar, pedlarWaresOf, isRelic, pedlarBuys, pedlarPrice, pedlarShopAt, sellToPedlar, wantsRelic } from '../../model/travellers/pedlarShop';
import { RUMOUR_PRICE, buyRumour, pedlarGreets, pedlarNews, rumourOf, rumourToSell } from '../../model/travellers/pedlarNews';
import { coinWords } from '../../view/ui/coins';
import { WORD_HOLD, type Traveller } from '../../model/travellers/travellers';
import { isBagItem } from '../../model/loot/bags';
import type { BagItem } from '../../model/hero/bag';
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
// Their word on a relic sold them (a bone charm, a shroud).
const RELIC = ["A saint's finger, near enough. The pilgrims will queue to kiss it.", "Holy relic. Says so on the label. Well, it will.", "That'll fetch silver on the cathedral road. Don't tell anyone where it came from."];

export function createPedlarPanel(model: GameModel, hooks: { bag?: TradeBag }): { open(pedlar: Traveller): void; update(): void; menu: Menu } {
  // (Theirs stood still while the window's open: held each frame, a moment's grace past it.)
  let pedlar: Traveller | null = null;
  let news = Math.floor(Math.random() * 12); // which of the road's news they tell
  const shop = () => pedlarShopAt(model.shops, model.seed, pedlar!);
  const panel = createTradePanel(model, hooks, {
    title: 'Pack',
    shop,
    wares: () => pedlarWaresOf(model.seed, pedlar!), // (what they carry: none shown sold out that never comes back)
    wanted: (id): id is BagItem => pedlarBuys(id) && wantsRelic(shop(), id), // (a relic past what they want: junk to them, as to anyone)
    price: (id, selling) => pedlarPrice(id, selling, model.hero),
    trade: (id, selling) => (selling ? sellToPedlar(shop(), model.hero, id) : buyFromPedlar(shop(), model.hero, id)),
    lines: LINES,
    about: () => pick(ABOUT),
    greet: () => pedlarGreets(model.hero, !!pedlar?.camp),
    note: () => `News of the road: “${pedlarNews(model.story.saint, news)}”`,
    service: () => {
      const here = pedlar!;
      const can = rumourToSell(shop()) && !!rumourOf(model, here) && model.hero.money >= RUMOUR_PRICE;
      return { label: `A rumour · ${coinWords(RUMOUR_PRICE)}`, tip: 'A place on the roads about, a crypt, a cave or a camp, inked on your map.', can, act: () => buyRumour(model, shop(), model.hero, here).said };
    },
    offered: (name, id) => (isRelic(id) ? pick(RELIC) : `${name}? I know just the buyer.`),
    junk: (_name, paid) => pick(JUNK).replace('{paid}', paid),
    boughtBack: (name, paid) => pick(BOUGHT_BACK).replace('{it}', name.toLowerCase()).replace('{paid}', paid),
    blurb: (id) => (isProvision(id) ? PROVISIONS[id].about : isPotion(id) ? POTIONS[id].about : isBagItem(id) ? 'Fitted to your bag (B), it holds that much more.' : id === 'fishingRod' ? 'Kept in your bag, it lets you fish: E on a lake shore, facing the water.' : id === 'firewood' ? 'Split and dry, tied with twine. Enough for one fire.' : 'From the bottom of a pedlar\'s pack.'),
    facts: (id) =>
      id === 'firewood' ? [toned('kind', 'Crafting material'), toned('stat', 'Kindles a campfire to cook over')] : isProvision(id) ? [toned('kind', PROVISIONS[id].drink ? 'Drink' : 'Food'), toned('stat', givesText(id))] : isPotion(id) ? [toned('kind', 'Potion'), toned('stat', potionText(id))] : isBagItem(id) ? [toned('kind', 'Bag'), toned('stat', `+${ROOM_PER_BAG} bag slots`)] : id === 'fishingRod' ? [toned('kind', 'Tool'), toned('stat', 'For Fishing')] : [toned('kind', SLOT_NAMES[ITEMS[id as ItemId].slot]), ...gearLines(id as ItemId), ...againstWorn(id as ItemId, model.hero.equipment)],
  });
  return {
    ...panel,
    open(t) {
      pedlar = t;
      news++; // (a new piece each time they're spoken to)
      model.travellers.hold(t, WORD_HOLD);
      panel.open(t);
    },
    update() {
      if (panel.menu.isOpen && pedlar && !model.travellers.list.includes(pedlar)) panel.menu.close(); // (gone from the road: turned into something)
      panel.update();
      if (panel.menu.isOpen && pedlar) model.travellers.hold(pedlar, 0.5); // (trading: they stand)
    },
  };
}
