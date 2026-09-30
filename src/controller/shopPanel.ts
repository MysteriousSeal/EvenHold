// Trading with the barmaid (E by her bar): her food and drink to buy, and
// the hero's to sell her (the window: tradePanel.ts). She has only so much of
// each and only so much money (inn/tavernShop.ts).

import type { GameModel } from '../model/GameModel';
import type { Npc } from '../model/npcs/npcs';
import { buy, buyPrice, sell, sellPrice, shopAt } from '../model/inn/tavernShop';
import { PROVISIONS, PROVISION_IDS, isProvision, type ProvisionId } from '../model/loot/provisions';
import type { Menu } from '../view/ui/menu';
import { createTradePanel, pick, type TradeBag, type TradeLines } from './tradePanel';

// What she says: a greeting when the window opens, and her answer to each trade.
const LINES: TradeLines = {
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
  short: [
    "I can't pay you for that just now, the till's near empty.",
    "My purse is lighter than a feather tonight. Sell me something smaller?",
    "I'd take it if I could, but I've spent the last of my coin on barrels.",
    'Come back once some thirsty folk have filled my till.',
    "Not today, love. I've barely enough to pay the cook.",
  ],
};
// What she says of each of her wares when the hero buys one (one of
// several, at random).
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

export function createShopPanel(model: GameModel, hooks: { bag?: TradeBag }): { open(barmaid: Npc): void; update(): void; menu: Menu } {
  const shop = () => shopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));
  return createTradePanel(model, hooks, {
    title: 'Wares',
    shop,
    wares: () => PROVISION_IDS,
    wanted: isProvision,
    price: (id, selling) => (selling ? sellPrice(id as ProvisionId) : buyPrice(id as ProvisionId)),
    trade: (id, selling) => {
      const result = selling ? sell(shop(), model.hero, id) : buy(shop(), model.hero, id as ProvisionId);
      return result === 'she is short' ? 'short' : result;
    },
    lines: LINES,
    about: (id) => pick(ABOUT[id as ProvisionId]),
    offered: (name) => `A ${name.toLowerCase()}? I could use that.`,
    blurb: (id) => PROVISIONS[id as ProvisionId].about,
    facts: (id) => [[PROVISIONS[id as ProvisionId].drink ? 'Drink, heals' : 'Food, heals', String(PROVISIONS[id as ProvisionId].heal)]],
  });
}
