// A shift serving an inn's tables (jobs.ts: innServer): for SHIFT seconds, the villagers sat at its tables call for
// something (an ale, a glass of wine, a meat pie); the hero takes their order (E by them); it goes to the barkeep's
// queue with the bar's other orders (the tables' all poured in one trip: inn/innStaff.ts), set down at the counter's end; the hero fetches it
// there (E: as many as their tray holds) and sets it down before whoever asked (E by them: theirs, off the tray,
// whatever else is on it). A wage for each, and a tip the
// more patience they had left (it runs out slower once their order's taken: they know it's coming); left waiting too long, they walk out. What they've had, they leave on the table,
// empty: cleared onto the tray (E by the table) and taken back to the counter's end (a copper each); a table left
// cluttered sours the next to sit at it. Patience, tray and tips grow with the hero's rank in the job. A shift's a busy
// hour: word's round that the tables are served, and the village's folk come in now and then for one (RUSH).

import { distanceTo, type Furniture } from '../interiors/furniture';
import type { Entrance } from '../interiors/interiors';
import type { Drink, Npc } from '../npcs/npcs';
import { say } from '../npcs/speech';
import { ALE_SECONDS } from '../inn/barPatrons';
import { callBarkeep, ordersAt, placeOrder, type BarOrder } from '../inn/barOrders';
import { REACH, Shift, WAGE } from './shift';
import type { JobRank } from './jobs';

const PATIENCE = 40; // seconds a patron waits, from calling to served (and the rank's more)
const CLUTTER = 10; // seconds less of it, sat at a table with empties left on it
const TAKEN = 0.4; // how fast patience runs out once the order's taken (they know it's coming), of how fast calling
const CALL_AFTER: [number, number] = [3, 12]; // seconds sat (or since their last) before they call
const TIP = 6; // copper, at most, for one set down at once (times the rank's tips)
const TIP_FLOOR = 1; // and at least, for one served at all
const CLEARED = 1; // copper an empty taken back
const RUSH: [number, number] = [6, 10]; // seconds between one of the village coming in for a table, and the next (shift.ts drawIn)
const MOST = 8; // patrons at the tables (sat or on their way), at most

export type Order = Drink;
const ORDERS: readonly Order[] = ['ale', 'ale', 'ale', 'wine', 'pie'];
export const ORDER_NAMES: Record<Order, string> = { ale: 'an ale', wine: 'a glass of wine', pie: 'a meat pie' };

// A patron's want, from calling to served: calling (not yet taken), ordered (with the barkeep: `ready` once she's
// set it down at the counter's end), carried (on the hero's tray).
export interface Want {
  npc: Npc;
  order: Order;
  state: 'calling' | 'ordered' | 'carried';
  patience: number; // seconds left
  of: number; // seconds they had
  ready: boolean;
  bar?: BarOrder; // its order at the bar, while the barkeep has it
}

// What's left on a table, had: an empty cup or plate, to clear away.
export interface Empty {
  table: Furniture;
  x: number; // where on it (by where they sat)
  z: number;
  drink: Order;
}

// On the tray: an order for someone, or an empty taken from a table.
export type TrayItem = { kind: 'order'; want: Want } | { kind: 'empty'; empty: Empty };

// What the hero's E would do now, in the shift (the prompt): a patron's order to take; theirs, off the tray, to set
// down before them; a table's empties to clear; at the counter's end, empties to give back and ready orders to take up.
export type ShiftAction =
  | { kind: 'take'; want: Want }
  | { kind: 'serve'; want: Want }
  | { kind: 'clear'; table: Furniture; empties: Empty[] }
  | { kind: 'counter'; returns: number; wants: Want[] };

const CALLS = ['Over here!', 'Service, please!', 'When you have a moment!', 'Excuse me!', "We're parched over here!"];
const THANKS = ['Lovely, thank you.', 'Just what I wanted.', "You're quick on your feet!", 'Bless you.', 'Keep the change.'];
const CLUTTERED = ['Could someone clear this table?', 'Whose are all these cups?', 'A clean table would be nice.'];

export class InnShift extends Shift {
  cleared = 0;
  readonly tray: TrayItem[] = [];
  readonly wants = new Map<Npc, Want>();
  readonly empties: Empty[] = []; // left on the tables
  private readonly callIn = new Map<Npc, number>(); // patrons sat, and seconds before they call
  private readonly gone = new Set<Npc>(); // those who walked out: no more calls from them this shift (on their way out)
  private readonly barEnd: Furniture; // where the barkeep sets the shift's orders down: the counter's very end (no stool's)
  private readonly tables: Furniture[];

  constructor(inn: Entrance, rank: JobRank, seed: number) {
    super('innServer', inn, rank, seed);
    this.tables = this.furniture.filter((f) => f.kind === 'tavernTable');
    // (half a tile short of it: past the last stool's row, so she never takes a patron's cup for the shift's)
    this.barEnd = { ...(this.counter ?? this.furniture[0]), kind: 'barStool', z: this.barEndZ } as Furniture;
  }

  // The orders the barkeep's set down at the counter's end, waiting to be fetched (drawn there).
  get readyOrders(): Order[] {
    return [...this.wants.values()].filter((w) => w.state === 'ordered' && w.ready).map((w) => w.order);
  }

  // What's at the counter's end to be drawn there: the orders ready.
  get passMugs(): Array<{ drink: Order; full: boolean }> {
    return this.readyOrders.map((drink) => ({ drink, full: true }));
  }

  // Where the orders ready stand: on the counter, at its end (the room's mugs there: MUG_AT, roomView.ts).
  get readySpot(): { x: number; z: number } {
    return { x: this.barEnd.x + 0.1, z: this.barEnd.z };
  }

  // What's in the hero's hand (drawn in hand: the first on the tray), or nothing.
  get carrying(): Order | null {
    const item = this.tray[0];
    return item ? (item.kind === 'order' ? item.want.order : item.empty.drink) : null;
  }

  get tally(): string {
    return `${this.cleared} cleared`;
  }

  // A moment of it: patrons drawn in and noticed, calling as they will (the soured by a cluttered table), their
  // patience running out (walking out once it has), those served having what they were brought (and leaving its
  // empty on the table).
  update(npcs: readonly Npc[], dt: number): void {
    this.left = Math.max(0, this.left - dt);
    this.drawIn(npcs, dt, 'table', RUSH, MOST);
    const patrons = npcs.filter((n) => n.where === this.inn && n.seat?.piece.kind === 'chair');
    for (const npc of patrons) {
      if (npc.drinking) {
        if ((npc.drinking.left -= dt) <= 0) this.finished(npc);
        continue;
      }
      if (this.wants.has(npc) || this.gone.has(npc)) continue;
      const wait = this.callIn.get(npc) ?? CALL_AFTER[0] + this.roll(npc, 1) * (CALL_AFTER[1] - CALL_AFTER[0]);
      if (wait - dt > 0) {
        this.callIn.set(npc, wait - dt);
        continue;
      }
      this.callIn.delete(npc);
      const table = this.tableOf(npc);
      const cluttered = !!table && this.empties.some((e) => e.table === table);
      const patience = PATIENCE + this.rank.patience - (cluttered ? CLUTTER : 0);
      this.wants.set(npc, { npc, order: ORDERS[Math.floor(this.roll(npc, 2) * ORDERS.length)], state: 'calling', patience, of: patience, ready: false });
      npc.awaiting = true; // (sat till it's come, or they've had enough)
      say(npc, cluttered ? CLUTTERED[Math.floor(this.roll(npc, 6) * CLUTTERED.length)] : CALLS[Math.floor(this.roll(npc, 3) * CALLS.length)]);
    }
    for (const want of [...this.wants.values()]) {
      if ((want.patience -= want.state === 'calling' ? dt : dt * TAKEN) > 0 && patrons.includes(want.npc)) continue;
      this.drop(want);
      if (!patrons.includes(want.npc)) continue; // (gone already: their stay ended some other way)
      this.walkedOut++;
      this.gone.add(want.npc);
      this.walkOut(want.npc);
    }
    for (const npc of this.callIn.keys()) if (!patrons.includes(npc)) this.callIn.delete(npc);
  }

  // A want let go of (walked out, or the shift over): off the tray, out of the barkeep's queue if she's not on it yet,
  // the patron no longer held to their seat.
  private drop(want: Want): void {
    this.wants.delete(want.npc);
    want.npc.awaiting = false;
    const carried = this.tray.findIndex((t) => t.kind === 'order' && t.want === want);
    if (carried >= 0) this.tray.splice(carried, 1);
    const queue = ordersAt(this.inn);
    const queued = want.bar ? queue.indexOf(want.bar) : -1;
    if (queued > 0) queue.splice(queued, 1); // (the front one she's seeing to: let be, it comes to nothing)
  }

  // A patron done with what they were brought: its empty left on their table, and up for another, a while on.
  private finished(npc: Npc): void {
    const drink = npc.drinking?.drink ?? 'ale';
    npc.drinking = null;
    const table = this.tableOf(npc);
    if (!table) return;
    const [dx, dz] = [Math.sign(npc.x - table.x), Math.sign(npc.z - table.z)];
    this.empties.push({ table, x: table.x + dx * 0.25, z: table.z + dz * 0.25, drink }); // (on their side of it)
  }

  private tableOf(npc: Npc): Furniture | undefined {
    return this.tables.find((t) => distanceTo(t, npc.x, npc.z) <= 1);
  }

  // What E would do where the hero stands: set down a patron in reach their order, if it's on the tray;
  // take the order of one calling; at the counter's end, give back the empties carried and take up what's ready;
  // clear a table's empties (room on the tray).
  actionAt(hero: { x: number; z: number }): ShiftAction | null {
    const near = (p: { x: number; z: number }) => Math.hypot(p.x - hero.x, p.z - hero.z) <= REACH;
    const far = (p: { x: number; z: number }) => Math.hypot(p.x - hero.x, p.z - hero.z);
    const nearest = <T>(list: T[], at: (t: T) => { x: number; z: number }) => list.filter((t) => near(at(t))).sort((a, b) => far(at(a)) - far(at(b)))[0];
    const awaited = nearest([...this.wants.values()].filter((w) => w.state === 'carried'), (w) => w.npc);
    if (awaited) return { kind: 'serve', want: awaited };
    const calling = nearest([...this.wants.values()].filter((w) => w.state === 'calling'), (w) => w.npc);
    if (calling) return { kind: 'take', want: calling };
    const room = this.rank.tray - this.tray.length;
    if (near(this.pickupSpot)) {
      const returns = this.tray.filter((t) => t.kind === 'empty').length;
      const wants = [...this.wants.values()].filter((w) => w.state === 'ordered' && w.ready).slice(0, room + returns);
      if (returns > 0 || wants.length > 0) return { kind: 'counter', returns, wants };
    }
    const table = room > 0 ? nearest(this.tables.filter((t) => this.empties.some((e) => e.table === t)), (t) => t) : undefined;
    if (table) return { kind: 'clear', table, empties: this.empties.filter((e) => e.table === table).slice(0, room) };
    return null;
  }

  // Does what E would (actionAt): the copper it earned (a serve's wage and tip, empties given back), or 0; null if
  // nothing was to be done.
  use(hero: { x: number; z: number }, npcs: readonly Npc[]): number | null {
    const action = this.actionAt(hero);
    if (!action) return null;
    switch (action.kind) {
      case 'take':
        this.order(action.want, npcs);
        return 0;
      case 'serve':
        return this.serve(action);
      case 'clear':
        for (const empty of action.empties) {
          this.empties.splice(this.empties.indexOf(empty), 1);
          this.tray.push({ kind: 'empty', empty });
        }
        return 0;
      case 'counter': {
        const returned = action.returns;
        for (let i = this.tray.length - 1; i >= 0; i--) if (this.tray[i].kind === 'empty') this.tray.splice(i, 1);
        this.cleared += returned;
        for (const want of action.wants) {
          want.state = 'carried';
          this.tray.push({ kind: 'order', want });
        }
        this.earned += returned * CLEARED;
        return returned * CLEARED;
      }
    }
  }

  // An order taken: to the barkeep, with the bar's others (first come, first served); ready once she's set it down.
  private order(want: Want, npcs: readonly Npc[]): void {
    want.state = 'ordered';
    say(want.npc, `${ORDER_NAMES[want.order].replace(/^./, (c) => c.toUpperCase())}, please.`);
    want.bar = {
      stool: this.barEnd,
      by: null,
      drink: want.order,
      batch: true, // (poured with the tables' others queued, all set down at once)
      served: () => {
        want.bar = undefined;
        if (this.wants.get(want.npc) === want) want.ready = true; // (still wanted: at the counter's end)
      },
    };
    placeOrder(this.inn, want.bar);
    callBarkeep(npcs.find((n) => n.role === 'barkeep' && n.home === this.inn));
  }

  // A patron's order, off the tray and set down before them: a wage and the tip their patience left.
  private serve(action: Extract<ShiftAction, { kind: 'serve' }>): number {
    const { want } = action;
    this.tray.splice(this.tray.findIndex((t) => t.kind === 'order' && t.want === want), 1);
    this.wants.delete(want.npc);
    const tip = Math.max(TIP_FLOOR, Math.round(TIP * (want.patience / want.of) * this.rank.tips));
    this.served++;
    this.earned += WAGE + tip;
    this.tips += tip;
    want.npc.awaiting = false;
    want.npc.drinking = { left: ALE_SECONDS, seconds: ALE_SECONDS, drink: want.order };
    say(want.npc, THANKS[Math.floor(this.roll(want.npc, 5) * THANKS.length)]);
    return WAGE + tip;
  }

  // The shift let go of: those still waiting no longer held to their seats, their orders out of the queue, the
  // tables cleared (the inn's own staff to it), the server back on her feet.
  release(): void {
    for (const want of [...this.wants.values()]) this.drop(want);
    this.tray.length = 0;
    this.empties.length = 0;
    super.release();
  }
}

// Whether a table chair's patron is tied to it (waiting on an order, or having it): not up and off till then.
export const busyAtTable = (npc: Npc): boolean => !!npc.awaiting || !!npc.drinking;
