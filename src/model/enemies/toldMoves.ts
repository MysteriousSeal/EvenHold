// A foe's told move (any foe's: a crypt lord's slam, crypts/cryptLord.ts; a draugr's frost
// breath, crypts/frostBreath.ts, and cleave, crypts/cleave.ts): close to the hero, chasing,
// not mid-blow, its wait over, it plants its feet and shows what's coming (its
// tell: windUp and told on it, for its look), the way it faces fixed as it
// starts; at the tell's end it lands on the hero if they're still where it
// falls (`hits`); a moment after (`after`), it's done. Struck during its tell,
// it's lost (unless `staunch`). One foe, one move at a time (`busy`: another's).

import type { Enemy, Hero } from '../types';

export interface Told {
  foe: Enemy;
  x: number; // where it stands (planted there)
  z: number;
  dx: number; // the way it faces (a unit vector)
  dz: number;
  tx: number; // where the hero stood as it began (what it aims at: a lord's bones bursting up there)
  tz: number;
  t: number; // seconds into it: its tell, then after it
}

export interface ToldMove {
  told: NonNullable<Enemy['told']>;
  by: Enemy['kind']; // who does it
  tell: number; // seconds it's told before it lands
  after: number; // seconds it's still planted after
  every: number; // seconds between, at least
  first: number; // seconds before the first
  near: number; // tiles from the hero, at most, to start
  far?: number; // and at least (a move done from afar)
  path?(move: Told, t: number): { x: number; z: number }; // where it's carried, past its tell (a charge), else held where it began
  staunch?: boolean; // not lost to a blow
  hits(move: Told, hero: { x: number; z: number }): boolean;
}

export class ToldMoves {
  readonly moves: Told[] = [];
  private readonly waits = new Map<Enemy, number>();

  constructor(
    private readonly move: ToldMove,
    private readonly land: (foe: Enemy, move: Told) => void,
  ) {}

  // Whether `foe` is doing it.
  doing(foe: Enemy): boolean {
    return this.moves.some((m) => m.foe === foe);
  }

  // Each foe's started (not while `busy`), told, landed, done.
  update(foes: readonly Enemy[], hero: Hero, dt: number, busy: (foe: Enemy) => boolean = () => false): void {
    const { move } = this;
    for (const foe of foes) {
      if (foe.kind !== move.by || foe.state === 'dead') continue;
      const wait = Math.max(0, (this.waits.get(foe) ?? move.first) - dt);
      this.waits.set(foe, wait);
      const d = Math.hypot(hero.x - foe.x, hero.z - foe.z);
      if (wait > 0 || this.doing(foe) || busy(foe) || foe.state !== 'chase' || foe.swingFor !== null || d > move.near || d < (move.far ?? 1e-6)) continue;
      this.moves.push({ foe, x: foe.x, z: foe.z, dx: (hero.x - foe.x) / d, dz: (hero.z - foe.z) / d, tx: hero.x, tz: hero.z, t: 0 });
      this.waits.set(foe, move.every);
    }
    for (let i = this.moves.length - 1; i >= 0; i--) {
      const m = this.moves[i];
      const before = m.t;
      m.t += dt;
      const { foe } = m;
      const lost = foe.state === 'dead' || (!move.staunch && foe.hurtFor > 0.2 && m.t < move.tell);
      if (!lost) {
        const at = move.path && m.t > move.tell ? move.path(m, m.t - move.tell) : m;
        Object.assign(foe, { x: at.x, z: at.z, swingFor: null, windUp: m.t, told: move.told }); // (planted, or carried along its path)
        if (before < move.tell && m.t >= move.tell && move.hits(m, hero)) this.land(foe, m); // (landed before it's done: a move with no after)
      }
      if (lost || m.t >= move.tell + move.after) {
        this.moves.splice(i, 1);
        Object.assign(foe, { windUp: null, told: null });
      }
    }
  }
}

// ---- What told moves are made of (the caves', the wild beasts'): a foe carried along (a leap, a rush), a strip it
// sweeps, a knock away. ----

type Blocked = (x: number, z: number) => boolean;
type Shape = Omit<ToldMove, 'path' | 'hits'>;

// Where a move carrying its foe has it `t` past its tell: on along the way it faced, `long` at most (over `time`
// seconds), stopped short of what's in the way (`blocked`: whether it'd be in it there).
export const carried = (blocked: Blocked, long: (m: Told) => number, time: number) => (m: Told, t: number) => {
  const want = Math.min(1, t / time) * long(m);
  let gone = 0;
  while (gone + 0.1 <= want && !blocked(m.x + m.dx * (gone + 0.1), m.z + m.dz * (gone + 0.1))) gone += 0.1;
  return { x: m.x + m.dx * gone, z: m.z + m.dz * gone };
};

// A leap at the hero (a spider's lunge, a lynx's pounce): told, then a spring at where they stood (that far and a
// little, `reach` at most, over `time`), its bite within `bite` of where it lands.
export function leap(shape: Shape, blocked: Blocked, { reach, time, bite }: { reach: number; time: number; bite: number }): ToldMove {
  const path = carried(blocked, (m) => Math.min(reach, Math.hypot(m.tx - m.x, m.tz - m.z) + 0.3), time);
  return { ...shape, path, hits: (m, hero) => {
    const at = path(m, time);
    return Math.hypot(hero.x - at.x, hero.z - at.z) < bite;
  } };
}

// A rush down a strip at the hero (a brood mother's charge, a bear's): told, then `long` on along it at most (over
// `time`), stopped at what's in the way; the hero caught if they're on the strip it covers (`half` its half-width).
export function rush(shape: Shape, blocked: Blocked, { long, time, half }: { long: number; time: number; half: number }): ToldMove {
  const path = carried(blocked, () => long, time);
  return { ...shape, path, hits: (m, hero) => {
    const end = path(m, time);
    return onStrip(m, hero, Math.hypot(end.x - m.x, end.z - m.z) + half, half);
  } };
}

// Whether `at` is on the strip a move sweeps: ahead of where it began, within `long` of it along its way, `half` either side.
export function onStrip(m: Pick<Told, 'x' | 'z' | 'dx' | 'dz'>, at: { x: number; z: number }, long: number, half: number): boolean {
  const [px, pz] = [at.x - m.x, at.z - m.z];
  const ahead = px * m.dx + pz * m.dz;
  return ahead > 0 && ahead < long && Math.abs(px * m.dz - pz * m.dx) < half;
}

// Which way, and how far, the hero's knocked: straight away from `from` (right on it: back along +z).
export function knockAway(from: { x: number; z: number }, hero: { x: number; z: number }, far: number): { dx: number; dz: number } {
  const d = Math.hypot(hero.x - from.x, hero.z - from.z);
  if (d < 1e-6) return { dx: 0, dz: far };
  return { dx: ((hero.x - from.x) / d) * far, dz: ((hero.z - from.z) / d) * far };
}
