// Bush placement: solid voxel bushes along meadow edges, where lush grass
// thins out into bare ground, framing the meadows. Runs last, after trees.
// Each cell rolls from a hash of its position rather than the world rng,
// so adding bushes didn't reshuffle any seed's existing map.

import { BUSH_CHANCE, BUSH_SHAPES } from '../constants';
import { cellKey } from '../grid';
import { hashCell, mulberry32 } from '../../util/random';
import type { Bush, BushKind, Surface, Tree } from '../types';
import type { MeadowDensity } from './meadows';

const EDGE_MIN = 0.05; // meadow density band counted as "edge"
const EDGE_MAX = 0.35;
const BUSH_SALT = 3;

function pickKind(roll: number): BushKind {
  if (roll < 0.5) return 'leafy';
  return roll < 0.75 ? 'berry' : 'flowering';
}

export function generateBushes(
  heightMap: number[][],
  lakeMap: boolean[][],
  surfaceMap: Surface[][],
  blockedCells: ReadonlySet<string>,
  trees: Tree[],
  meadowDensity: MeadowDensity,
  spawnX: number,
  spawnZ: number,
): Bush[] {
  const treeCells = new Set(trees.map((t) => cellKey(t.x, t.z)));
  const bushes: Bush[] = [];

  for (let x = 0; x < heightMap.length; x++) {
    for (let z = 0; z < heightMap[x].length; z++) {
      if (lakeMap[x][z] || surfaceMap[x][z] !== 'natural') continue;
      if (blockedCells.has(cellKey(x, z)) || treeCells.has(cellKey(x, z))) continue;
      // Keep the spawn tile and its neighbors clear so the hero never starts boxed in.
      if (Math.abs(x - spawnX) <= 1 && Math.abs(z - spawnZ) <= 1) continue;

      const density = meadowDensity(x, z);
      if (density < EDGE_MIN || density > EDGE_MAX) continue;

      const rng = mulberry32(hashCell(x, z, BUSH_SALT));
      if (rng() >= BUSH_CHANCE) continue;
      bushes.push({
        x,
        z,
        groundTier: heightMap[x][z],
        kind: pickKind(rng()),
        shape: Math.floor(rng() * BUSH_SHAPES),
        quarterTurns: Math.floor(rng() * 4),
      });
    }
  }
  return bushes;
}
