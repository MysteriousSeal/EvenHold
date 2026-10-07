// A shift tending an inn's bar (jobs.ts: innBarkeep), the barkeep off her feet by the hearth: for SHIFT seconds the
// hero works the aisle behind the counter (the keg's tap at its back, the washstand, the bottle shelves). Two lots
// want pouring for:
// - the patrons on the stools, each asking for an ale or a glass of wine as they sit (inn/barPatrons.ts: the bar's
//   queue); poured (pour.ts: E at the tap or a shelf, E again at the line) and handed across the bar to them (E,
//   opposite them), they drink it and leave the empty before them, and may ask for another;
// - the tables, the inn's server calling out a ticket now and then for one with folk sat at it ("Two ales and a wine
//   for table three!"), a drink each, they waiting on it: each poured and set down at the counter's end (the pass, E
//   there), she carries them over once they're all there and sets them down before them; the empties come back to the
//   pass a while later.
// Every pour takes a clean cup (tankards for ale, glasses for wine, so many to the bar), and they run out: the
// empties gathered (off the bar, from the pass: E) and washed at the washstand (E there), as many at a time as the
// hero's hands hold. A wage for each drink, and a tip the better the pour and the less they waited (a run of perfect
// ones, more); left waiting too long, a patron gets up and goes, a table gives up its ticket. A spill comes out of
// the pay. The busy hour brings the village's folk in, for the stools and the tables.

import { distanceTo, type Furniture } from '../interiors/furniture';
import type { Entrance } from '../interiors/interiors';
import type { Npc } from '../npcs/npcs';
import { say } from '../npcs/speech';
import { mugsAt, takeMug } from '../inn/barMugs';
import { ordersAt, type BarOrder } from '../inn/barOrders';
import { AISLE_X, AT_KEG, serveTable } from '../inn/innStaff';
import { ALE_SECONDS } from '../inn/barPatrons';
import type { JobRank } from './jobs';
import { FILL_SECONDS, GRADE_WORTH, gradePour, type PourGrade, type Pourable } from './pour';
import { Shift, WAGE } from './shift';
import { oneOf } from '../../util/random';
import { capitalize } from '../../util/text';

const CUPS: Record<Pourable, number> = { ale: 6, wine: 4 }; // clean on the shelves, as a shift begins
const STOOL_PATIENCE = 55; // seconds a patron at the bar waits for theirs (and the rank's more)
const TICKET_PATIENCE = 70; // a table's, for its whole ticket
const TICKET_EVERY: [number, number] = [16, 24]; // seconds between the server's calls
const MOST_TICKETS = 3; // called and not yet all set down
const RETURN_AFTER: [number, number] = [18, 30]; // seconds before a table's empties come back to the pass
const CARRIED_MOST = 45; // seconds, at most, a ticket's taken to its table once all set down (she never gets there: as good as)
const TABLE_RUSH: [number, number] = [14, 22]; // seconds between one of the village coming in for a table, and the next
const MOST_AT_TABLES = 6;
const TIP = 2; // copper, at most, for a perfect pour handed over at once (times the rank's tips)
const WINE_TIP = 1.5; // wine's, times: the finer pour
const STREAK_TIP = 0.05; // more, a perfect pour in a run of them, for each before it
const STREAK_MOST = 4;
const SPILL = 1; // copper, out of the pay
const AT_STATION = 0.55; // room tiles from the tap (or along a shelf, the washstand) to work it
const ALONG_ROW = 0.6; // from a stool's row (or the pass), along the bar, to reach across to it
const BAR_RUSH: [number, number] = [12, 20]; // seconds between one of the village coming in for a stool, and the next
const MOST_AT_BAR = 4;

// In the hero's hands: a drink poured (how well, and the run of perfect ones it was in), or an empty to wash.
export type Held = { kind: 'drink'; drink: Pourable; grade: PourGrade; streak: number } | { kind: 'empty'; drink: Pourable };

// A patron on a stool, waiting on what they asked for.
export interface StoolWant {
  npc: Npc;
  drink: Pourable;
  order: BarOrder; // theirs, in the bar's queue
  patience: number;
  of: number;
}

// A table's ticket, called out by the server: what's still to be set down at the pass, what's there already.
export interface Ticket {
  table: number; // its number, as she calls it
  at: Furniture; // the table
  patrons: Npc[]; // those sat at it it's for, waiting on it
  ordered: Pourable[]; // what each of them asked for
  carried?: boolean; // the server on her way with it
  drinks: Pourable[]; // still to pour and set down
  set: Held[]; // set down at the pass
  patience: number;
  of: number;
  done: boolean; // all set down, paid: on the pass till she takes them
  waiting?: number; // seconds it's waited there, all set down
}

// What E would do behind the bar now (the prompt): stop the pour; hand a patron theirs; set the tables' down at the
// pass; wash what's in hand; gather empties (off the bar, from the pass); start a pour (`dry`: no clean cup for it).
export type BarAction =
  | { kind: 'stop'; drink: Pourable; fill: number }
  | { kind: 'hand'; want: StoolWant }
  | { kind: 'pass'; drinks: number }
  | { kind: 'wash'; empties: number }
  | { kind: 'gather'; empties: number; z: number | null } // (z: a stool's row on the bar; null: at the pass)
  | { kind: 'pour'; drink: Pourable; dry: boolean };

const SAY_GRADE: Record<Exclude<PourGrade, 'spilled'>, readonly string[]> = {
  perfect: ['Now that is a pour.', 'Right to the line!', 'Perfect, thank you.', 'You know your trade.'],
  frothy: ['All head and no ale.', "Bit frothy, isn't it?", "I'll drink the foam, then."],
  short: ['Short measure, is it?', 'Bit light, that.', 'Not quite full, friend.'],
  thin: ['Is this a joke?', "You call that a drink?", 'Half of it, at best.'],
};
const NUMBERS = ['one', 'two', 'three'];
const named = (d: Pourable, n: number) => (d === 'ale' ? (n === 1 ? 'an ale' : `${NUMBERS[n - 1]} ales`) : n === 1 ? 'a wine' : `${NUMBERS[n - 1]} wines`);

export class BarShift extends Shift {
  readonly clean: Record<Pourable, number> = { ...CUPS }; // cups on the shelves, ready to pour into
  readonly held: Held[] = [];
  readonly wants = new Map<BarOrder, StoolWant>();
  readonly tickets: Ticket[] = [];
  readonly passEmpties: Pourable[] = []; // brought back from the tables, at the pass
  pour: { drink: Pourable; fill: number; at: { x: number; z: number } } | null = null;
  streak = 0; // perfect pours in a row
  best = 0; // the longest run
  perfect = 0; // perfect pours handed over
  spilled = 0;
  last: { grade: PourGrade; n: number } | null = null; // the last pour stopped (or run over), and how many so far (for the view's word)
  private readonly returns: Array<{ drinks: Pourable[]; due: number }> = []; // a table's empties, on their way back
  private ticketIn = TICKET_EVERY[0] / 2; // seconds before the server's next call

  constructor(inn: Entrance, rank: JobRank, seed: number) {
    super('innBarkeep', inn, rank, seed);
  }

  // The bar's last row (the pass: where the tables' are set down, the server waiting just past it).
  get passZ(): number {
    return this.counter ? this.counter.z + this.counter.d - 1 : 1;
  }

  // The stations along the aisle: the tap, the washstand, each bottle shelf (where to stand: the middle of its span).
  get stations(): { tap: { x: number; z: number }; sink: { x: number; z: number } | null; shelves: Array<{ x: number; z: number }> } {
    const middle = (f: Furniture) => ({ x: AISLE_X, z: f.z + (f.d - 1) / 2 });
    const sink = this.furniture.find((f) => f.kind === 'sink');
    return { tap: AT_KEG, sink: sink ? middle(sink) : null, shelves: this.furniture.filter((f) => f.kind === 'bottleShelf').map(middle) };
  }

  get carrying(): Pourable | null {
    return this.pour?.drink ?? this.held[0]?.drink ?? null;
  }

  get tally(): string {
    return `${this.perfect} perfect pour${this.perfect === 1 ? '' : 's'} · ${this.spilled} spilled`;
  }

  // What's on the pass: the tables' drinks set down (till she takes them), and the empties brought back.
  get passMugs(): Array<{ drink: Pourable; full: boolean }> {
    return [...this.tickets.flatMap((t) => t.set.map((h) => ({ drink: h.drink, full: true }))), ...this.passEmpties.map((drink) => ({ drink, full: false }))];
  }

  // A moment of it: the pour filling (run over at the brim; let go of if the hero's left the tap), the stools' wants
  // and the tables' tickets running down (the server calling a new one now and then, taking those done, bringing
  // the empties back), the busy hour drawing folk to the bar.
  update(npcs: readonly Npc[], dt: number, hero: { x: number; z: number }): void {
    this.left = Math.max(0, this.left - dt);
    this.drawIn(npcs, dt, 'bar', BAR_RUSH, MOST_AT_BAR);
    this.pouring(dt, hero);
    this.stools(npcs, dt);
    this.tables(npcs, dt);
  }

  private pouring(dt: number, hero: { x: number; z: number }): void {
    const { pour } = this;
    if (!pour) return;
    if (Math.hypot(hero.x - pour.at.x, hero.z - pour.at.z) > AT_STATION + 0.35) {
      this.clean[pour.drink]++; // (walked off: the cup put back)
      this.pour = null;
      return;
    }
    pour.fill += dt / FILL_SECONDS[pour.drink];
    if (pour.fill < 1) return;
    this.pour = null; // run over: spilled, the cup to wash
    this.held.push({ kind: 'empty', drink: pour.drink });
    this.spilled++;
    this.streak = 0;
    this.earned = Math.max(0, this.earned - SPILL);
    this.last = { grade: 'spilled', n: (this.last?.n ?? 0) + 1 };
  }

  // The stools: a want for each patron's order in the bar's queue; their patience running down; gone, once it's out.
  private stools(npcs: readonly Npc[], dt: number): void {
    const queue = ordersAt(this.inn);
    for (const order of queue) {
      if (!order.by || this.wants.has(order) || order.drink === 'pie') continue;
      const patience = STOOL_PATIENCE + this.rank.patience;
      this.wants.set(order, { npc: order.by, drink: order.drink, order, patience, of: patience });
    }
    for (const want of [...this.wants.values()]) {
      const sat = npcs.includes(want.npc) && want.npc.where === this.inn && !!want.npc.seat;
      if (!queue.includes(want.order) || !sat) {
        this.wants.delete(want.order); // (served, or gone some other way)
        continue;
      }
      if ((want.patience -= dt) > 0) continue;
      this.wants.delete(want.order);
      queue.splice(queue.indexOf(want.order), 1);
      this.walkOut(want.npc);
      this.walkedOut++;
    }
  }

  // The tables: their folk drawn in by the busy hour, a ticket called for one with folk sat at it now and then; those
  // waited on too long given up on (they walk out); those all set down carried over by the server (as good as, if
  // she never gets there); what's set down before them drunk; their empties back at the pass a while on.
  private tables(npcs: readonly Npc[], dt: number): void {
    this.drawIn(npcs, dt, 'table', TABLE_RUSH, MOST_AT_TABLES);
    const server = npcs.find((n) => n.role === 'server' && n.home === this.inn && n.where === this.inn);
    if ((this.ticketIn -= dt) <= 0) {
      this.ticketIn = TICKET_EVERY[0] + this.roll(this.seed, 71) * (TICKET_EVERY[1] - TICKET_EVERY[0]);
      if (this.tickets.filter((t) => !t.done).length < MOST_TICKETS) this.call(npcs, server);
    }
    for (const ticket of [...this.tickets]) {
      if (ticket.done) {
        ticket.waiting = (ticket.waiting ?? 0) + dt;
        if (server && !ticket.carried && !this.tickets.some((k) => k.carried)) {
          ticket.carried = true; // (one at a time: the next once she's set this down)
          ticket.waiting = 0;
          serveTable(server, ticket.at, ticket.set[0]?.drink ?? 'ale', () => this.delivered(ticket), this.seed);
        }
        if (!server || ticket.waiting >= CARRIED_MOST) this.delivered(ticket); // (she never got there: as good as)
        continue;
      }
      if ((ticket.patience -= dt) > 0) continue;
      this.tickets.splice(this.tickets.indexOf(ticket), 1); // given up on: what was set down for it, back to wash
      this.passEmpties.push(...ticket.set.map((h) => h.drink));
      this.walkedOut++;
      for (const [i, npc] of ticket.patrons.entries()) this.walkOut(npc, i === 0); // (up and off, the one of them grumbling)
      if (server) say(server, `Table ${ticket.table} gave up on us. Never mind.`);
    }
    for (const back of [...this.returns]) {
      if ((back.due -= dt) > 0) continue;
      this.returns.splice(this.returns.indexOf(back), 1);
      this.passEmpties.push(...back.drinks);
    }
    for (const npc of npcs) {
      if (npc.where !== this.inn || npc.seat?.piece.kind !== 'chair' || !npc.drinking) continue;
      if ((npc.drinking.left -= dt) <= 0) npc.drinking = null; // (had: up for another, or off, as they like)
    }
  }

  // A table's drinks set down before them (the server there, or as good as): each theirs, drunk; the empties to come back.
  private delivered(ticket: Ticket): void {
    const at = this.tickets.indexOf(ticket);
    if (at < 0) return;
    this.tickets.splice(at, 1);
    const set = ticket.set.map((h) => h.drink);
    for (const [i, npc] of ticket.patrons.entries()) {
      const mine = set.indexOf(ticket.ordered[i]);
      const drink = mine >= 0 ? set.splice(mine, 1)[0] : set.shift();
      npc.awaiting = false;
      if (drink && npc.where === this.inn) npc.drinking = { left: ALE_SECONDS, seconds: ALE_SECONDS, drink };
    }
    this.returns.push({ drinks: ticket.set.map((h) => h.drink), due: RETURN_AFTER[0] + this.roll(ticket.table, 72) * (RETURN_AFTER[1] - RETURN_AFTER[0]) });
  }

  // The server calls a ticket for a table with folk sat at it (not waiting on one already, nor drinking): a drink
  // for each of them (as many as one more than the hero's hands hold, three at most), ales mostly; they wait on it.
  private call(npcs: readonly Npc[], server: Npc | undefined): void {
    const tables = this.furniture.filter((f) => f.kind === 'tavernTable');
    const sat = (t: Furniture) => npcs.filter((n) => n.role === 'villager' && n.where === this.inn && n.seat?.piece.kind === 'chair' && distanceTo(t, n.x, n.z) <= 1 && !n.awaiting && !n.drinking);
    const ready = tables.filter((t) => !this.tickets.some((k) => k.at === t) && sat(t).length > 0);
    if (ready.length === 0) return;
    const at = oneOf(ready, this.roll(this.seed, 75));
    const patrons = sat(at).slice(0, Math.min(3, this.rank.tray + 1));
    const ordered = patrons.map((npc): Pourable => (this.roll(npc, 74) < 0.7 ? 'ale' : 'wine'));
    const table = tables.indexOf(at) + 1;
    const patience = TICKET_PATIENCE + this.rank.patience;
    for (const npc of patrons) npc.awaiting = true; // (sat till it's come, or they've had enough)
    this.tickets.push({ table, at, patrons, ordered, drinks: [...ordered].sort(), set: [], patience, of: patience, done: false });
    const ales = ordered.filter((d) => d === 'ale').length;
    const words = [...(ales ? [named('ale', ales)] : []), ...(ordered.length > ales ? [named('wine', ordered.length - ales)] : [])].join(' and ');
    if (server) say(server, `${capitalize(words)} for table ${table}!`);
  }

  // Whether the hero's behind the bar (in the aisle), and how far along it from row `z`.
  private behind(hero: { x: number; z: number }): boolean {
    return !!this.counter && hero.x < this.counter.x - 0.2 && hero.z < this.counter.z + this.counter.d - 0.2;
  }

  // What E would do where the hero stands (behind the bar), first that can: stop the pour; hand a patron in reach
  // theirs; set the tables' down at the pass; wash what's in hand at the washstand; gather the empties in reach;
  // start a pour at the tap or a shelf.
  actionAt(hero: { x: number; z: number }): BarAction | null {
    if (this.pour) return { kind: 'stop', drink: this.pour.drink, fill: this.pour.fill };
    if (!this.behind(hero)) return null;
    const row = (z: number) => Math.abs(hero.z - z) <= ALONG_ROW;
    const drinks = this.held.filter((h) => h.kind === 'drink');
    const want = [...this.wants.values()].filter((w) => row(w.order.stool.z) && drinks.some((h) => h.drink === w.drink)).sort((a, b) => a.patience - b.patience)[0];
    if (want) return { kind: 'hand', want };
    if (row(this.passZ)) {
      const n = this.forPass().length;
      if (n > 0) return { kind: 'pass', drinks: n };
    }
    const { tap, sink, shelves } = this.stations;
    const at = (p: { x: number; z: number }) => Math.hypot(hero.x - p.x, hero.z - p.z) <= AT_STATION;
    const empties = this.held.filter((h) => h.kind === 'empty').length;
    if (empties > 0 && sink && Math.abs(hero.z - sink.z) <= 1) return { kind: 'wash', empties };
    const room = this.rank.tray - this.held.length;
    if (room > 0) {
      const mug = mugsAt(this.inn).find((m) => !m.full && row(m.z));
      if (mug) return { kind: 'gather', empties: 1, z: mug.z };
      if (this.passEmpties.length > 0 && row(this.passZ)) return { kind: 'gather', empties: Math.min(room, this.passEmpties.length), z: null };
      if (at(tap)) return { kind: 'pour', drink: 'ale', dry: this.clean.ale === 0 };
      if (shelves.some((s) => Math.abs(hero.z - s.z) <= 1 && Math.abs(hero.x - s.x) <= AT_STATION)) return { kind: 'pour', drink: 'wine', dry: this.clean.wine === 0 };
    }
    return null;
  }

  // The drinks in hand some ticket still wants (oldest ticket first), each with the ticket it's for.
  private forPass(): Array<{ held: Held; ticket: Ticket }> {
    const out: Array<{ held: Held; ticket: Ticket }> = [];
    const wanted = this.tickets.filter((t) => !t.done).map((t) => ({ ticket: t, left: [...t.drinks] }));
    for (const held of this.held) {
      if (held.kind !== 'drink') continue;
      const slot = wanted.find((w) => w.left.includes(held.drink));
      if (!slot) continue;
      slot.left.splice(slot.left.indexOf(held.drink), 1);
      out.push({ held, ticket: slot.ticket });
    }
    return out;
  }

  use(hero: { x: number; z: number }): number | null {
    const action = this.actionAt(hero);
    if (!action) return null;
    switch (action.kind) {
      case 'stop':
        return this.stop();
      case 'hand':
        return this.hand(action.want);
      case 'pass': {
        let earned = 0;
        for (const { held, ticket } of this.forPass()) {
          this.held.splice(this.held.indexOf(held), 1);
          ticket.drinks.splice(ticket.drinks.indexOf(held.drink), 1);
          ticket.set.push(held);
          if (ticket.drinks.length > 0) continue;
          ticket.done = true; // all there: paid, each by its pour
          for (const h of ticket.set) earned += this.paid(h, ticket.patience / ticket.of);
        }
        return earned;
      }
      case 'wash':
        for (let i = this.held.length - 1; i >= 0; i--) {
          const h = this.held[i];
          if (h.kind !== 'empty') continue;
          this.held.splice(i, 1);
          this.clean[h.drink]++;
        }
        return 0;
      case 'gather':
        if (action.z !== null) {
          const mug = takeMug(this.inn, action.z);
          if (mug) this.held.push({ kind: 'empty', drink: mug.drink === 'wine' ? 'wine' : 'ale' });
        } else for (const drink of this.passEmpties.splice(0, action.empties)) this.held.push({ kind: 'empty', drink });
        return 0;
      case 'pour':
        if (action.dry) return null; // (no clean cup: nothing doing)
        this.clean[action.drink]--;
        this.pour = { drink: action.drink, fill: 0, at: { x: hero.x, z: hero.z } };
        return 0;
    }
  }

  // The pour stopped: graded, in hand (a run of perfect ones kept, or broken).
  private stop(): number {
    const pour = this.pour!;
    this.pour = null;
    const grade = gradePour(pour.fill, this.rank.steady);
    this.streak = grade === 'perfect' ? this.streak + 1 : 0;
    this.best = Math.max(this.best, this.streak);
    this.held.push({ kind: 'drink', drink: pour.drink, grade, streak: this.streak });
    this.last = { grade, n: (this.last?.n ?? 0) + 1 };
    return 0;
  }

  // A patron's handed across the bar to them (the best poured of what's in hand for them): set down before them (they
  // take it up and drink), the empty there already gathered up in its place; their word on it.
  private hand(want: StoolWant): number {
    const mine = this.held.filter((h): h is Extract<Held, { kind: 'drink' }> => h.kind === 'drink' && h.drink === want.drink);
    const held = mine.sort((a, b) => GRADE_WORTH[b.grade] - GRADE_WORTH[a.grade])[0];
    this.held.splice(this.held.indexOf(held), 1);
    const left = takeMug(this.inn, want.order.stool.z); // (the cup before them: up, out of the way)
    if (left && !left.full) this.held.push({ kind: 'empty', drink: left.drink === 'wine' ? 'wine' : 'ale' });
    const queue = ordersAt(this.inn);
    queue.splice(queue.indexOf(want.order), 1);
    this.wants.delete(want.order);
    want.order.served();
    if (held.grade !== 'spilled') say(want.npc, SAY_GRADE[held.grade][Math.floor(this.roll(want.npc, 5) * SAY_GRADE[held.grade].length)]);
    return this.paid(held, want.patience / want.of);
  }

  // One handed over (or set down for a table): served, a wage and its tip (the better the pour, the shorter the
  // wait, the longer the run it was in).
  private paid(held: Held, patience: number): number {
    if (held.kind !== 'drink') return 0;
    const run = 1 + STREAK_TIP * Math.min(STREAK_MOST, Math.max(0, held.streak - 1));
    const tip = Math.max(1, Math.round(TIP * GRADE_WORTH[held.grade] * Math.max(0, patience) * this.rank.tips * run * (held.drink === 'wine' ? WINE_TIP : 1)));
    this.served++;
    if (held.grade === 'perfect') this.perfect++;
    this.earned += WAGE + tip;
    this.tips += tip;
    return WAGE + tip;
  }

  // The shift let go of: the stools' orders left for the barkeep (back at it), the server's hands empty.
  release(npcs: readonly Npc[] = []): void {
    this.pour = null;
    this.held.length = 0;
    for (const ticket of this.tickets) for (const npc of ticket.patrons) npc.awaiting = false; // (no longer held to their seats)
    for (const npc of npcs) if (npc.where === this.inn && npc.seat?.piece.kind === 'chair' && npc.drinking) npc.drinking = null; // (done up)
    const server = npcs.find((n) => n.role === 'server' && n.home === this.inn);
    if (server) Object.assign(server, { carrying: false, steps: [], path: null });
    super.release();
  }
}
