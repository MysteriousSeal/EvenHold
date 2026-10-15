// Ordering at the bar, sat on a stool: an ale (F) or a meat pie (G); or sat at
// one of the inn's tables, the server (else the barmaid) called over for it,
// and it's brought to them. The barmaid calls that she's coming, fetches it from her stock (inn/tavernShop.ts),
// at her price, and the hero has it there over its time (ALE_SECONDS, PIE_SECONDS): an ale gives back
// 60% of their most energy as it's sipped (ALE_ENERGY), a pie 60% of their
// most health as it's eaten (PIE_HEALS); she says a word either way. Sold
// out, she says when there's more; too poor, she says so. One table (MENU)
// for both: the same steps, their own words.

import type { GameModel } from '../../model/GameModel';
import { buyPrice, buyToHave, restockIn, shopAt, type Shop } from '../../model/inn/tavernShop';
import type { Npc } from '../../model/npcs/npcs';
import type { Entrance } from '../../model/interiors/interiors';
import { setMug, takeMug } from '../../model/inn/barMugs';
import { callBarkeep, ordersAt, placeOrder, type BarOrder } from '../../model/inn/barOrders';
import { comeToTable, passStool, serveTable } from '../../model/inn/innStaff';
import { onShift } from '../../model/jobs/shiftsAt';
import { distanceTo, type Furniture } from '../../model/interiors/furniture';
import { startDrinking } from '../../model/hero/heroStats';
import type { ProvisionId } from '../../model/loot/provisions';

import { ALE_ENERGY, ALE_SECONDS, PIE_HEALS, PIE_SECONDS } from '../../model/inn/barPatrons';
import { maxEnergyOf, maxHpOf } from '../../model/hero/attributes';
import type { Hero } from '../../model/types';
import { clock } from './tradePanel';
import { inTurn } from '../../model/npcs/speech';
import { doorNumber } from '../../model/interiors/interiors';

// One of her lines, each list's in turn (never the same one twice running).
const pick = (lines: readonly string[]): string => inTurn(lines, lines);

// What the hero can order at the bar.
export type BarMenuItem = 'ale' | 'pie';

interface OnTheMenu {
  item: ProvisionId; // from her stock
  name: string; // "an ale"
  outOf: string; // the prompt, sold out: "Out of ale"
  seconds: number; // how long it's had over (sipped, eaten)
  gives(hero: Hero): { heal?: number; energy?: number }; // over its `seconds`
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
    seconds: ALE_SECONDS,
    gives: (hero) => ({ energy: maxEnergyOf(hero) * ALE_ENERGY }), // a sit-down ale: much of their energy back as it's sipped
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
    seconds: PIE_SECONDS,
    gives: (hero) => ({ heal: maxHpOf(hero) * PIE_HEALS }), // a hot meal: much of their health back as it's eaten
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
const shopHere = (model: GameModel): Shop => shopAt(model.shops, model.seed, doorNumber(model.inside!.entrance));

// Whether the hero's sat on a stool at the bar (where F and G order).
export const atTheBar = (model: GameModel) => model.inside?.seated?.seat.piece.kind === 'barStool';

// The inn's table the hero's sat at (in one of its chairs, downstairs), where F and G call for the server; else null.
export function tableHere(model: GameModel): Furniture | null {
  const { inside } = model;
  const chair = inside?.seated?.seat.piece;
  if (!inside || inside.below || inside.entrance.type !== 'inn' || chair?.kind !== 'chair') return null;
  return inside.furniture.find((f) => f.kind === 'tavernTable' && distanceTo(f, chair.x, chair.z) <= 1) ?? null;
}

// Whether the hero's sat where F and G order: at the bar, or at a table.
export const atOrderSeat = (model: GameModel): boolean => atTheBar(model) || !!tableHere(model);

// Who comes to the hero's table: the inn's server, on her feet (not on her break), else the barmaid.
const waiterHere = (model: GameModel): Npc | null =>
  model.folk.find((n) => n.role === 'server' && n.where === model.inside?.entrance && onShift(n.home) !== 'innServer' && !n.resting) ?? barmaidHere(model);

// The inn's barmaid, wherever she is in it (she's the one who serves); else null.
export const barmaidHere = (model: GameModel): Npc | null => model.folk.find((n) => n.role === 'barkeep' && n.where === model.inside?.entrance) ?? null;

// What its prompt says: the order and its price, or when she'll have more.
export function orderLabel(model: GameModel, what: BarMenuItem = 'ale'): { label: string; soldOut: boolean } {
  if (!barmaidHere(model)) return { label: 'No one behind the bar', soldOut: true };
  const shop = shopHere(model);
  const { item, name, outOf } = MENU[what];
  if ((shop.stock[item] ?? 0) <= 0) return { label: `${outOf} · back in ${clock(restockIn(shop))}`, soldOut: true };
  return { label: `${tableHere(model) ? 'Call for' : 'Order'} ${name} · ${buyPrice(item)} copper`, soldOut: false }; // (at a table: the server called over)
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
  const { item, soldOut, tooPoor, served, gives, seconds } = MENU[what];
  const result = buyToHave(shop, model.hero, item); // (not carried off: had there, its good coming back as it goes; no room in the bag wanted)
  if (result === 'sold out') return { said: soldOut(clock(restockIn(shop))), drank: false };
  if (result === 'too poor') return { said: pick(tooPoor), drank: false };
  startDrinking(model.hero, seconds, gives(model.hero));
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

// Her word as the hero sits down at her bar (free to call over: not seeing to someone).
const GREETS = [
  "What'll it be, love? Ale's cold, pies are hot.",
  'Sit yourself down. Ale, or a pie?',
  'Back again, {name}? What are you having?',
  'You look like you need a drink, {name}.',
  'Pull up a stool, love. What can I get you?',
  'Hungry or thirsty? Or both, by the look of you.',
  "Don't mind the stains on the bar, love. What'll you have?",
];

const SET_DOWN = 0.8; // seconds played (the game's own: none while it's paused), the full tankard before the hero picks it up
const MINUTES_A_SECOND = 1; // the game's clock (GameModel.minutes): a minute to each second played

// The bar, from the order to the empty mug: F calls her over; she fetches
// the ale (innStaff.ts pourFor) and sets it down full before the stool; a
// moment later the hero pays and has it over its time (the countdown
// over their head), then puts the empty mug down on the bar, where it stays
// till she clears it. Getting up mid-drink stops it (the rest of its good
// lost), the mug put down empty all the same; getting up still waiting on it
// calls the order off (out of her queue: never handed to them on another
// seat, or in another inn). At a table, the same, but the server (else the
// barmaid) comes over to take it, it's poured with the tables' (set down at
// the counter's end), and she carries it to them; the empty she takes away.
export function createBar(model: GameModel, view: BarView) {
  let coming: BarOrder | null = null; // the order being seen to (from the call to its being set down before them)
  let what: BarMenuItem = 'ale'; // what was ordered
  let inn: Entrance | null = null; // where it's being had
  let seat: Furniture | null = null; // and the seat it's for (a stool: its row, where it sits on the bar; or a chair)
  let table: { at: Furniture; waiter: Npc } | null = null; // at a table: it, and who waits on it
  let carry: (() => void) | null = null; // poured for a table: to be carried over (next frame, not amid the barkeep's own step)
  let pickUp: { at: number; then: () => void } | null = null; // set down before them: picked up at the game's minute `at`
  let wasDrinking = false;
  let sat: Furniture | null = null; // the stool the hero's on (greeted as they sit down on it)
  // Whether the hero's sat on the seat it was ordered from still.
  const onSeat = () => !!seat && model.inside?.entrance === inn && model.inside.seated?.seat.piece === seat;

  // Set down before them (`by`: her, with her word): a moment on, paid for and had, if they're sat there still.
  const setDown = (order: BarOrder, by: Npc, wanted: BarMenuItem, left?: () => void) => {
    view.speak(by, pick(MENU[wanted].served));
    pickUp = {
      at: model.minutes + SET_DOWN * MINUTES_A_SECOND,
      then: () => {
        if (coming !== order) return; // up before picking it up: it's left there
        coming = null;
        if (!onSeat()) return;
        const { said, drank } = serveOrder(model, wanted); // paid for as it's picked up
        if (!drank) return view.speak(by, said); // (the coin gone meanwhile, say)
        left?.(); // picked up
        view.heroDrinks(MENU[wanted].seconds, wanted);
      },
    };
  };

  return {
    // Whether she's seeing to an order (from her call to the ale set down): not to be talked to meanwhile.
    get busy(): boolean {
      return !!coming;
    },

    // Waiting in the queue behind others: how many are ahead (0: it's being seen to, or none's placed).
    get ahead(): number {
      return coming && inn ? Math.max(0, ordersAt(inn).indexOf(coming)) : 0;
    },

    // Whether F can order now (sat at the bar or a table; not while she's fetching one, nor while one's being drunk).
    get canOrder(): boolean {
      return atOrderSeat(model) && !coming && !model.hero.drinking;
    },

    order(barmaid: Npc, wanted: BarMenuItem = 'ale'): void {
      if (coming || model.hero.drinking) return;
      const piece = model.inside?.seated?.seat.piece;
      const at = tableHere(model);
      const waiter = at ? waiterHere(model) ?? barmaid : barmaid;
      const call = callFor(model, wanted);
      if (!call.coming || !piece || !model.inside) return view.speak(waiter, call.said); // why not
      [inn, seat, what, table, carry, pickUp] = [model.inside.entrance, piece, wanted, at && { at, waiter }, null, null];
      const here = inn;
      if (at) {
        // At a table: she's called over, takes it there, and it's poured with the tables' (set down at the counter's
        // end); then she carries it to them.
        const counter = model.inside.furniture.find((f) => f.kind === 'counter');
        if (!counter) return;
        const order: BarOrder = { stool: passStool(counter), by: null, drink: wanted, batch: true, served: () => void (coming === order && (carry = () => serveTable(waiter, at, wanted, () => coming === order && setDown(order, waiter, wanted), model.seed))) };
        coming = order;
        view.speak(waiter, call.said);
        comeToTable(waiter, at, () => coming === order && (placeOrder(here, order), callBarkeep(barmaid)), model.seed);
        return;
      }
      const order: BarOrder = { stool: piece, by: null, drink: wanted, served: () => served() };
      coming = order;
      // In the queue, first come first served: told if there's a wait.
      const ahead = placeOrder(here, order);
      view.speak(barmaid, ahead > 0 ? waitLine(ahead, !!barmaid.serving) : call.said);
      callBarkeep(barmaid);
      const served = () => {
        if (coming !== order) return; // called off meanwhile: nothing
        setMug(here, piece.z, true, 3, wanted); // set down before them, full, with her word
        setDown(order, barmaid, wanted, () => takeMug(here, piece.z));
      };
    },

    // Each frame: her word as they sit down, a table's order carried over, one set down picked up, getting up
    // mid-drink, finishing, the countdown.
    update(): void {
      const { hero } = model;
      const stool = atTheBar(model) && !model.work.shift ? model.inside!.seated!.seat.piece : null;
      const barmaid = stool && stool !== sat && !coming && !hero.drinking ? barmaidHere(model) : null;
      if (barmaid && !barmaid.serving) view.speak(barmaid, pick(GREETS).replace('{name}', hero.name));
      sat = stool;
      if (coming && !onSeat()) {
        const queue = ordersAt(inn!); // got up still waiting: called off (she lets it be, if she's pouring it already)
        if (queue.includes(coming)) queue.splice(queue.indexOf(coming), 1);
        coming = null;
      }
      const [carried, picked] = [carry, pickUp && model.minutes >= pickUp.at ? pickUp : null];
      if (carried) {
        carry = null;
        carried();
      }
      if (picked) {
        pickUp = null;
        picked.then();
      }
      if (hero.drinking && !onSeat()) {
        hero.drinking = null; // stopped: the rest isn't drunk
        view.heroStopsDrinking();
      }
      if (!hero.drinking && wasDrinking && inn && seat && !table) setMug(inn, seat.z, false, 3, what); // done (or stopped): the empty mug (or plate) put down on the bar (at a table: taken away)
      wasDrinking = !!hero.drinking;
      view.countdown(hero.drinking ?? null, hero);
    },
  };
}
