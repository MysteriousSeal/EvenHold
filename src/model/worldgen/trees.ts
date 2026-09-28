// Tree placement. Depends on the height grid, lake map, and house cells.

import { MAP_WIDTH, MAP_DEPTH, MAX_TIER, TREE_CHANCE, TREE_SHAPES } from '../constants';
import { cellKey } from '../grid';
import { hashCell } from '../../util/random';
import type { Surface, Tree, TreeKind } from '../types';

const HIGH_GROUND_TIER = 3; // pines dominate from here up, oaks below

function pickKind(tier: number, roll: number): TreeKind {
  const pineChance = tier >= HIGH_GROUND_TIER ? 0.8 : 0.15;
  return roll < pineChance ? 'pine' : 'oak';
}

// Runs after villages and trails, so trees stay off houses, wells, paths and squares.
export function generateTrees(
  heightMap: number[][],
  lakeMap: boolean[][],
  surfaceMap: Surface[][],
  blockedCells: ReadonlySet<string>,
  rng: () => number,
  spawnX: number,
  spawnZ: number,
): Tree[] {
  const trees: Tree[] = [];
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      const h = heightMap[x][z];
      const roll = rng();
      // Skip lakes, paths/squares, buildings, the highest tier (bare summit), and the spawn cell.
      const isSpawn = x === spawnX && z === spawnZ;
      const isBlocked = lakeMap[x][z] || surfaceMap[x][z] !== 'natural' || blockedCells.has(cellKey(x, z));
      if (!isBlocked && h < MAX_TIER && !isSpawn && roll < TREE_CHANCE) {
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
