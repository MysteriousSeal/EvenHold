// How animals get about, the same for all: stepping toward a spot (axis by
// axis, sliding along what they can't cross), where to run from the hero,
// and rolls from where they stand, so choices vary as they move but repeat exactly.

import { hashUnit } from '../../util/random';
import type { Wildlife } from './animal';

type Fits = (x: number, z: number) => boolean;

// Heads toward (tx, tz) at up to `speed` where it `fits`, facing the way it
// went, standing on `groundY` if given (not afloat); returns how far it went.
export function stepToward(animal: Wildlife, fits: Fits, tx: number, tz: number, speed: number, dt: number, groundY?: (x: number, z: number) => number): number {
  const [dx, dz] = [tx - animal.x, tz - animal.z];
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return 0;
  const step = Math.min(speed * dt, d);
  const [x0, z0] = [animal.x, animal.z];
  if (fits(animal.x + (dx / d) * step, animal.z)) animal.x += (dx / d) * step;
  if (fits(animal.x, animal.z + (dz / d) * step)) animal.z += (dz / d) * step;
  const moved = Math.hypot(animal.x - x0, animal.z - z0);
  if (moved > 1e-6) {
    animal.heading = Math.atan2(animal.x - x0, animal.z - z0);
    if (groundY) animal.y = groundY(animal.x, animal.z);
  }
  return moved;
}

// Somewhere `distance` away from the hero where it fits: straight away if
// there's room, else turning a little either way, else closer.
export function fleeTarget(animal: Wildlife, hero: { x: number; z: number }, distance: number, fits: Fits): { x: number; z: number } | null {
  const away = Math.atan2(animal.x - hero.x, animal.z - hero.z);
  for (const reach of [distance, distance * 0.6, distance * 0.35]) {
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
      const [x, z] = [animal.x + Math.sin(away + turn) * reach, animal.z + Math.cos(away + turn) * reach];
      if (fits(x, z)) return { x, z };
    }
  }
  return null;
}

export const rollAt = (animal: Wildlife, salt: number) => hashUnit(Math.round(animal.x * 100), Math.round(animal.z * 100), salt + animal.id);
