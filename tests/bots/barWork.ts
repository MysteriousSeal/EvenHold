// How a bot works the bar (model/jobs/barShift.ts), as a player would: a pour stopped at the line; E only where it
// helps (no pouring what no one's waiting for); else the next errand: a drink in hand to whoever's waiting on it (a
// patron across the bar, a ticket at the pass), a drink wanted poured, the empties washed once the cups run low or the
// hands are full of them, empties gathered, else by the tap.

import { mugsAt } from '../../src/model/inn/barMugs';
import { AT_KEG } from '../../src/model/inn/innStaff';

const AISLE_X = AT_KEG.x; // down the aisle by the tap's side of it (clear of the keg's corner, all the way)
import type { BarAction, BarShift } from '../../src/model/jobs/barShift';
import { LINE, type Pourable } from '../../src/model/jobs/pour';

// The drinks wanted and not yet in hand (the stools', the open tickets').
export function stillWanted(shift: BarShift): Pourable[] {
  const wanted = [...[...shift.wants.values()].map((w) => w.drink), ...shift.tickets.filter((t) => !t.done).flatMap((t) => t.drinks)];
  for (const h of shift.held) if (h.kind === 'drink' && wanted.includes(h.drink)) wanted.splice(wanted.indexOf(h.drink), 1);
  return wanted;
}

// Whether E's worth pressing for `action`: a pour stopped once it's at the line; a pour begun only of what's wanted.
export function worthIt(shift: BarShift, action: BarAction): boolean {
  if (action.kind === 'stop') return action.fill >= LINE - 0.01;
  if (action.kind === 'pour') return !action.dry && stillWanted(shift).includes(action.drink);
  return true;
}

// Where to go next behind the bar: in the aisle, the next errand; from the room, first to its mouth past the counter's
// end, then a step straight in (round the counter's end, not into it), then on.
export function barErrand(shift: BarShift, hero: { x: number; z: number }): { x: number; z: number } {
  const end = shift.pickupSpot; // (just past the counter's end)
  if (hero.x < end.x - 0.2 && hero.z < end.z - 0.4) return errand(shift); // (in the aisle)
  if (Math.abs(hero.x - AISLE_X) < 0.2 && hero.z < end.z + 0.6) return { x: AISLE_X, z: end.z - 0.7 }; // (at its mouth: in)
  return { x: AISLE_X, z: end.z + 0.1 };
}

// Out from behind the bar (its shift over), by the aisle's mouth (`end`: just past the counter's end): along the aisle's
// middle, then out past the end; null once out.
export function outOfAisle(end: { x: number; z: number }, hero: { x: number; z: number }): { x: number; z: number } | null {
  if (hero.x >= end.x - 0.2 || hero.z >= end.z + 0.2) return null;
  return Math.abs(hero.x - AISLE_X) > 0.12 ? { x: AISLE_X, z: hero.z } : { x: AISLE_X, z: end.z + 0.4 };
}

function errand(shift: BarShift): { x: number; z: number } {
  const { tap, sink, shelves } = shift.stations;
  const drinks = shift.held.filter((h) => h.kind === 'drink').map((h) => h.drink);
  const empties = shift.held.filter((h) => h.kind === 'empty').length;
  const room = shift.rank.tray - shift.held.length;
  const want = [...shift.wants.values()].filter((w) => drinks.includes(w.drink)).sort((a, b) => a.patience - b.patience)[0];
  if (want) return { x: AISLE_X, z: want.order.stool.z };
  if (drinks.some((d) => shift.tickets.some((t) => !t.done && t.drinks.includes(d)))) return { x: AISLE_X, z: shift.passZ };
  const next = stillWanted(shift)[0];
  if (sink && empties > 0 && (room === 0 || (next && shift.clean[next] === 0))) return sink;
  if (room > 0 && next && shift.clean[next] > 0) return next === 'ale' ? tap : shelves[0] ?? tap;
  const mug = mugsAt(shift.inn).find((m) => !m.full);
  if (room > 0 && mug) return { x: AISLE_X, z: mug.z };
  if (room > 0 && shift.passEmpties.length > 0) return { x: AISLE_X, z: shift.passZ };
  if (sink && empties > 0) return sink;
  return tap;
}
