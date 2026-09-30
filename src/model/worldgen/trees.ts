// Tree placement. Depends on the height grid, lake map, and house cells.
// Trees are scattered thinly everywhere, and grow dense in the occasional
// forest: patches of a low-frequency noise seeded from the world seed
// through its own rng, so it never shifts the main world-generation stream.

import { MAX_TIER, TREE_CHANCE, TREE_SHAPES } from '../constants';
import { cellLookup, sizeOf } from '../map/grid';
import { createNoise2D } from 'simplex-noise';
import { hashCell, mulberry32 } from '../../util/random';
import type { Surface, Tree, TreeKind } from '../types';

const HIGH_GROUND_TIER = 3; // pines dominate from here up, oaks below
const FOREST_SCALE = 16; // wavelength of forest patches, in tiles
const FOREST_THRESHOLD = 0.45; // noise above this is forest (roughly a tenth of the map)
const FOREST_EDGE = 0.2; // noise range over which density ramps up at a forest's edge
const FOREST_CHANCE = 0.5; // tree chance deep in a forest
const FOREST_SEED_SALT = 0x7f4a7c15;

export type ForestDensity = (x: number, z: number) => number;

// Tree chance per tile: TREE_CHANCE in the open, ramping up to
// FOREST_CHANCE inside forests.
export function createForestDensity(seed: number): ForestDensity {
  const noise2D = createNoise2D(mulberry32(seed ^ FOREST_SEED_SALT));
  return (x, z) => {
    const t = Math.min(1, Math.max(0, (noise2D(x / FOREST_SCALE, z / FOREST_SCALE) - FOREST_THRESHOLD) / FOREST_EDGE));
    return TREE_CHANCE + (FOREST_CHANCE - TREE_CHANCE) * t;
  };
}

const BIRCH_CHANCE = 0.2; // share of the rest that are birches instead of oaks

// One roll decides the kind, so adding birches didn't change any draw from
// the world rng: some former oaks became birches, everything else stayed.
function pickKind(tier: number, roll: number): TreeKind {
  const pineChance = tier >= HIGH_GROUND_TIER ? 0.8 : 0.15;
  if (roll < pineChance) return 'pine';
  return roll < pineChance + BIRCH_CHANCE ? 'birch' : 'oak';
}

// Runs after villages and trails, so trees stay off houses, wells, paths and squares.
export function generateTrees(
  heightMap: number[][],
  lakeMap: boolean[][],
  surfaceMap: Surface[][],
  blockedCells: ReadonlySet<string>,
  rng: () => number,
  forestDensity: ForestDensity,
  spawnX: number,
  spawnZ: number,
): Tree[] {
  const trees: Tree[] = [];
  const blocked = cellLookup(sizeOf(heightMap), blockedCells);
  for (let x = 0; x < heightMap.length; x++) {
    for (let z = 0; z < heightMap[x].length; z++) {
      const h = heightMap[x][z];
      const roll = rng();
      // Skip lakes, paths/squares, buildings, the highest tier (bare summit), and the spawn cell.
      const isSpawn = x === spawnX && z === spawnZ;
      // Cheapest tests first: the forest noise is only sampled when the roll
      // could possibly pass (density never exceeds FOREST_CHANCE).
      if (roll >= FOREST_CHANCE || isSpawn || h >= MAX_TIER) continue;
      if (lakeMap[x][z] || surfaceMap[x][z] !== 'natural' || blocked(x, z)) continue;
      if (roll < forestDensity(x, z)) {
        // Exactly two rng draws per tree, as before voxel trees existed, so
        // every seed keeps its tree positions (and all later rng draws).
        const quarterTurns = Math.floor(rng() * 4);
        const kind = pickKind(h, rng());
        const shape = hashCell(x, z, 4) % TREE_SHAPES;
        trees.push({ x, z, groundTier: h, kind, shape, quarterTurns });
      }
    }
  }
  return trees;
}
