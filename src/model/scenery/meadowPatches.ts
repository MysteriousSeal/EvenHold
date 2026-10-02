// Where the meadow patches of wildflowers grow (drawn by the ground cover:
// view/meshes/cover/groundCoverScatter.ts), from the seed: a noise of its
// own, its peaks the patches (thick in their middles, thinning to their
// edges); and which kind of flower each stretch of country has. Kept here so
// what's drawn and what's looked for (the cheats' Sights) are the one.

import { createNoise2D } from 'simplex-noise';
import { hashUnit, mulberry32 } from '../../util/random';

export const BLOOMS = ['poppy', 'bluebell', 'daisy', 'buttercup', 'foxglove', 'lavender', 'clover'] as const;
export type BloomKind = (typeof BLOOMS)[number];

const SALT = 0x5bd1e995;
const SCALE = 14; // tiles: how wide the patches run
const FROM = 0.45; // the noise over this: a patch
const KIND_CELL = 20; // tiles a side of each stretch of country with its own kind of flower

export interface MeadowPatches {
  strength(x: number, z: number): number; // 0 outside a patch, up to 1 in its middle
  kind(x: number, z: number): number; // the flower of the country round (x, z), by its index in BLOOMS
}

export function meadowPatches(seed: number): MeadowPatches {
  const noise = createNoise2D(mulberry32(seed ^ SALT));
  return {
    strength: (x, z) => Math.max(0, (noise(x / SCALE, z / SCALE) - FROM) / (1 - FROM)),
    kind: (x, z) => Math.floor(hashUnit(Math.floor(x / KIND_CELL), Math.floor(z / KIND_CELL), seed + 77) * BLOOMS.length),
  };
}
