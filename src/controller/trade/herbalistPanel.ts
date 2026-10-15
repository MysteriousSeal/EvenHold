// Trading with a village's herbalist (E by them, at home): their potions, to
// buy; potions and raw ingredients the hero has, to sell them, said at the
// foot of the window (the window: tradePanel.ts; their shop:
// herbalist/herbalistShop.ts). They greet a hero hurt, spent, or without a
// potion to their name with a word on it.

import type { GameModel } from '../../model/GameModel';
import type { Npc } from '../../model/npcs/npcs';
import { POTIONS, isPotion, potionText } from '../../model/loot/potions';
import { LOOT } from '../../model/loot/loot';
import { HERBALIST_WARES, buyFromHerbalist, herbalistBuys, herbalistPrice, herbalistShopAt, sellToHerbalist } from '../../model/herbalist/herbalistShop';
import { kindOf, type BagItem } from '../../model/hero/bag';
import { maxEnergyOf, maxHpOf } from '../../model/hero/attributes';
import { isFish } from '../../model/skills/fishing';
import type { Hero } from '../../model/types';
import { oneOf } from '../../util/random';
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
// Their own word on opening, by how the hero looks: hurt, spent, or off out there with nothing to drink (half the time:
// not every visit a lecture); null, nothing to say of it (one of their hellos, then). `roll`: 0..1.
const HURT = ["You're bleeding on my floor. Drink a red one before you fall over.", "Sit down before you fall down. Then buy something red.", "Who did that to you? Never mind. Red, and quick."];
const SPENT = ["You look dead on your feet. A blue one'll keep you going.", "Grey as ash, you are. Something blue, I think.", "You're swaying. Blue, before you go back out."];
const DRY = ["Nothing to drink in that bag of yours? That's how people end up in the crypt.", 'Going out there with no potions? Brave. Or stupid. Buy a red one.', "Not a flask on you. The draugr will like that."];
export function herbalistGreets(hero: Hero, roll = Math.random()): string | null {
  if (hero.hp < maxHpOf(hero) * 0.4) return oneOf(HURT, roll);
  if (hero.energy < maxEnergyOf(hero) * 0.25) return oneOf(SPENT, roll);
  if (roll < 0.5 && !(Object.keys(hero.bag) as BagItem[]).some((id) => isPotion(id) && (hero.bag[id] ?? 0) > 0)) return oneOf(DRY, roll * 2);
  return null;
}

// Their word on what the hero's sold them: one of their own potions back; a fish; the rest from the wild (meat, a comb).
export function herbalistTakes(name: string, id: BagItem, roll = Math.random()): string {
  if (isPotion(id)) return oneOf(["One of mine, back unopened? Didn't need it after all. Lucky you.", "Back on the shelf it goes. I don't pay what I sell it for, mind.", 'Still corked. Good.'], roll);
  if (isFish(id)) return oneOf([`${name}? The oil's good for salves. Here.`, "Scales and all. I'll render it down for the ointments.", 'Fish oil for the burns. Good.'], roll);
  if ((id as string) === 'honeycomb') return 'Honeycomb! The wax for salves, the honey to hide the bitter ones.';
  return oneOf([`${name}? The fat's good for ointments.`, "I'll render it. Good fat makes a good salve.", `${name}? I can brew with that.`], roll);
}

// What they buy, said at the foot of their window.
const BUYS = "Buys back potions at half, and what's had from the wild: raw meat, honeycomb, any fish. Not wood or scrap.";

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
    about: () => pick([...ABOUT, ...LINES.bought]), // (a buy's word is always this: the bought lines among them, not left unsaid)
    greet: () => herbalistGreets(model.hero),
    offered: (name, id) => herbalistTakes(name, id),
    note: () => BUYS,
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
