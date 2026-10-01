// Villagers sat at an inn's bar, drinking like the hero does: on sitting
// they order an ale, or now and then a glass of wine (barOrders.ts, first
// come first served), and wait for it; the barkeep sets it down full before
// them; a moment later they pick it up (thanking her) and sip it over
// ALE_SECONDS, then put the empty cup down; staying a while yet, now and
// then they order another. Their stay at the bar only
// counts once served, and they never get up mid-drink or still waiting.

import { hashUnit } from '../../util/random';
import type { Furniture } from '../interiors/furniture';
import { setMug, takeMug } from './barMugs';
import { callBarkeep, placeOrder } from './barOrders';
import { say } from '../npcs/speech';
import type { Drink, Npc } from '../npcs/npcs';

export const ALE_SECONDS = 15; // an ale at the bar, sipped over this long (the hero's too)
export const PIE_SECONDS = 15; // a meat pie at the bar, eaten over this long
export const ALE_ENERGY = 0.6; // of the hero's most energy: what an ale at the bar gives back, over its ALE_SECONDS
export const PIE_HEALS = 0.6; // of the hero's most health: what a meat pie at the bar gives back, over its PIE_SECONDS
const PICKUP = 0.8; // seconds it stands before them, full, before they pick it up
const AGAIN = 0.4; // of ordering another, with time enough left to drink it
const WINE = 0.25; // of asking for a glass of wine, not an ale
// Their thanks, picking it up (by her name, often).
const THANKS_NAMED = ['Thanks, {name}.', "You're a treasure, {name}.", 'Cheers, {name}!', "{name}, you've saved my life."];
const THANKS = ['Thank you kindly.', 'Much obliged.', "Ah, that's the stuff.", 'Bless you, love.'];
const pick = (lines: readonly string[], n: number) => lines[Math.floor(hashUnit(n, lines.length, 43) * lines.length)];

// The inn's barkeep.
const barkeepOf = (npcs: readonly Npc[], inn: Npc['where']) => npcs.find((n) => n.role === 'barkeep' && n.home === inn);

// Asks for a drink (an ale, or now and then a glass of wine): in the
// queue, the barkeep called over if she's free.
function order(npc: Npc, npcs: readonly Npc[], stool: Furniture): void {
  const inn = npc.where!;
  npc.awaiting = true;
  const drink: Drink = hashUnit(npc.id, npc.stop * 7 + (npc.drinks ?? 0), 47) < WINE ? 'wine' : 'ale';
  placeOrder(inn, {
    stool,
    by: npc,
    drink,
    served: () => {
      setMug(inn, stool.z, true, 3, drink); // set down before them, full
      npc.awaiting = false;
      npc.pickup = PICKUP;
    },
  });
  callBarkeep(barkeepOf(npcs, inn));
}

// Just sat down at the bar: an ale ordered.
export function sitAtBar(npc: Npc, npcs: readonly Npc[], stool: Furniture): void {
  npc.drinks = 0;
  order(npc, npcs, stool);
}

// A moment sat at the bar: picking up the ale set down, sipping it, the
// empty mug put down (and maybe another ordered, with `stayLeft` seconds of
// their stay to go). Returns whether their stay counts on (not while waiting).
export function atBar(npc: Npc, npcs: readonly Npc[], stool: Furniture, dt: number, stayLeft: number): boolean {
  if (npc.awaiting) return false;
  const inn = npc.where!;
  if ((npc.pickup ?? 0) > 0) {
    npc.pickup! -= dt;
    if (npc.pickup! <= 0) {
      const drink = takeMug(inn, stool.z)?.drink ?? 'ale'; // picked up, with thanks
      const barkeep = barkeepOf(npcs, inn);
      const n = npc.id * 7 + (npc.drinks ?? 0);
      say(npc, barkeep && hashUnit(n, 1, 41) < 0.5 ? pick(THANKS_NAMED, n).replace('{name}', barkeep.name) : pick(THANKS, n));
      npc.drinking = { left: ALE_SECONDS, seconds: ALE_SECONDS, drink };
    }
    return true;
  }
  const drink = npc.drinking;
  if (drink) {
    drink.left -= dt;
    if (drink.left > 0) return true;
    npc.drinking = null;
    npc.drinks = (npc.drinks ?? 0) + 1;
    setMug(inn, stool.z, false, 2 + Math.floor(hashUnit(npc.id, npc.drinks, 19) * 3), drink.drink); // the empty cup put down, cleared a few of her rounds on
    if (stayLeft > ALE_SECONDS + 5 && hashUnit(npc.id, npc.stop * 7 + npc.drinks, 23) < AGAIN) order(npc, npcs, stool); // another
  }
  return true;
}

// Whether they're tied to the bar: waiting on an ale, or not done with it.
export const busyAtBar = (npc: Npc): boolean => !!npc.awaiting || (npc.pickup ?? 0) > 0 || !!npc.drinking;
