// Trading with the smith (E by him, in his smithy): the weapons, shields and
// armour he forges, to buy, and any gear of that kind the hero has, to sell
// him (the window: tradePanel.ts). He has only so much of each and only so
// much money (smithy/smithShop.ts).

import type { GameModel } from '../model/GameModel';
import type { Npc } from '../model/npcs/npcs';
import { ITEMS, type EquipSlot, type ItemId } from '../model/human/equipment';
import { SMITH_WARES, buyGear, gearPrice, gearSellPrice, sellGear, smithBuys, smithShopAt } from '../model/smithy/smithShop';
import type { Menu } from '../view/ui/menu';
import { createTradePanel, pick, type TradeBag, type TradeLines } from './tradePanel';

// What he says: a greeting when the window opens, and his answer to each trade.
const LINES: TradeLines = {
  hello: [
    "Mind the sparks. What d'you need?",
    'Steel, is it? You came to the right forge.',
    "Everything on that wall I made with these hands. Have a look.",
    "Back for more? Something's always on the anvil.",
    "Speak up, the hammer's loud. What'll it be?",
  ],
  bought: ['Wear it well.', "That'll outlast you, if you're careful.", 'Good steel, that. Treat it right.', 'Come back when it needs an edge.'],
  sold: ["I'll melt it down for something better.", 'Fair enough. Here.', "Not my work, but the iron's good.", "I'll find a use for it."],
  'sold out': ["That's gone. Give me a while at the anvil.", 'Sold the last one this morning.', "None left. I'll forge another."],
  'too poor': ["That's not enough coin. Iron's dear.", "Come back when your purse is heavier.", "I don't give credit, friend."],
  short: ["I can't pay for that right now.", "My purse is empty. Come back after I've sold a few blades.", 'Not today. The ore merchant took the rest.'],
};

// His word on what's just been bought, by what it's worn on.
const ABOUT: Partial<Record<EquipSlot, readonly string[]>> = {
  mainHand: ['Balanced right, that one. Feel the weight.', 'Folded and quenched twice. It holds an edge.', "Swing it a few times. You'll see."],
  offHand: ["Oak and iron. It'll turn a blow.", 'Put your shoulder behind it and nothing gets through.', 'Strapped tight, rimmed in iron.'],
  head: ["Keeps your skull where it belongs.", 'Riveted by hand. Every one of them.'],
  torso: ["A month's work, that. Every ring by hand.", "It'll stop a blade. Not a boulder, mind."],
  shoulders: ['Guards the shoulders, where the blows fall.', 'Light enough to swing in.'],
  hands: ['Keep your fingers. You need them.', 'Stiff at first. They soften.'],
  legs: ['Your legs will thank you.', "Heavy, but you'll get used to it."],
  feet: ['Good for the road, better for a kick.', 'Iron-shod. Mind your step on the flagstones.'],
};
const SLOT_NAMES: Record<EquipSlot, string> = { head: 'Head', shoulders: 'Shoulders', torso: 'Body', hands: 'Hands', legs: 'Legs', feet: 'Feet', neck: 'Neck', ring: 'Finger', mainHand: 'Weapon hand', offHand: 'Off hand' };

// His word on junk the hero sells him, one thing ({it}: what it is; {paid}: what he gives, "3 copper")…
const JUNK_LINES = [
  "A {it}? Not much use at the forge. {paid}, and it's off your hands.",
  "A {it}. I've a peddler who'll buy that. {paid}.",
  "Hm, a {it}. Toss it on the pile by the door. {paid}.",
  "A {it}? {paid}. Don't make a habit of it.",
  "A {it}. The rag-and-bone man will want that, not me.",
  "A {it}? You bring me the strangest things.",
  "Put the {it} down there. Mind the anvil.",
  "A {it}. I'll melt it, sell it, or burn it. Fine.",
  "A {it}? Hardly smith's work, but I'll have it.",
];
// His word on the hero buying back what they sold him ({it}: what; {paid}: for how much).
const BOUGHT_BACK = [
  "Changed your mind? Your {it}, then. {paid}.",
  "Back again for your {it}? {paid}, same as I gave.",
  "Hmph. Your {it}. {paid}, and we're square.",
  "Your {it}, back where it belongs.",
  "Knew you'd miss your {it}. Here.",
  "Take your {it}. And make up your mind next time.",
  "Still had your {it} under the counter. There.",
  "Your {it}? Fine. Off with you.",
];
// …and a whole lot at once.
const JUNK_LOT = [
  "Scraps and rags. {paid} for the lot, and that's generous.",
  "That's a pile of rubbish. {paid}, and not a copper more.",
  "Emptying your bag on my counter? Fine. {paid}.",
  "All of it? My counter isn't a midden.",
  "Rubbish, the lot. I'll take it anyway.",
  "Where do you find all this? Never mind. Done.",
  "Fine. Sweep it into the bin by the door.",
  "More scrap than a battlefield. Here.",
];

export function createSmithPanel(model: GameModel, hooks: { bag?: TradeBag }): { open(smith: Npc): void; update(): void; menu: Menu } {
  const shop = () => smithShopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
  return createTradePanel(model, hooks, {
    title: 'Wares',
    shop,
    wares: () => SMITH_WARES,
    wanted: smithBuys,
    price: (id, selling) => (selling ? gearSellPrice(id as ItemId) : gearPrice(id as ItemId)),
    trade: (id, selling) => {
      const result = selling ? sellGear(shop(), model.hero, id) : buyGear(shop(), model.hero, id as ItemId);
      return result === 'he is short' ? 'short' : result;
    },
    lines: LINES,
    about: (id) => pick(ABOUT[ITEMS[id as ItemId].slot] ?? LINES.hello),
    offered: (name) => `${name}? I'll give you what the iron's worth.`,
    junk: (name, paid) => pick(name ? JUNK_LINES : JUNK_LOT).replace('{it}', name ?? '').replace('{paid}', paid),
    boughtBack: (name, paid) => pick(BOUGHT_BACK).replace('{it}', name).replace('{paid}', paid),
    blurb: (id) => (ITEMS[id as ItemId].soldBy?.smith ? 'Forged here, by the smith.' : 'Not his make: he buys it for its metal.'),
    facts: (id) => [['Worn on', SLOT_NAMES[ITEMS[id as ItemId].slot]]],
  });
}
