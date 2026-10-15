// The country's lie, tile by tile: which stretch of wild land each tile is part of. Five kinds:
// - forest: deep woods, where the trees grow thick (their own forest noise: worldgen/trees.ts, so the woods drawn
//   dark are the woods that are there);
// - marsh: low, wet ground (the two lowest tiers) where a damp noise runs high, and the low banks by the lakes;
// - hills: the high ground (from the tier the pines take over), rocky where a rough noise says so;
// - heath: a moor of heather and gorse, on dry ground off the low land, and the highest tier's open tops;
// - meadow: all the rest, open grassland.
// Purely the land's look and what grows on it that no one walks into (and the odd rock or dead tree placed last of
// all: scenery.ts placeBiomeScenery): from the seed's own noises, never the world's rng, so every map keeps its trees,
// villages, roads and lakes. Edges ragged by a roll a tile, never a straight line. Made the same for any part of the
// map (a streamed world's region, a chunk) as for the whole.

import { createNoise2D } from 'simplex-noise';
import { hashUnit, mulberry32 } from '../../util/random';
import { createForestDensity } from '../worldgen/trees';
import { MAX_TIER, TREE_CHANCE } from '../constants';
import type { Tiles } from '../map/tiles';

export const BIOMES = ['meadow', 'forest', 'heath', 'marsh', 'hills'] as const;
export type Biome = (typeof BIOMES)[number];

const DAMP_SALT = 0x2c1b3c6d;
const DRY_SALT = 0x297a2d39;
const ROUGH_SALT = 0x1b873593;
const DAMP_SCALE = 60; // tiles: how wide the wet and dry stretches run
const ROUGH_SCALE = 34;
const RAGGED = 0.15; // a tile's own roll, added to the noises: the edges a dithered strip a few tiles wide
const FOREST_CHANCE = 0.5; // a tree's chance deep in a forest (worldgen/trees.ts: not changed there, its source is the world cache's fingerprint)
const DEEP_WOODS = 0.5; // of the way from open country's tree chance to a forest's: the deep woods from here
const MARSH_DAMP = -0.05; // the damp noise over this, on low ground: marsh
const BANK_DAMP = -0.5; // and by a lake, over this
const LOW_TIER = 1; // marsh on this tier and below
const HIGH_TIER = 3; // hills on this tier and above (where the pines take over: worldgen/trees.ts)
const HILLS_ROUGH = 0.2; // the rough noise over this, on high ground: hills
const HEATH_DRY = 0.3; // the dry noise over this, off the low ground: heath

export interface BiomeMap {
  at(x: number, z: number): Biome; // the kind of country at tile (x, z) (a tile off the map: meadow)
  woods(x: number, z: number): number; // how deep in the woods (x, z) is: 0 in the open, 1 in the thick of a forest
}

export function createBiomes(seed: number, tiles: Tiles): BiomeMap {
  const forest = createForestDensity(seed);
  const damp = createNoise2D(mulberry32(seed ^ DAMP_SALT));
  const dry = createNoise2D(mulberry32(seed ^ DRY_SALT));
  const rough = createNoise2D(mulberry32(seed ^ ROUGH_SALT));
  const woods = (x: number, z: number) => Math.min(1, Math.max(0, (forest(x, z) - TREE_CHANCE) / (FOREST_CHANCE - TREE_CHANCE)));
  const byLake = (x: number, z: number) => {
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) if (tiles.has(x + dx, z + dz) && tiles.lake(x + dx, z + dz)) return true;
    return false;
  };
  return {
    woods,
    at(x, z) {
      if (!tiles.has(x, z)) return 'meadow';
      const jitter = (hashUnit(x, z, seed + 0xb10) - 0.5) * 2 * RAGGED;
      if (woods(x, z) + jitter > DEEP_WOODS) return 'forest';
      const tier = tiles.height(x, z);
      if (tier <= LOW_TIER) {
        const wet = damp(x / DAMP_SCALE, z / DAMP_SCALE) + jitter;
        if (wet > MARSH_DAMP || (wet > BANK_DAMP && byLake(x, z))) return 'marsh';
      }
      if (tier >= HIGH_TIER && rough(x / ROUGH_SCALE, z / ROUGH_SCALE) + jitter > HILLS_ROUGH) return 'hills';
      if (tier >= MAX_TIER || (tier > LOW_TIER && dry(x / DAMP_SCALE, z / DAMP_SCALE) + jitter > HEATH_DRY)) return 'heath';
      return 'meadow';
    },
  };
}
