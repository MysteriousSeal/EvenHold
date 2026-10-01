// A draugr's frost breath (the crypts' draugr: cryptFoes.ts). Close to the
// hero, now and then, it stops and draws breath (BREATH_TELL: a moment to step
// aside), then breathes frost in a cone before it, the way it faced as it
// drew: caught in it, the hero takes a little harm and is Chilled, slowed a
// while (CHILL_FOR: a bane, as a fall's Weary is: hero/blessing.ts).

import type { Enemy, Hero } from '../types';

export const BREATH_TELL = 0.75; // seconds its drawn breath shows before the frost
export const BREATH_REACH = 2.6; // tiles the frost reaches
export const BREATH_WIDTH = 0.65; // radians either side of its heading the cone spreads
export const CHILL_FOR = 4; // seconds the hero's slowed
const BREATH_EVERY = 7; // seconds between breaths, at least
const NEAR = 2.2; // tiles from the hero for it to breathe

export interface Breath {
  draugr: Enemy;
  x: number;
  z: number;
  dx: number; // its heading (a unit vector)
  dz: number;
  t: number; // seconds into its tell; past it, the frost (shown a moment)
}

export class FrostBreaths {
  readonly breaths: Breath[] = [];
  private readonly waits = new Map<Enemy, number>();

  // Each draugr's breath started, told and loosed.
  update(foes: readonly Enemy[], hero: Hero, dt: number, frost: (draugr: Enemy) => void, busy: (draugr: Enemy) => boolean = () => false): void {
    for (const draugr of foes) {
      if (draugr.kind !== 'draugr') continue;
      const wait = Math.max(0, (this.waits.get(draugr) ?? BREATH_EVERY / 2) - dt);
      this.waits.set(draugr, wait);
      const d = Math.hypot(hero.x - draugr.x, hero.z - draugr.z);
      const breathing = this.breaths.some((b) => b.draugr === draugr);
      if (breathing || busy(draugr) || draugr.state !== 'chase' || draugr.swingFor !== null || wait > 0 || d > NEAR || d < 1e-6) continue;
      this.breaths.push({ draugr, x: draugr.x, z: draugr.z, dx: (hero.x - draugr.x) / d, dz: (hero.z - draugr.z) / d, t: 0 });
      this.waits.set(draugr, BREATH_EVERY);
    }
    for (let i = this.breaths.length - 1; i >= 0; i--) {
      const breath = this.breaths[i];
      const before = breath.t;
      breath.t += dt;
      const { draugr } = breath;
      if (draugr.state === 'dead' || draugr.hurtFor > 0.2) {
        this.breaths.splice(i, 1); // (struck, or slain: it's lost its breath)
        Object.assign(draugr, { windUp: null, told: null });
        continue;
      }
      Object.assign(draugr, { x: breath.x, z: breath.z, swingFor: null, windUp: breath.t < BREATH_TELL ? breath.t : null, told: breath.t < BREATH_TELL ? 'breath' : null }); // (still, breathing)
      if (before < BREATH_TELL && breath.t >= BREATH_TELL && caught(breath, hero)) frost(draugr);
      if (breath.t >= BREATH_TELL + 0.5) this.breaths.splice(i, 1);
    }
  }
}

// Whether the hero's in the frost's cone.
export function caught(breath: Pick<Breath, 'x' | 'z' | 'dx' | 'dz'>, hero: { x: number; z: number }): boolean {
  const [hx, hz] = [hero.x - breath.x, hero.z - breath.z];
  const d = Math.hypot(hx, hz);
  if (d > BREATH_REACH) return false;
  if (d < 0.3) return true;
  return Math.acos(Math.max(-1, Math.min(1, (hx * breath.dx + hz * breath.dz) / d))) <= BREATH_WIDTH;
}
