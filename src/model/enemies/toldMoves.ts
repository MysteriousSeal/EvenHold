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
