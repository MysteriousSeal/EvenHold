// The orders at an inn's bar, first come first served: whoever sits at the
// bar (a villager, or the hero) and asks for a drink joins the queue; the
// barkeep takes the front one as soon as she's free (innStaff.ts), and
// hands it over to them (`served`). Kept per inn while the world runs.

import type { Entrance } from '../interiors/interiors';
import type { Furniture } from '../interiors/furniture';
import type { Drink, Npc } from '../npcs/npcs';
import { onShift } from '../jobs/shiftsAt';

export interface BarOrder {
  stool: Furniture; // where it goes
  by: Npc | null; // who's asking (null: the hero)
  drink: Drink; // what they asked for
  served(): void; // set down before them
  batch?: boolean; // the tables' (the hero at work: jobs/innShift.ts): poured together with the others queued, set down at once
}

const queues = new WeakMap<Entrance, BarOrder[]>();

// An inn's orders, the one being seen to (or next) first.
export function ordersAt(inn: Entrance): BarOrder[] {
  let queue = queues.get(inn);
  if (!queue) queues.set(inn, (queue = []));
  return queue;
}

// Adds an order to the end; returns how many are ahead of it.
export function placeOrder(inn: Entrance, order: BarOrder): number {
  const queue = ordersAt(inn);
  queue.push(order);
  return queue.length - 1;
}

// How many orders are ahead of `by`'s, or -1 if they've none waiting.
export function ordersAhead(inn: Entrance, by: Npc | null): number {
  return ordersAt(inn).findIndex((o) => o.by === by);
}

// The barkeep, idle between rounds, is called over at once (not in the middle of serving someone; nor on her break,
// the hero tending her bar: jobs/barShift.ts).
export function callBarkeep(barkeep: Npc | undefined): void {
  if (!barkeep || barkeep.serving || onShift(barkeep.home) === 'innBarkeep') return;
  Object.assign(barkeep, { steps: [], path: null, waited: 0, working: false, carrying: false });
}
