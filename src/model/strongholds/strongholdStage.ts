// What a stronghold's foes' ways of fighting are made of (strongholdMoves.ts
// puts them together; strongholdPack.ts the packs' roles, strongholdBosses.ts
// and strongholdKing.ts the bosses'): the stage they're played on, for a visit.
// - Told moves (enemies/toldMoves.ts), each kind's own, one at a time a foe:
//   `act`, with what holds it back and the mark it shows on the floor.
// - A call (`call`): a foe planted a moment, shown calling (a whistle, a
//   rally), then what it called for.
// - Blasts (`blast`): a circle told on the floor, then bursting (a fire pot
//   landed, a powder keg's fuse, a brazier gone over): whoever's still in it
//   hurt, knocked away; burning on after, some (`fires`: ground to keep off).
// - Shots (`loose`, `lob`): a bolt flying straight till it strikes the hero,
//   a wall or its range; a pot lobbed over everything to where it'll burst.
// - Walking a foe somewhere that isn't at the hero (`walk`: a runner gone for
//   help, those it fetched coming back), and one that keeps its distance
//   (`standOff`); both over the director's own steps (undone, then theirs).
// - `harm`: what a blow of a foe's does, never more than HARDEST of the health
//   of a hero of the stronghold's level, so nothing told fells them at a blow.

import type { Enemy } from '../types';
import { maxHpAt } from '../hero/attributes';
import { findPath } from '../map/pathfinding';
import { ToldMoves, knockAway, type Told, type ToldMove } from '../enemies/toldMoves';
import type { StrongholdFight, StrongholdFire, StrongholdMark, StrongholdShot } from './strongholdMoves';

export const HARDEST = 0.5; // of a hero's health at the stronghold's level (nothing on): the most one told blow takes
export const BOLT = { speed: 9, hit: 0.24, range: 10 }; // a crossbow's bolt: tiles a second, how near it must pass, how far it flies
export const BURN_EVERY = 0.7; // seconds between the bites of burning ground
const PATH_EVERY = 0.6; // seconds between a walker's fresh paths
const PATH_RADIUS = 32; // tiles it looks round for its way (a wing's rooms apart)
const STUCK = 2.5; // seconds getting nowhere before a walker gives up
const BURST_SHOWN = 0.45; // seconds a burst is kept for the view to flash

type Point = { x: number; z: number };
type Shape = { tone: StrongholdMark['tone'] } & ({ shape: 'ring'; x: number; z: number; r: number } | { shape: 'strip'; x: number; z: number; dx: number; dz: number; long: number; half: number });

export interface Blast {
  x: number;
  z: number;
  r: number;
  by: Enemy;
  damage: number;
  tell: number; // seconds its circle shows before it bursts
  wait?: number; // seconds before its circle shows at all (one of a chain)
  knock?: number; // tiles whoever's caught is thrown from its middle
  burn?: number; // seconds its ground burns after
  tone?: StrongholdMark['tone'];
  then?: () => void; // as it bursts
}

interface Act {
  moves: ToldMoves;
  move: ToldMove;
  unless?: (foe: Enemy) => boolean;
  mark?: (m: Told) => Shape | null;
}

interface Walker {
  foe: Enemy;
  to: () => Point;
  speed: number;
  there: (foe: Enemy) => boolean;
  then: (arrived: boolean) => void;
  path: Point[] | null;
  age: number;
  at: Point;
  stuck: number;
}

export class Stage {
  readonly shots: StrongholdShot[] = [];
  readonly marks: StrongholdMark[] = [];
  readonly fires: StrongholdFire[] = [];
  readonly bursts: Array<{ x: number; z: number; r: number; age: number }> = [];
  clock = 0; // seconds into the visit
  private readonly acts: Act[] = [];
  private readonly calls: Array<{ foe: Enemy; told: NonNullable<Enemy['told']>; x: number; z: number; t: number; secs: number; then: () => void }> = [];
  private readonly blasts: Array<Blast & { t: number }> = [];
  private readonly pots = new Map<StrongholdShot, { from: Point; to: Point; time: number }>();
  private readonly walkers: Walker[] = [];
  private readonly stood = new Map<Enemy, Point>();
  private singe = 0; // seconds before burning ground bites again

  constructor(readonly fight: StrongholdFight) {}

  // What a blow of `by`'s does, `times` its plain one: at least 1, never more than HARDEST of a hero's health here.
  harm(by: Enemy, times: number): number {
    const most = Math.max(2, Math.floor(maxHpAt(this.fight.level) * HARDEST));
    return Math.max(1, Math.min(most, Math.round(by.damage * times)));
  }

  far(a: Point, b: Point = this.fight.hero): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
  }

  banner(title: string, line: string): void {
    this.fight.hooks.report({ kind: 'banner', title, line });
  }

  // A told move of a kind's, run with the rest: `unless` holds it back; `mark`, what it shows on the floor while told.
  act(move: ToldMove, land: (foe: Enemy, m: Told) => void, more: Pick<Act, 'unless' | 'mark'> = {}): ToldMoves {
    const moves = new ToldMoves(move, land);
    this.acts.push({ moves, move, ...more });
    return moves;
  }

  // Whether a foe's at something of its own (a told move, a call, a walk): nothing else of its starts.
  busy(foe: Enemy, but?: ToldMoves): boolean {
    return this.acts.some((a) => a.moves !== but && a.moves.doing(foe)) || this.calls.some((c) => c.foe === foe) || this.walking(foe);
  }

  // A foe planted `secs`, shown calling (`told`), then what it called for (unless it's slain first); once it's done
  // with whatever told move it's at, and any call of its before this one.
  call(foe: Enemy, told: NonNullable<Enemy['told']>, secs: number, then: () => void): void {
    this.calls.push({ foe, told, x: foe.x, z: foe.z, t: -1, secs, then });
  }

  blast(blast: Blast): void {
    this.blasts.push({ ...blast, t: 0 });
  }

  // A bolt loosed from `by` along (dx, dz).
  loose(by: Enemy, dx: number, dz: number, damage: number): void {
    this.shots.push({ x: by.x + dx * 0.3, z: by.z + dz * 0.3, dx, dz, flown: 0, kind: 'bolt', by, damage });
  }

  // A pot lobbed from `by` to a spot, over whatever's between: its circle told there while it flies, then its blast.
  lob(by: Enemy, blast: Blast): void {
    const d = this.far(by, blast) || 1;
    const shot: StrongholdShot = { x: by.x, z: by.z, dx: (blast.x - by.x) / d, dz: (blast.z - by.z) / d, flown: 0, kind: 'pot', by, damage: blast.damage, high: 0 };
    this.shots.push(shot);
    this.pots.set(shot, { from: { x: by.x, z: by.z }, to: { x: blast.x, z: blast.z }, time: blast.tell });
    this.blast({ ...blast, tone: 'fire' });
  }

  // Ground set burning a while (a pot's, a keg's, a brazier's coals).
  burn(x: number, z: number, r: number, left: number, by: Enemy): void {
    this.fires.push({ x, z, r, left, by });
    this.singe = Math.max(this.singe, BURN_EVERY * 0.6); // (a moment to get off it before it first bites)
  }

  // One slain: what it set burning out, what it lit or lobbed never bursting.
  quench(foe: Enemy): void {
    const keep = <T extends { by: Enemy }>(list: T[]) => list.splice(0, list.length, ...list.filter((one) => one.by !== foe));
    keep(this.fires);
    keep(this.blasts);
    for (const shot of this.shots.filter((s) => s.by === foe && this.pots.delete(s))) this.shots.splice(this.shots.indexOf(shot), 1);
  }

  // A foe sent at the hero from wherever it is (one called up, one fetched): walked their way till it sees them, then
  // set on them as any foe, at home where it then stands (its leash from there).
  setOn(foe: Enemy, sight: number, speed: number): void {
    const { hero, director } = this.fight;
    this.walk(foe, () => hero, speed, (f) => this.far(f) < sight && director.inView(f, hero), () => Object.assign(foe, { state: 'chase', lastSeen: { x: hero.x, z: hero.z }, lostFor: 0, target: null, homeX: foe.x, homeZ: foe.z }));
  }

  // A foe walked to somewhere (its own way found, at `speed`), the director's steps undone meanwhile; `then` once it's
  // `there` (true) or can get no nearer (false); never, slain on the way.
  walk(foe: Enemy, to: () => Point, speed: number, there: (foe: Enemy) => boolean, then: (arrived: boolean) => void): void {
    if (!this.walking(foe)) this.walkers.push({ foe, to, speed, there, then, path: null, age: 0, at: { x: foe.x, z: foe.z }, stuck: 0 });
  }

  walking(foe: Enemy): boolean {
    return this.walkers.some((w) => w.foe === foe);
  }

  // One that fights from afar, set on the hero: never a plain blow; held where it stood while the hero's within `max`
  // and in view (whatever the director made of it), backing away at `speed` once they're within `min`.
  standOff(foe: Enemy, min: number, max: number, speed: number, dt: number): void {
    const { hero, director } = this.fight;
    if (foe.state !== 'chase' || this.busy(foe)) return void this.stood.delete(foe);
    foe.cooldown = Math.max(foe.cooldown, 0.4);
    foe.swingFor = null;
    const was = this.stood.get(foe);
    if (was && this.far(was) <= max && director.inView(was, hero)) Object.assign(foe, was);
    const d = this.far(foe);
    if (d < min && d > 1e-6) director.move(foe, ((foe.x - hero.x) / d) * speed * dt, ((foe.z - hero.z) / d) * speed * dt);
    this.stood.set(foe, { x: foe.x, z: foe.z });
  }

  // How far a strip from (x, z) along (dx, dz) runs before the rock or something solid, `long` at most.
  reach(x: number, z: number, dx: number, dz: number, long: number): number {
    let d = 0;
    while (d + 0.2 <= long && !this.fight.blocked(x + dx * (d + 0.2), z + dz * (d + 0.2), 0.02)) d += 0.2;
    return d;
  }

  update(dt: number): void {
    const { hero, foes, hooks } = this.fight;
    this.clock += dt;
    this.marks.length = 0;
    this.walks(dt);
    const calling = new Set<Enemy>();
    for (const c of [...this.calls]) {
      const lost = c.foe.state === 'dead';
      const waits = calling.has(c.foe) || this.acts.some((a) => a.moves.doing(c.foe));
      calling.add(c.foe);
      if (waits && !lost) continue;
      if (c.t < 0) Object.assign(c, { x: c.foe.x, z: c.foe.z, t: 0 }); // (begun: planted where it stands now)
      c.t += dt;
      if (!lost && c.t < c.secs) Object.assign(c.foe, { x: c.x, z: c.z, swingFor: null, windUp: c.t, told: c.told });
      else {
        this.calls.splice(this.calls.indexOf(c), 1);
        Object.assign(c.foe, { windUp: null, told: null });
        if (!lost) c.then();
      }
    }
    for (const act of this.acts) {
      act.moves.update(foes, hero, dt, (foe) => this.busy(foe, act.moves) || !!act.unless?.(foe));
      for (const m of act.moves.moves) {
        const shape = m.t < act.move.tell ? act.mark?.(m) : null;
        if (shape) this.marks.push({ ...shape, k: m.t / act.move.tell });
      }
    }
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      if ((b.wait ?? 0) > 0) {
        b.wait! -= dt;
        continue;
      }
      b.t += dt;
      if (b.t < b.tell) {
        this.marks.push({ shape: 'ring', tone: b.tone ?? 'fire', x: b.x, z: b.z, r: b.r, k: b.t / b.tell });
        continue;
      }
      this.blasts.splice(i, 1);
      this.bursts.push({ x: b.x, z: b.z, r: b.r, age: 0 });
      if (this.far(b) < b.r) hooks.blow(b.by, b.damage, b.knock ? knockAway(b, hero, b.knock) : undefined);
      if (b.burn) this.burn(b.x, b.z, b.r * 0.85, b.burn, b.by);
      b.then?.();
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) if ((this.bursts[i].age += dt) > BURST_SHOWN) this.bursts.splice(i, 1);
    this.singe = Math.max(0, this.singe - dt);
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const fire = this.fires[i];
      fire.left -= dt;
      if (fire.left <= 0) this.fires.splice(i, 1);
      else if (this.singe === 0 && this.far(fire) < fire.r) {
        hooks.blow(fire.by, this.harm(fire.by, 0.35));
        this.singe = BURN_EVERY;
      }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) if (this.flown(this.shots[i], dt)) this.shots.splice(i, 1);
  }

  // A shot on: a bolt along its way (the run's to fly: struck, stopped or spent); a pot along its arc to where it bursts.
  private flown(shot: StrongholdShot, dt: number): boolean {
    const pot = this.pots.get(shot);
    if (!pot) return this.fight.fly(shot, BOLT, dt, () => this.fight.hooks.arrow(shot));
    shot.flown += dt;
    const p = Math.min(1, shot.flown / pot.time);
    Object.assign(shot, { x: pot.from.x + (pot.to.x - pot.from.x) * p, z: pot.from.z + (pot.to.z - pot.from.z) * p, high: Math.sin(Math.PI * p) });
    if (p >= 1) this.pots.delete(shot);
    return p >= 1;
  }

  private walks(dt: number): void {
    const { director, blocked } = this.fight;
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i];
      const { foe } = w;
      const done = (arrived: boolean) => {
        this.walkers.splice(this.walkers.indexOf(w), 1);
        w.then(arrived);
      };
      if (foe.state === 'dead') {
        this.walkers.splice(i, 1);
        continue;
      }
      Object.assign(foe, { x: w.at.x, z: w.at.z, state: 'wander', target: null, restFor: 1, swingFor: null, lastSeen: null, lostFor: 0 }); // (the director's steps undone: its own, from here)
      if (w.there(foe)) {
        done(true);
        continue;
      }
      w.age += dt;
      if (!w.path || w.age > PATH_EVERY) {
        w.path = findPath(foe, w.to(), PATH_RADIUS, (x, z) => !blocked(x, z, 0.16));
        w.age = 0;
      }
      while (w.path.length > 0 && this.far(w.path[0], foe) < 0.15) w.path.shift();
      const goal = w.path[0] ?? w.to();
      const d = this.far(goal, foe);
      const step = Math.min(w.speed * dt, d);
      if (d > 1e-4) director.move(foe, ((goal.x - foe.x) / d) * step, ((goal.z - foe.z) / d) * step);
      w.stuck = this.far(w.at, foe) < step * 0.3 ? w.stuck + dt : 0;
      w.at = { x: foe.x, z: foe.z };
      if (w.stuck > STUCK) done(false);
    }
  }
}

// A boss's fight, as it turns: met (set on the hero the first time), and each share of his health he's brought under.
export class Phases {
  phase = 0;
  met = false;

  constructor(
    readonly boss: Enemy,
    private readonly under: readonly number[], // shares of his health, falling: under each, the next phase
    private readonly meet: () => void,
    private readonly turn: (phase: number) => void,
  ) {}

  update(): void {
    const { boss } = this;
    if (boss.state === 'dead') return;
    if (!this.met && boss.state === 'chase') {
      this.met = true;
      this.meet();
    }
    while (this.phase < this.under.length && boss.hp <= boss.maxHp * this.under[this.phase]) this.turn(++this.phase);
  }
}
