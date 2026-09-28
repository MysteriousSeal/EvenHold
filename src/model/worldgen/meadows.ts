// Meadow density: a low-frequency noise map of where grass grows lush and
// where the ground is bare. Drives both the (visual) grass clumps and the
// (solid) bushes along meadow edges. Seeded from the world seed through
// its own rng, so it never shifts the main world-generation stream.

import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from '../../util/random';

const MEADOW_SCALE = 9; // wavelength of the lush / bare patches, in tiles
const MEADOW_SEED_SALT = 0x9e3779b9;

export type MeadowDensity = (x: number, z: number) => number;

// Returns a function giving 0 on bare ground up to 1 in the lushest meadow.
// The noise is shifted down a little so bare areas are common and meadows
// have soft edges.
export function createMeadowDensity(seed: number): MeadowDensity {
  const noise2D = createNoise2D(mulberry32(seed ^ MEADOW_SEED_SALT));
  return (x, z) => Math.min(1, Math.max(0, (noise2D(x / MEADOW_SCALE, z / MEADOW_SCALE) + 0.2) / 0.8));
}
