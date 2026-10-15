// Trading at a stall in the cathedral town's square (E by its keeper, across the counter): the relic-monger's relics,
// the clothier's finery, the vintner's wines, the apothecary's greater potions, to buy; the sort of thing each sells,
// to sell them (the window: tradePanel.ts; the stall's wares: model/town/stallShop.ts). Each keeper says their own
// (the relic-mongers swear to everything); shut, their stall closed, of a night.

import type { GameModel } from '../../model/GameModel';
import type { Npc } from '../../model/npcs/npcs';
import { ITEMS, SLOT_NAMES, type ItemId } from '../../model/human/equipment';
import { baseOf, type GearKey } from '../../model/human/items/gear';
import { POTIONS, isPotion, potionText } from '../../model/loot/potions';
import { PROVISIONS, givesText, isProvision } from '../../model/loot/provisions';
import { buyAtStall, sellAtStall, stallBuys, stallPrice, stallShopAt, stallWares } from '../../model/town/stallShop';
import type { StallKind } from '../../model/town/townPlan';
import type { BagItem } from '../../model/hero/bag';
import { say } from '../../model/npcs/speech';
import { toned, type Menu } from '../../view/ui/menu';
import { againstWorn, gearLines } from '../hero/gearLines';
import { createTradePanel, pick, type TradeBag, type TradeLines } from './tradePanel';

const LINES: Record<StallKind, TradeLines> = {
  relics: {
    hello: ['Relics! True relics! Each one blessed, every one certified.', 'Touch it and your gout goes. Touch it twice, your wife comes back.', "Pilgrim! You've walked so far. Don't go home with nothing holy.", 'Bones of the blessed, cheaper than anywhere this side of heaven.'],
    bought: ['A wise soul. The saint smiles on you.', 'Wear it next to the skin. Works faster.', "Blessed. Twice, that one. I was there.", 'Heaven keeps the receipt.'],
    sold: ["Mm. I'll have it blessed again.", 'Holy enough. Just.', "Fine. Don't ask where it goes next."],
    'sold out': ['The saint had only so many knuckles. Come back Thursday.', "Sold out. They're making more. I mean, finding more."],
    'too poor': ["Grace isn't free, friend.", 'Faith is free. Relics cost money.', 'Come back when the Lord has blessed your purse.'],
    short: ["My coffer's thin as a novice's soup. Not today.", "Can't pay that. The bishop takes his tithe first."],
  },
  cloth: {
    hello: ['Velvet from the south, silk from further. Feel it. Go on.', 'You dress like a road. Let me fix that.', "Finest cloth in the old kingdom. What's left of it.", "Don't touch with those hands. Well, all right, touch."],
    bought: ["It suits you. Truly. I'd say so anyway, but truly.", 'Now you look like someone worth robbing.', 'A fine choice. Mind the hem in the mud.'],
    sold: ["I'll brush it out. Someone'll have it.", 'Hm. Moth or sword? Either way, sold.', 'It had a good life. On someone.'],
    'sold out': ['Gone. The canons buy everything in purple.', 'None left. Come back after the fair.'],
    'too poor': ['Velvet costs, friend. Wool costs less, elsewhere.', "That purse wouldn't buy a sleeve."],
    short: ["Not that much in my box today. Silk doesn't sell itself.", "Can't pay that, not till the canons settle up."],
  },
  wine: {
    hello: ["Wine from the abbey slopes. The good barrels, not the altar's.", 'A taste? No? A whole bottle, then.', 'The inn waters theirs. I swear on my mother I don\'t.', 'Hippocras, warm as a kiss. Or the bishop\'s own, if you\'ve the coin.'],
    bought: ["Drink it slow. Or don't. I'm not your mother.", 'To your health! And mine, I made a copper.', "That'll put fire in you."],
    sold: ["I'll pour it for someone thirstier.", 'Still corked? Good. Done.'],
    'sold out': ['The canons drank the last of it. At morning prayers.', 'Gone. Thirsty town.'],
    'too poor': ['Wine for coin, friend. Water\'s from the well, free.', 'Not on that purse.'],
    short: ["My purse is drier than my cellar. Not today."],
  },
  potions: {
    hello: ["The strong stuff. Not the village herb-wife's.", 'Greater draughts, brewed by the infirmarer. Mostly.', "Wounded? Weary? Both? I've both."],
    bought: ['A sip, not a gulp. Unless you\'re dying.', 'It glows. That\'s how you know.', "That'll mend what the road broke."],
    sold: ['Still sealed? Good.', "I'll take it. The pilgrims fall over a lot."],
    'sold out': ['None left. The witch-finders bought the lot. Funny, that.', 'Gone. Come back after the brewing.'],
    'too poor': ['Strong brews cost strong coin.', "Can't give it away. The infirmarer counts."],
    short: ["My box can't stretch to that."],
  },
};
const ABOUT: Record<StallKind, readonly string[]> = {
  relics: ['From the saint himself. Or near enough.', 'It hums at night. Listen.', 'Three bishops kissed that one.'],
  cloth: ['Spun by nuns. Very quiet nuns.', "That's real dye. It won't run. Much."],
  wine: ['Laid down the year of the long frost.', 'From the cellar under the chapter house.'],
  potions: ['It tastes of copper and honey.', 'Shake it first.'],
};
const SHUT = ["Stall's shut. Come back at first light.", "Closed, friend. I'm off to my bed."];
const OPEN: [number, number] = [7, 20]; // (stallKeepers.ts' hours)
const shut = (minutes: number) => {
  const hour = Math.floor(minutes / 60) % 24;
  return hour < OPEN[0] || hour >= OPEN[1];
};

export function createStallPanel(model: GameModel, hooks: { bag?: TradeBag }): { open(keeper: Npc): void; update(): void; menu: Menu } {
  let keeper: Npc | null = null;
  const kind = (): StallKind => keeper!.stall!.kind;
  const shop = () => stallShopAt(model.shops, model.seed, keeper!.stall!);
  const lines: TradeLines = { hello: [], bought: [], sold: [], 'sold out': [], 'too poor': [], short: [] };
  const panel = createTradePanel(model, hooks, {
    title: 'Stall',
    shop,
    wares: () => stallWares(kind()).map(([id]) => id),
    wanted: (id): id is BagItem => stallBuys(kind(), id),
    price: stallPrice,
    trade: (id, selling) => (selling ? sellAtStall(shop(), model.hero, kind(), id) : buyAtStall(shop(), model.hero, id)),
    lines,
    about: () => pick(ABOUT[kind()]),
    offered: (name) => `${name}? I can sell that on.`,
    junk: (_name, paid) => `Odds and ends? ${paid}, and that's charity.`,
    boughtBack: (name, paid) => `The ${name.toLowerCase()} back? ${paid}, as I paid.`,
    blurb: (id) => (isPotion(id) ? POTIONS[id].about : isProvision(id) ? PROVISIONS[id].about : kind() === 'relics' ? 'Sworn to be the true one.' : 'Fine work, made to measure.'),
    facts: (id) =>
      isPotion(id) ? [toned('kind', 'Potion'), toned('stat', potionText(id))] : isProvision(id) ? [toned('kind', 'Drink'), toned('stat', givesText(id))] : [toned('kind', SLOT_NAMES[ITEMS[baseOf(id as GearKey)].slot]), ...gearLines(id as ItemId), ...againstWorn(id as ItemId, model.hero.equipment)],
  });
  return {
    ...panel,
    open(npc) {
      if (!npc.stall) return;
      if (shut(model.minutes)) return say(npc, pick(SHUT));
      keeper = npc;
      Object.assign(lines, LINES[npc.stall.kind]); // (their own words, theirs alone)
      panel.open(npc);
    },
    update() {
      if (panel.menu.isOpen && keeper && shut(model.minutes)) {
        panel.menu.close();
        say(keeper, pick(SHUT));
      }
      panel.update();
    },
  };
}
