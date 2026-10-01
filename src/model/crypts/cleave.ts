// A draugr's cleave (the crypts' draugr: cryptFoes.ts; its breath,
// frostBreath.ts): close to the hero, now and then, it plants its feet and
// raises its axe high (CLEAVE_TELL: a strip on the floor before it shows
// where it'll fall), then chops down along it: the hero still on the strip
// takes a double blow and is knocked back. Struck as it raises it, it's lost
// the blow. Never while it's drawing breath.

import type { Enemy, Hero } from '../types';

export const CLEAVE_TELL = 0.8; // seconds its raised axe and the strip show before the chop
export const CLEAVE_LENGTH = 1.9; // tiles the strip runs before it
export const CLEAVE_HALF = 0.32; // and half its width
export const CLEAVE_KNOCK = 0.5; // tiles the hero's knocked back
export const CLEAVE_AFTER = 0.45; // seconds from the chop it stays planted, getting its axe back up
const CLEAVE_EVERY = 6; // seconds between cleaves, at least
const NEAR = 1.6; // tiles from the hero for it to cleave

export interface Cleave {
  draugr: Enemy;
  x: number;
  z: number;
  dx: number; // its heading (a unit vector)
  dz: number;
  t: number; // seconds into its tell; past it, the chop (shown a moment)
}

export class Cleaves {
  readonly cleaves: Cleave[] = [];
  private readonly waits = new Map<Enemy, number>();

  // Each draugr's cleave started (not while `busy`: drawing breath), told and brought down.
  update(foes: readonly Enemy[], hero: Hero, dt: number, busy: (draugr: Enemy) => boolean, chop: (draugr: Enemy, cleave: Cleave) => void): void {
    for (const draugr of foes) {
      if (draugr.kind !== 'draugr') continue;
      const wait = Math.max(0, (this.waits.get(draugr) ?? CLEAVE_EVERY * 0.7) - dt);
      this.waits.set(draugr, wait);
      const d = Math.hypot(hero.x - draugr.x, hero.z - draugr.z);
      if (this.cleaves.some((c) => c.draugr === draugr) || busy(draugr) || draugr.state !== 'chase' || draugr.swingFor !== null || wait > 0 || d > NEAR || d < 1e-6) continue;
      this.cleaves.push({ draugr, x: draugr.x, z: draugr.z, dx: (hero.x - draugr.x) / d, dz: (hero.z - draugr.z) / d, t: 0 });
      this.waits.set(draugr, CLEAVE_EVERY);
    }
    for (let i = this.cleaves.length - 1; i >= 0; i--) {
      const cleave = this.cleaves[i];
      const before = cleave.t;
      cleave.t += dt;
      const { draugr } = cleave;
      if (draugr.state === 'dead' || (draugr.hurtFor > 0.2 && cleave.t < CLEAVE_TELL)) {
        this.cleaves.splice(i, 1); // (struck as it raised it, or slain: the blow's lost)
        Object.assign(draugr, { windUp: null, told: null });
        continue;
      }
      Object.assign(draugr, { x: cleave.x, z: cleave.z, swingFor: null, windUp: cleave.t, told: 'cleave' }); // (planted, the whole swing: raised, brought down, back up)
      if (before < CLEAVE_TELL && cleave.t >= CLEAVE_TELL && onStrip(cleave, hero)) chop(draugr, cleave);
      if (cleave.t >= CLEAVE_TELL + CLEAVE_AFTER) {
        this.cleaves.splice(i, 1);
        Object.assign(draugr, { windUp: null, told: null });
      }
    }
  }

  // Whether a draugr's raising its axe.
  cleaving(draugr: Enemy): boolean {
    return this.cleaves.some((c) => c.draugr === draugr);
  }
}

// Whether the hero's on the strip the axe comes down along.
export function onStrip(cleave: Pick<Cleave, 'x' | 'z' | 'dx' | 'dz'>, hero: { x: number; z: number }): boolean {
  const [hx, hz] = [hero.x - cleave.x, hero.z - cleave.z];
  const along = hx * cleave.dx + hz * cleave.dz;
  const across = Math.abs(hx * cleave.dz - hz * cleave.dx);
  return along >= -0.1 && along <= CLEAVE_LENGTH && across <= CLEAVE_HALF + 0.1;
}
