// Ordering an ale, sat on a stool at the bar (F): the barmaid calls that
// she's coming, fetches one from her stock (inn/tavernShop.ts), at her
// price, and the hero sips it there over ALE_SECONDS, its good coming back
// as they do; she says a word either way. Sold out, she says when the next
// barrel's up; too poor, she says so.

import type { GameModel } from '../model/GameModel';
import { buy, buyPrice, restockIn, shopAt, type Shop } from '../model/inn/tavernShop';
import type { Npc } from '../model/npcs/npcs';
import type { Entrance } from '../model/interiors/interiors';
import { setMug, takeMug } from '../model/inn/barMugs';
import { callBarkeep, ordersAhead, placeOrder } from '../model/inn/barOrders';
import { takeFromBag } from '../model/hero/bag';
import { startDrinking } from '../model/hero/heroStats';
import { PROVISIONS } from '../model/loot/provisions';

export { ALE_SECONDS } from '../model/inn/barPatrons';
import { ALE_SECONDS } from '../model/inn/barPatrons';

const POURED = [
  "Here's your ale, love.",
  'One ale, frothing over.',
  "Drink up, it's a cold night out there.",
  'Fresh from the cellar. Mind the foam.',
  "On its way. Don't spill it on the floor, it's new.",
  "There. Best in the valley, whatever the other inns say.",
  'Poured it myself. Well, I pour them all.',
  "Get that down you, you'll feel a new soul.",
]
const COMING = [
  'Coming, love!',
  "One moment, I'll be right with you.",
  'Just a tick, pouring it now.',
  "Ale for you? On its way!",
  'Right you are, one ale.',
  "Keep your seat, I'll bring it over.",
  'Say no more, love.',
  "An ale it is. Don't go anywhere.",
]
const TOO_POOR = [
  "That's not enough coin for an ale, love.",
  'Short a copper or two there.',
  "I don't pour on a promise, love.",
  'Come back when your purse jingles.',
  "Coin first, ale after. That's the way of it.",
  "Not even the price of the foam, love.",
  "The keg's full, it's your purse that's empty.",
  "No slates here, I'm afraid. Find a few coppers.",
]
const pick = (lines: readonly string[]) => lines[Math.floor(Math.random() * lines.length)];
const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// The barmaid's shop, where the hero is (in her inn).
const shopHere = (model: GameModel): Shop => shopAt(model.shops, model.seed, model.entrances.indexOf(model.inside!.entrance));

// Whether the hero's sat on a stool at the bar (where F orders).
export const atTheBar = (model: GameModel) => model.inside?.seated?.seat.piece.kind === 'barStool';

// The inn's barmaid, wherever she is in it (she's the one who pours); else null.
export const barmaidHere = (model: GameModel): Npc | null => model.npcs.find((n) => n.role === 'barkeep' && n.where === model.inside?.entrance) ?? null;

// What the prompt says: the order and its price, or when she'll have more.
export function orderLabel(model: GameModel): { label: string; soldOut: boolean } {
  if (!barmaidHere(model)) return { label: 'No one behind the bar', soldOut: true };
  const shop = shopHere(model);
  if ((shop.stock.ale ?? 0) <= 0) return { label: `Out of ale · back in ${clock(restockIn(shop))}`, soldOut: true };
  return { label: `Order an ale · ${buyPrice('ale')} copper`, soldOut: false };
}

// F pressed: what she calls back straight away (coming, or why not), and
// whether she's coming (then orderAle pours it a moment later).
export function callForAle(model: GameModel): { said: string; coming: boolean } {
  const shop = shopHere(model);
  if ((shop.stock.ale ?? 0) <= 0) return { said: `The barrel's dry, love. Back in ${clock(restockIn(shop))}.`, coming: false };
  if (model.hero.money < buyPrice('ale')) return { said: pick(TOO_POOR), coming: false };
  return { said: pick(COMING), coming: true };
}

// Orders one: returns what she says, and whether the hero drank.
export function orderAle(model: GameModel): { said: string; drank: boolean } {
  const shop = shopHere(model);
  const result = buy(shop, model.hero, 'ale');
  if (result === 'sold out') return { said: `The barrel's dry, love. Back in ${clock(restockIn(shop))}.`, drank: false };
  if (result === 'too poor') return { said: pick(TOO_POOR), drank: false };
  takeFromBag(model.hero.bag, 'ale'); // not carried off: sipped there, its health coming back as it goes
  startDrinking(model.hero, PROVISIONS.ale.heal, ALE_SECONDS);
  return { said: pick(POURED), drank: true };
}

// What the bar needs from the view: the hero's tankard, speech over the
// barmaid, and the countdown over the hero. (The drinks on the bar are the
// inn's own, in the model: inn/barMugs.ts.)
export interface BarView {
  heroDrinks(seconds: number): void;
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
  let coming = false; // she's on her way with an ale
  let inn: Entrance | null = null; // where the ale's being drunk
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

    order(barmaid: Npc): void {
      if (coming || model.hero.drinking) return;
      const stool = model.inside?.seated?.seat.piece;
      const call = callForAle(model);
      if (!call.coming || !stool || !model.inside) return view.speak(barmaid, call.said); // why not
      coming = true;
      [inn, at] = [model.inside.entrance, stool.z];
      const here = inn;
      // In the queue, first come first served: told if there's a wait.
      const ahead = placeOrder(here, { stool, by: null, drink: 'ale', served: () => served() });
      view.speak(barmaid, ahead > 0 ? waitLine(ahead, !!barmaid.serving) : call.said);
      callBarkeep(barmaid);
      const served = () => {
        if (!atTheBar(model)) return void (coming = false); // got up meanwhile: no ale
        setMug(here, stool.z, true); // set down before them, full, with her word
        view.speak(barmaid, pick(POURED));
        window.setTimeout(() => {
          coming = false;
          if (!atTheBar(model)) return; // up before picking it up: it's left there
          const { said, drank } = orderAle(model); // paid for as it's picked up
          if (!drank) return view.speak(barmaid, said); // (the coin gone meanwhile, say)
          takeMug(here, stool.z); // picked up
          view.heroDrinks(ALE_SECONDS);
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
      if (!hero.drinking && wasDrinking && inn) setMug(inn, at, false); // done (or stopped): the empty mug put down on the bar
      wasDrinking = !!hero.drinking;
      view.countdown(hero.drinking ?? null, hero);
    },
  };
}
