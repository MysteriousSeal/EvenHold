// Trading with the smith (E by him, in his smithy): the weapons, shields and
// armour he forges, to buy, and any gear of that kind the hero has, to sell
// him (the window: tradePanel.ts). He has only so much of each and only so
// much money (smithy/smithShop.ts).

import type { GameModel } from '../../model/GameModel';
import type { Npc } from '../../model/npcs/npcs';
import type { BagItem } from '../../model/hero/bag';
import { ITEMS, type EquipSlot } from '../../model/human/equipment';
import { baseOf, gearName, isGear, levelOf, slotOfGear, type GearKey } from '../../model/human/items/gear';
import type { ToolId } from '../../model/loot/tools';
import { UNDER_COUNTER, buyGear, gearSellPrice, metalPrice, pickPrice, sellGear, smithAsks, smithBuys, smithPriceFor, smithSellsTo, smithShopIn, smithTakesMetal, smithTakesPick, smithTakesWood, woodPrice } from '../../model/smithy/smithShop';
import { toned, type Menu } from '../../view/ui/menu';
import { againstWorn, gearLines } from '../hero/gearLines';
import { BROKEN, WORN, mendAll, mendBill, wearOf } from '../../model/hero/wear';
import { WOODWORKS } from '../../model/shops/shopStock';
import type { Hero } from '../../model/types';
import { coinWords } from '../../view/ui/coins';
import { plural } from '../../view/ui/words';
import { smithAsleep } from '../../model/smithy/smithWork';
import { createTradePanel, pick, type TradeBag, type TradeLines } from './tradePanel';

// What he says: a greeting when the window opens, and his answer to each trade.
const LINES: TradeLines = {
  hello: [
    "Mind the sparks. What d'you need?",
    'Steel, is it? You came to the right forge.',
    "Everything on that wall I made with these hands. Have a look.",
    "Something's always on the anvil. Have a look.",
    "Speak up, the hammer's loud. What'll it be?",
  ],
  bought: ['Wear it well.', "That'll outlast you, if you're careful.", 'Good steel, that. Treat it right.', 'Come back when it needs an edge.'],
  sold: ["I'll melt it down for something better.", 'Fair enough. Here.', "Not my work, but the iron's good.", "I'll find a use for it."],
  'sold out': ["That's gone. Give me a while at the anvil.", 'Sold the last one this morning.', "None left. I'll forge another."],
  'too poor': ["That's not enough coin. Iron's dear.", "Come back when your purse is heavier.", "I don't give credit, friend."],
  short: ["I can't pay for that right now.", "My purse is empty. Come back after I've sold a few blades.", 'Not today. The ore merchant took the rest.'],
};

// His word on what the hero sells him, by what it is ({it}: its name): gear (or LINES.sold), the metal for his forge,
// what's found in the wood, a woodworker's make (at an eighth: shopStock.ts WOODWORKS), a pickaxe; and worn gear.
const OFFERED = {
  gear: ["{it}? I'll give you what the iron's worth.", "{it}. Someone's work, not mine. I'll take it."],
  metal: ['{it}. Good, that goes straight in the fire.', "{it}? Always need more of that. Here.", "{it}. Saves me a trip to the ore merchant."],
  wood: ['{it}? Good for a haft or a handle. Half what it fetches, mind.', "{it}. The wood's no use to my fire, but the joiner's a friend."],
  woodwork: ["Wood? I work iron, friend. An eighth of its worth, and that's kind.", "A {it}. Kindling, to me. A few coppers.", "Whittled, is it? I'll take it for the stove."],
  pick: ['A pickaxe. Some miner will be glad of it.', "{it}. I'll put a new edge on it and sell it on."],
  worn: ["{it}? Battered half to death. I'll beat it straight.", "Look at the state of this {it}. You fight with it, or dig with it?"],
};
// What he says when he's bought enough of a kind just now (shopStock.ts WANTS).
// ({it}: what, {them}: more than one of it, {wait}: till he'll take another, "4 minutes")
const ENOUGH = ["I've plenty of those already. Come back in {wait}.", "No more {them}, I've nowhere to hang them.", "Another {it}? I've enough. I'm a smith, not a magpie."];
// What he says of the hero's own gear on greeting them, now and then: a worn piece of it, what's his own make, or
// their empty hands.
const ON_GEAR = {
  worn: ["That {it} of yours has seen better days. I can mend it.", "Is that a {it} or a saw? Let me have a look at it.", "Your {it}'s in a sorry state. Coin, and I'll fix it."],
  broken: ["Your {it}'s broken, you know. It's doing you no good like that.", "Broken {it}, swinging it about like it's whole. Give it here."],
  his: ["That {it}'s smith's work. Treating you well?", "Good {it}, that. Someone knew what they were doing."],
  bare: ["Out there with empty hands? Let's fix that.", "No blade on you? You're braver than you look."],
};

// His word, the shop shut for the night.
const SHUT = ["Forge is cold. Come back in the morning.", "We're shut. Forge is cold, and so am I. Morning.", "It's the middle of the night. Forge is cold. Come back in the morning."];

// His word on a pickaxe just bought.
const PICK_BOUGHT = ["Mind your toes with it.", 'Find me some good ore, and bring it here.', "It'll bite rock. Don't use it on doors."];

// His word on gear he's just mended.
const MENDED = ["There. Good as the day it was forged.", 'Straightened, riveted, sharpened. Try not to do that again.', "Took some hammering, that. It'll hold.", 'New straps, a fresh edge. Off you go.', "You've been busy. All mended."];

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

// The level a ware's forged at (a pickaxe: none).
const forging = (id: string): number => (isGear(id) ? levelOf(id) : 0);

export function createSmithPanel(model: GameModel, hooks: { bag?: TradeBag }): { open(smith: Npc): void; update(): void; menu: Menu } {
  const shop = () => smithShopIn(model); // (his village's level: what he forges is at it)
  const panel = createTradePanel(model, hooks, {
    title: 'Wares',
    shop,
    wares: () => (Object.keys(shop().stock).filter((id) => isGear(id) || smithTakesPick(id)) as Array<GearKey | ToolId>).sort((a, b) => Number(smithTakesPick(b) || smithSellsTo(model.hero, b)) - Number(smithTakesPick(a) || smithSellsTo(model.hero, a)) || forging(b) - forging(a)), // (and his pickaxe) // (his forged pieces, at his village's level; his heaviest, till the hero's proven, under the counter, dearer: smithAsks; his latest forging, for the hero grown past his village, first)
    wanted: (id): id is BagItem => smithBuys(id) || smithTakesMetal(id) || smithTakesWood(id) || smithTakesPick(id), // (gear, the iron salvaged from it, what's found in the wood, a pickaxe)
    price: (id, selling) => (smithTakesMetal(id) ? metalPrice(id) : smithTakesWood(id) ? woodPrice(id) : smithTakesPick(id) ? pickPrice(id, selling) : selling ? gearSellPrice(id as GearKey, model.hero) : smithPriceFor(model.hero, id as GearKey)),
    trade: (id, selling) => {
      const result = selling ? sellGear(shop(), model.hero, id) : buyGear(shop(), model.hero, id as GearKey | ToolId);
      return result === 'he is short' ? 'short' : result;
    },
    lines: LINES,
    about: (id) => pick((isGear(id) && ABOUT[slotOfGear(id)]) || (smithTakesPick(id) ? PICK_BOUGHT : LINES.bought)),
    offered: (name, id) => {
      const sold = shop().buyback?.[0]?.id === id ? shop().buyback![0] : undefined; // (just sold: its wear and the mark of the hero's make gone with it, onto the sale)
      const kind = smithTakesMetal(id) ? 'metal' : smithTakesWood(id) ? 'wood' : smithTakesPick(id) ? 'pick' : isGear(id) && WOODWORKS.has(baseOf(id)) && sold?.crafted ? 'woodwork' : (sold?.wear ?? wearOf(model.hero, id)) >= WORN ? 'worn' : 'gear';
      return pick(kind === 'gear' ? [...OFFERED.gear, ...LINES.sold] : OFFERED[kind]).replace('{it}', kind === 'woodwork' || kind === 'worn' ? name.toLowerCase() : name);
    },
    enough: (name, wait) => pick(ENOUGH).replace('{it}', name.toLowerCase()).replace('{them}', plural(name.toLowerCase())).replace('{wait}', wait),
    greeting: () => onGear(model.hero),
    junk: (name, paid) => pick(name ? JUNK_LINES : JUNK_LOT).replace('{it}', name ?? '').replace('{paid}', paid),
    boughtBack: (name, paid) => pick(BOUGHT_BACK).replace('{it}', name).replace('{paid}', paid),
    service: () => {
      const { pieces, total } = mendBill(model.hero);
      return {
        label: pieces.length ? `Mend · ${coinWords(total)}` : 'Mend',
        tip: pieces.length ? `Mend all you wear or carry: ${pieces.map((p) => `${gearName(p.key)} (${p.wear >= BROKEN ? 'broken' : `${Math.floor(p.wear)}% worn`}, ${coinWords(p.cost)})`).join(', ')}${model.hero.money < total ? " · you haven't the coin" : ''}` : 'Nothing you wear or carry needs mending',
        can: pieces.length > 0 && model.hero.money >= total,
        act: () => {
          const done = mendAll(model.hero);
          return done === 'mended' ? pick(MENDED) : done === 'too poor' ? pick(LINES['too poor']) : "There's nothing on you that needs my hammer.";
        },
      };
    },
    blurb: (id) => smithTakesPick(id) ? 'A miner\'s pickaxe: in your bag, E by a rock of the wilds to mine its vein.' : (!smithSellsTo(model.hero, id as GearKey) && shop().stock[id] !== undefined ? `Under the counter: he'd rather sell it to someone proven (level ${smithAsks(id as GearKey)}), but coin talks · ${UNDER_COUNTER}× its price` : ITEMS[baseOf(id as GearKey)].soldBy?.smith ? 'Forged here, by the smith.' : 'Not his make: bought off someone passing through.'),
    facts: (id) => smithTakesPick(id) ? [toned('kind', 'Tool')] : [toned('kind', SLOT_NAMES[slotOfGear(id as GearKey)]), ...gearLines(id as GearKey, model.hero.level), ...againstWorn(id as GearKey, model.hero.equipment)],
  });
  return {
    ...panel,
    // Of a night (smithy/smithWork.ts), the shop shut: his word, and no window.
    open(smith) {
      if (smithAsleep(model.minutes)) return model.report({ kind: 'say', speaker: smith, where: smith.where, text: pick(SHUT) });
      panel.open(smith);
    },
    update() {
      if (panel.menu.isOpen && smithAsleep(model.minutes)) panel.menu.close(); // (night fallen, trading)
      panel.update();
    },
  };
}

// Half the time, a word on what the hero wears (their worst-worn piece, broken or badly worn; what's his trade's make;
// their bare hands), else none: his plain greeting.
function onGear(hero: Hero): string | null {
  if (Math.random() < 0.5) return null;
  const worst = mendBill(hero).pieces.filter((p) => Object.values(hero.equipment).includes(p.key)).sort((a, b) => b.wear - a.wear)[0];
  const say = (lines: readonly string[], key: GearKey) => pick(lines).replace('{it}', gearName(key).toLowerCase());
  if (worst && worst.wear >= WORN) return say(worst.wear >= BROKEN ? ON_GEAR.broken : ON_GEAR.worn, worst.key);
  if (!hero.equipment.mainHand) return pick(ON_GEAR.bare);
  const his = Object.values(hero.equipment).filter((k): k is GearKey => !!k && isGear(k) && !!ITEMS[baseOf(k)].soldBy?.smith);
  return his.length ? say(ON_GEAR.his, his[Math.floor(Math.random() * his.length)]) : null;
}
