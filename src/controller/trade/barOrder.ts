// Ordering at the bar, sat on a stool: an ale (F) or a meat pie (G). The
// barmaid calls that she's coming, fetches it from her stock (inn/tavernShop.ts),
// at her price, and the hero has it there over ALE_SECONDS: an ale gives back
// 60% of their most health as it's sipped (ALE_HEALS), a pie 60% of their
// most energy as it's eaten (PIE_ENERGY); she says a word either way. Sold
// out, she says when there's more; too poor, she says so. One table (MENU)
// for both: the same steps, their own words.

import type { GameModel } from '../../model/GameModel';
import { buy, buyPrice, restockIn, shopAt, type Shop } from '../../model/inn/tavernShop';
import type { Npc } from '../../model/npcs/npcs';
import type { Entrance } from '../../model/interiors/interiors';
import { setMug, takeMug } from '../../model/inn/barMugs';
import { callBarkeep, ordersAhead, placeOrder } from '../../model/inn/barOrders';
import { takeFromBag } from '../../model/hero/bag';
import { startDrinking } from '../../model/hero/heroStats';
import type { ProvisionId } from '../../model/loot/provisions';

export { ALE_SECONDS } from '../../model/inn/barPatrons';
import { ALE_HEALS, ALE_SECONDS, PIE_ENERGY } from '../../model/inn/barPatrons';
import { maxEnergyOf, maxHpOf } from '../../model/hero/attributes';
import type { Hero } from '../../model/types';
import { clock, pick } from './tradePanel';

// What the hero can order at the bar.
export type BarMenuItem = 'ale' | 'pie';

interface OnTheMenu {
  item: ProvisionId; // from her stock
  name: string; // "an ale"
  outOf: string; // the prompt, sold out: "Out of ale"
  gives(hero: Hero): { heal?: number; energy?: number }; // over ALE_SECONDS
  soldOut(back: string): string; // her word, sold out
  coming: readonly string[]; // her word, on her way
  served: readonly string[]; // and setting it down
  tooPoor: readonly string[]; // and when they can't pay
}

export const MENU: Record<BarMenuItem, OnTheMenu> = {
  ale: {
    item: 'ale',
    name: 'an ale',
    outOf: 'Out of ale',
    gives: (hero) => ({ heal: maxHpOf(hero) * ALE_HEALS }), // a sit-down ale: much of their health back as it's sipped
    soldOut: (back) => `The barrel's dry, love. Back in ${back}.`,
    coming: [
      'Coming, love!',
      "One moment, I'll be right with you.",
      'Just a tick, pouring it now.',
      "Ale for you? On its way!",
      'Right you are, one ale.',
      "Keep your seat, I'll bring it over.",
      'Say no more, love.',
      "An ale it is. Don't go anywhere.",
    ],
    served: [
      "Here's your ale, love.",
      'One ale, frothing over.',
      "Drink up, it's a cold night out there.",
      'Fresh from the cellar. Mind the foam.',
      "On its way. Don't spill it on the floor, it's new.",
      "There. Best in the valley, whatever the other inns say.",
      'Poured it myself. Well, I pour them all.',
      "Get that down you, you'll feel a new soul.",
    ],
    tooPoor: [
      "That's not enough coin for an ale, love.",
      'Short a copper or two there.',
      "I don't pour on a promise, love.",
      'Come back when your purse jingles.',
      "Coin first, ale after. That's the way of it.",
      "Not even the price of the foam, love.",
      "The keg's full, it's your purse that's empty.",
      "No slates here, I'm afraid. Find a few coppers.",
    ],
  },
  pie: {
    item: 'meatPie',
    name: 'a meat pie',
    outOf: 'Out of meat pies',
    gives: (hero) => ({ energy: maxEnergyOf(hero) * PIE_ENERGY }), // a hot meal: much of their energy back as it's eaten
    soldOut: (back) => `Not a pie left, love. The next batch is out in ${back}.`,
    coming: [
      'A pie? Coming right up!',
      "One meat pie, I'll fetch it now.",
      'Hungry, are we? One moment.',
      "Right you are, love. Mind, it's hot.",
      'A pie it is. Keep your seat.',
    ],
    served: [
      'Here you are, straight from the oven.',
      "One meat pie. Careful, it's hot!",
      'Get that in you, love. Puts a spring in your step.',
      "There. Best pie in the valley, and I'll hear no different.",
      'Eat up, you look worn to the bone.',
    ],
    tooPoor: [
      "That's not enough for a pie, love.",
      "Pies cost coin, I'm afraid.",
      'Short a few coppers for that one.',
      'No coin, no crust, love.',
    ],
  },
};

// The barmaid's shop, where the hero is (in her inn).
const shopHere = (model: GameModel): Shop => shopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));

// Whether the hero's sat on a stool at the bar (where F and G order).
export const atTheBar = (model: GameModel) => model.inside?.seated?.seat.piece.kind === 'barStool';

// The inn's barmaid, wherever she is in it (she's the one who serves); else null.
export const barmaidHere = (model: GameModel): Npc | null => model.npcs.find((n) => n.role === 'barkeep' && n.where === model.inside?.entrance) ?? null;

// What its prompt says: the order and its price, or when she'll have more.
export function orderLabel(model: GameModel, what: BarMenuItem = 'ale'): { label: string; soldOut: boolean } {
  if (!barmaidHere(model)) return { label: 'No one behind the bar', soldOut: true };
  const shop = shopHere(model);
  const { item, name, outOf } = MENU[what];
  if ((shop.stock[item] ?? 0) <= 0) return { label: `${outOf} · back in ${clock(restockIn(shop))}`, soldOut: true };
  return { label: `Order ${name} · ${buyPrice(item)} copper`, soldOut: false };
}

// F or G pressed: what she calls back straight away (coming, or why not), and
// whether she's coming (then serveOrder hands it over a moment later).
export function callFor(model: GameModel, what: BarMenuItem = 'ale'): { said: string; coming: boolean } {
  const shop = shopHere(model);
  const { item, soldOut, tooPoor, coming } = MENU[what];
  if ((shop.stock[item] ?? 0) <= 0) return { said: soldOut(clock(restockIn(shop))), coming: false };
  if (model.hero.money < buyPrice(item)) return { said: pick(tooPoor), coming: false };
  return { said: pick(coming), coming: true };
}

// Serves one (paid for as it's picked up): returns what she says, and whether the hero has it.
export function serveOrder(model: GameModel, what: BarMenuItem = 'ale'): { said: string; drank: boolean } {
  const shop = shopHere(model);
  const { item, soldOut, tooPoor, served, gives } = MENU[what];
  const result = buy(shop, model.hero, item);
  if (result === 'sold out') return { said: soldOut(clock(restockIn(shop))), drank: false };
  if (result === 'too poor') return { said: pick(tooPoor), drank: false };
  takeFromBag(model.hero.bag, item); // not carried off: had there, its good coming back as it goes
  startDrinking(model.hero, ALE_SECONDS, gives(model.hero));
  return { said: pick(served), drank: true };
}

// What the bar needs from the view: the hero's tankard, speech over the
// barmaid, and the countdown over the hero. (The drinks on the bar are the
// inn's own, in the model: inn/barMugs.ts.)
export interface BarView {
  heroDrinks(seconds: number, what: BarMenuItem): void;
  heroStopsDrinking(): void;
  speak(barmaid: Npc, text: string): void;
  countdown(drinking: GameModel['hero']['drinking'], hero: GameModel['hero']): void;
}

// Her word when there's a wait: `ahead` orders before the hero's, the first
// of them the one she's already fetching if she's `serving`.
function waitLine(ahead: number, serving: boolean): string {
  if (!serving) return `After ${ahead === 1 ? 'this one' : `these ${ahead}`}, love.`;
  const more = ahead - 1; // besides the one she's on
  return more === 0 ? 'Right after this one, love.' : `After this one and ${more === 1 ? 'one more' : `${more} more`}, love.`;
}

const SET_DOWN_MS = 800; // the full tankard on the bar before the hero picks it up

// The bar, from the order to the empty mug: F calls her over; she fetches
// the ale (innStaff.ts pourFor) and sets it down full before the stool; a
// moment later the hero pays and sips it over ALE_SECONDS (the countdown
// over their head), then puts the empty mug down on the bar, where it stays
// till she clears it. Getting up mid-drink stops it (the rest of its good
// lost), the mug put down empty all the same.
export function createBar(model: GameModel, view: BarView) {
  let coming = false; // she's on her way with an order
  let what: BarMenuItem = 'ale'; // what was ordered
  let inn: Entrance | null = null; // where it's being had
  let at = 0; // and the stool's row, where it sits on the bar
  let wasDrinking = false;

  return {
    // Whether she's seeing to an order (from her call to the ale set down): not to be talked to meanwhile.
    get busy(): boolean {
      return coming;
    },

    // Waiting in the queue behind others: how many are ahead (0: it's being seen to, or none's placed).
    get ahead(): number {
      return coming && model.inside ? Math.max(0, ordersAhead(model.inside.entrance, null)) : 0;
    },

    // Whether F can order now (not while she's fetching one, nor while one's being drunk).
    get canOrder(): boolean {
      return atTheBar(model) && !coming && !model.hero.drinking;
    },

    order(barmaid: Npc, wanted: BarMenuItem = 'ale'): void {
      if (coming || model.hero.drinking) return;
      const stool = model.inside?.seated?.seat.piece;
      const call = callFor(model, wanted);
      if (!call.coming || !stool || !model.inside) return view.speak(barmaid, call.said); // why not
      coming = true;
      [inn, at, what] = [model.inside.entrance, stool.z, wanted];
      const here = inn;
      // In the queue, first come first served: told if there's a wait.
      const ahead = placeOrder(here, { stool, by: null, drink: wanted, served: () => served() });
      view.speak(barmaid, ahead > 0 ? waitLine(ahead, !!barmaid.serving) : call.said);
      callBarkeep(barmaid);
      const served = () => {
        if (!atTheBar(model)) return void (coming = false); // got up meanwhile: nothing
        setMug(here, stool.z, true, 3, wanted); // set down before them, full, with her word
        view.speak(barmaid, pick(MENU[wanted].served));
        window.setTimeout(() => {
          coming = false;
          if (!atTheBar(model)) return; // up before picking it up: it's left there
          const { said, drank } = serveOrder(model, wanted); // paid for as it's picked up
          if (!drank) return view.speak(barmaid, said); // (the coin gone meanwhile, say)
          takeMug(here, stool.z); // picked up
          view.heroDrinks(ALE_SECONDS, wanted);
        }, SET_DOWN_MS);
      };
    },

    // Each frame: getting up mid-drink, finishing, the countdown.
    update(): void {
      const { hero } = model;
      if (hero.drinking && !atTheBar(model)) {
        hero.drinking = null; // stopped: the rest isn't drunk
        view.heroStopsDrinking();
      }
      if (!hero.drinking && wasDrinking && inn) setMug(inn, at, false, 3, what); // done (or stopped): the empty mug (or plate) put down on the bar
      wasDrinking = !!hero.drinking;
      view.countdown(hero.drinking ?? null, hero);
    },
  };
}
