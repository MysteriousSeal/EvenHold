// Tree placement. Depends on the height grid, lake map, and house cells.

import { MAP_WIDTH, MAP_DEPTH, MAX_HEIGHT, TREE_CHANCE } from '../constants';
import { cellKey } from '../grid';
import type { Tree } from '../types';

// Runs after villages so it can avoid growing a tree through a house.
export function generateTrees(
  heightMap: number[][],
  lakeMap: boolean[][],
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
      // Skip lakes, houses, the highest tier (bare summit), and the hero's spawn cell.
      const isSpawn = x === spawnX && z === spawnZ;
      const isBlocked = lakeMap[x][z] || blockedCells.has(cellKey(x, z));
      if (!isBlocked && h < MAX_HEIGHT && !isSpawn && roll < TREE_CHANCE) {
        const rotationY = rng() * Math.PI * 2;
        const scale = 0.85 + rng() * 0.3;
        trees.push({ x, z, groundHeight: h, rotationY, scale });
      }
    }
  }
  return trees;
}
