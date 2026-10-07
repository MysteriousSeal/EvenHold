// A shift of work at an inn (work.ts), whatever the job: SHIFT seconds on the clock, its tally (served, walked out,
// earned: all paid at its end), the rank the hero works it at (its perks), the inn's furniture and where its
// counter ends (the server waiting there, what's set down for her), a patron walking out on it, and the busy hour it
// brings (word's round that the inn's short-handed: the village's folk come in now and then, for a table or a stool
// at the bar). The jobs' own: serving the tables (innShift.ts), tending the bar (barShift.ts).

import { hashUnit, oneOf } from '../../util/random';
import type { Furniture } from '../interiors/furniture';
import { layoutOf } from '../interiors/indoors';
import type { Entrance } from '../interiors/interiors';
import type { Drink, Npc } from '../npcs/npcs';
import { visitInn } from '../npcs/npcRoutine';
import { say } from '../npcs/speech';
import { pickupAt } from '../inn/innStaff';
import { shiftBegun, shiftOver } from './shiftsAt';
import type { JobId, JobRank } from './jobs';

export const SHIFT = 150; // seconds a shift lasts (two and a half hours on the game's clock)
export const WAGE = 3; // copper an order
export const REACH = 1.4; // room tiles: by a patron, a table, or the counter's end, near enough for E
const STAY: [number, number] = [40, 90]; // seconds those drawn in by the busy hour stay sat
const WALKS = ["Forget it. I'll drink elsewhere.", 'Too slow by half!', "I've waited long enough.", 'Never mind!', 'Forget it.'];

export abstract class Shift {
  left = SHIFT;
  served = 0;
  walkedOut = 0;
  earned = 0;
  tips = 0;
  private rolls = 0;
  private readonly rush = { table: 0, bar: 0 }; // seconds before the next comes in, for each
  protected readonly furniture: readonly Furniture[]; // the inn's
  protected readonly counter: Furniture | undefined; // its bar's

  constructor(
    readonly job: JobId,
    readonly inn: Entrance,
    public rank: JobRank, // (risen mid-shift: its perks at once)
    protected readonly seed: number,
  ) {
    this.furniture = layoutOf(seed, inn).furniture;
    this.counter = this.furniture.find((f) => f.kind === 'counter');
    shiftBegun(inn, job);
  }

  // Where the server waits at the counter's end (and takes up what's set down there for her): just past it.
  get pickupSpot(): { x: number; z: number } {
    return this.counter ? pickupAt(this.counter) : { x: 1, z: 1 };
  }

  // Where what's set down at the counter's end stands (drawn there): half a tile short of its end.
  get barEndZ(): number {
    return (this.counter ? this.counter.z + this.counter.d : 1) - 0.5;
  }

  // A moment of it (the hero where they stand: a pour's at the tap, say).
  abstract update(npcs: readonly Npc[], dt: number, hero: { x: number; z: number }): void;
  // What E would do where the hero stands, if anything (the prompt).
  abstract actionAt(hero: { x: number; z: number }): { kind: string } | null;
  // Does it: the copper it earned there and then (or 0); null if nothing was to be done.
  abstract use(hero: { x: number; z: number }, npcs: readonly Npc[]): number | null;
  // What's in the hero's hand (drawn so), or nothing.
  abstract get carrying(): Drink | null;
  // How the shift went, beyond what's served and walked out, for its end ("4 tables cleared").
  abstract get tally(): string;

  // A patron who's had enough: up and off, their stay over (`speak`: a word as they go).
  protected walkOut(npc: Npc, speak = true): void {
    Object.assign(npc, { awaiting: false, waited: Infinity });
    if (speak) say(npc, oneOf(WALKS, this.roll(npc, 4)));
  }

  // A number in 0..1, fresh each time, by who (or what) it's for and `salt`.
  protected roll(npc: Npc | number, salt: number): number {
    return hashUnit(typeof npc === 'number' ? npc : npc.id, ++this.rolls, salt);
  }

  // The busy hour: every `every` seconds (a while either way) one of the village (of this inn's, not here already)
  // comes in for a seat (`at`: a chair at a table, or a stool at the bar), while one's free and fewer than `most` are
  // sat there or on their way.
  protected drawIn(npcs: readonly Npc[], dt: number, at: 'table' | 'bar', every: [number, number], most: number): void {
    if ((this.rush[at] -= dt) > 0) return;
    this.rush[at] = every[0] + hashUnit(++this.rolls, this.seed, 61) * (every[1] - every[0]);
    const kind = at === 'table' ? 'chair' : 'barStool';
    const seats = this.furniture.filter((f) => f.kind === kind).length;
    const coming = (n: Npc) => n.steps.some((s) => s.kind === 'settle' && s.at === at) || (n.where === this.inn && n.seat?.piece.kind === kind);
    if (npcs.filter(coming).length >= Math.min(most, seats)) return;
    const free = npcs.filter((n) => n.role === 'villager' && n.inn === this.inn && n.where !== this.inn && !coming(n));
    const who = oneOf(free, hashUnit(this.rolls, this.seed, 62));
    if (who) visitInn(who, this.inn, this.seed, STAY[0] + hashUnit(who.id, this.rolls, 63) * (STAY[1] - STAY[0]), at);
  }

  // The shift let go of (its end, or the hero gone): the inn's own staff back at it (`npcs`: the folk about).
  release(_npcs?: readonly Npc[]): void {
    shiftOver(this.inn);
  }
}
