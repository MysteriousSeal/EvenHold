// Base terrain height generation and smoothing. Pure functions over a
// height grid — no lake/tree/hero knowledge.

import { MAP_WIDTH, MAP_DEPTH, MAX_HEIGHT, NOISE_SCALE } from '../constants';
import { NEIGHBORS_4, inBounds } from '../grid';

export function generateHeightMap(noise2D: (x: number, y: number) => number): number[][] {
  const map: number[][] = [];
  for (let x = 0; x < MAP_WIDTH; x++) {
    const row: number[] = [];
    for (let z = 0; z < MAP_DEPTH; z++) {
      const base = noise2D(x / NOISE_SCALE, z / NOISE_SCALE);
      const detail = noise2D(x / (NOISE_SCALE / 3), z / (NOISE_SCALE / 3)) * 0.3;
      const normalized = Math.min(1, Math.max(0, (base + detail + 1.3) / 2.6));
      const h = Math.min(MAX_HEIGHT, Math.floor(normalized * (MAX_HEIGHT + 1)));
      row.push(h);
    }
    map.push(row);
  }
  return map;
}

// Caps the height difference between orthogonal neighbors at 1 tier, in
// place. Raw noise occasionally drops a single cell 2+ tiers below every
// neighbor (or spikes one above), producing a walled-in pit or a lone
// tower after flooring to integer tiers. This fills/shaves those outliers
// so every step in the terrain is walkable.
//
// Each pass sweeps in-place (Gauss-Seidel style), so a height correction
// only propagates in the direction of the sweep within a single pass.
// Alternating the sweep direction every iteration lets corrections
// propagate both ways, so the grid reaches a fully stable state in a
// handful of passes instead of needing one pass per row/column of the map.
export function smoothHeightMap(map: number[][]): void {
  for (let iteration = 0; iteration < 16; iteration++) {
    let changed = false;
    const reverse = iteration % 2 === 1;

    for (let xi = 0; xi < MAP_WIDTH; xi++) {
      const x = reverse ? MAP_WIDTH - 1 - xi : xi;
      for (let zi = 0; zi < MAP_DEPTH; zi++) {
        const z = reverse ? MAP_DEPTH - 1 - zi : zi;

        let minNeighbor = Infinity;
        let maxNeighbor = -Infinity;
        for (const [dx, dz] of NEIGHBORS_4) {
          if (!inBounds(x + dx, z + dz)) continue;
          const nh = map[x + dx][z + dz];
          minNeighbor = Math.min(minNeighbor, nh);
          maxNeighbor = Math.max(maxNeighbor, nh);
        }

        // h must be within 1 of every neighbor at once, i.e. within
        // [maxNeighbor - 1, minNeighbor + 1]. Checking only against the
        // aggregate min/max misses a cell sitting "between" two neighbors
        // that are themselves far apart — e.g. heights 0, 2, 4 in a row.
        const h = map[x][z];
        const targetLow = maxNeighbor - 1;
        const targetHigh = minNeighbor + 1;

        const next =
          targetLow <= targetHigh
            ? Math.min(targetHigh, Math.max(targetLow, h))
            : // Neighbors are more than 2 apart, so no single h satisfies both;
              // nudge toward their midpoint and let them converge over later passes.
              Math.round((minNeighbor + maxNeighbor) / 2);

        if (next !== h) {
          changed = true;
          map[x][z] = next;
        }
      }
    }

    if (!changed) break;
  }
}
