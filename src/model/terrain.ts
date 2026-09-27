// Base terrain height generation and smoothing. Pure functions over a
// height grid — no lake/tree/hero knowledge.

import { MAP_WIDTH, MAP_DEPTH, MAX_HEIGHT, NOISE_SCALE } from './constants';

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
// propagate both ways, so the grid reaches a fully stable state (no
// violations left anywhere) in a handful of passes instead of needing one
// pass per row/column of the map.
export function smoothHeightMap(map: number[][]): void {
  const offsets: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let iteration = 0; iteration < 16; iteration++) {
    let changed = false;
    const reverse = iteration % 2 === 1;

    for (let xi = 0; xi < MAP_WIDTH; xi++) {
      const x = reverse ? MAP_WIDTH - 1 - xi : xi;
      for (let zi = 0; zi < MAP_DEPTH; zi++) {
        const z = reverse ? MAP_DEPTH - 1 - zi : zi;

        const neighborHeights: number[] = [];
        for (const [dx, dz] of offsets) {
          const nx = x + dx;
          const nz = z + dz;
          if (nx >= 0 && nx < MAP_WIDTH && nz >= 0 && nz < MAP_DEPTH) {
            neighborHeights.push(map[nx][nz]);
          }
        }
        if (neighborHeights.length === 0) continue;

        const minNeighbor = Math.min(...neighborHeights);
        const maxNeighbor = Math.max(...neighborHeights);
        const h = map[x][z];

        // h must be within 1 of every neighbor at once, i.e. within
        // [maxNeighbor - 1, minNeighbor + 1]. Checking only against the
        // aggregate min/max (the old approach) misses a cell sitting
        // "between" two neighbors that are themselves far apart — e.g.
        // heights 0, 2, 4 in a row: the middle 2 looks fine against the
        // {0, 4} range but is still 2 away from each individually.
        const targetLow = maxNeighbor - 1;
        const targetHigh = minNeighbor + 1;

        let next: number;
        if (targetLow <= targetHigh) {
          next = Math.min(targetHigh, Math.max(targetLow, h));
        } else {
          // The neighbors themselves are more than 2 apart, so no single h
          // can satisfy both; nudge toward their midpoint and let the
          // neighbors converge toward each other over later passes.
          next = Math.round((minNeighbor + maxNeighbor) / 2);
        }

        if (next !== h) {
          changed = true;
          map[x][z] = next;
        }
      }
    }

    if (!changed) break;
  }
}
