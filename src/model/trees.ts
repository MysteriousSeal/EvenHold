// Tree placement. Depends on the height grid and lake map.

import { MAP_WIDTH, MAP_DEPTH, MAX_HEIGHT, TREE_CHANCE } from './constants';
import type { Tree } from './types';

// Reuses the same rng stream right after height-map generation, so tree
// placement stays fully determined by the seed.
export function generateTrees(
  heightMap: number[][],
  lakeMap: boolean[][],
  rng: () => number,
  spawnX: number,
  spawnZ: number,
): Tree[] {
  const trees: Tree[] = [];
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      const h = heightMap[x][z];
      const roll = rng();
      // Skip lakes, skip the highest tier (bare summit), skip the hero's spawn cell.
      const isSpawn = x === spawnX && z === spawnZ;
      if (!lakeMap[x][z] && h < MAX_HEIGHT && !isSpawn && roll < TREE_CHANCE) {
        const rotationY = rng() * Math.PI * 2;
        const scale = 0.85 + rng() * 0.3;
        trees.push({ x, z, groundHeight: h, rotationY, scale });
      }
    }
  }
  return trees;
}
