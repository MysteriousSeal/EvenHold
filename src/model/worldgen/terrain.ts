// Base terrain height generation and smoothing. Pure functions over a
// height grid — no lake/tree/hero knowledge.

import { MAX_TIER, NOISE_SCALE } from '../constants';
import { sizeOf, type MapSize } from '../map/grid';

export function generateHeightMap(noise2D: (x: number, y: number) => number, size: MapSize): number[][] {
  const map: number[][] = new Array(size.width);
  for (let x = 0; x < size.width; x++) {
    const row: number[] = new Array(size.depth);
    for (let z = 0; z < size.depth; z++) {
      const base = noise2D(x / NOISE_SCALE, z / NOISE_SCALE);
      const detail = noise2D(x / (NOISE_SCALE / 3), z / (NOISE_SCALE / 3)) * 0.3;
      const normalized = Math.min(1, Math.max(0, (base + detail + 1.3) / 2.6));
      const h = Math.min(MAX_TIER, Math.floor(normalized * (MAX_TIER + 1)));
      row[z] = h;
    }
    map[x] = row;
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
  const { width, depth } = sizeOf(map);
  for (let iteration = 0; iteration < 16; iteration++) {
    let changed = false;
    const reverse = iteration % 2 === 1;

    for (let xi = 0; xi < width; xi++) {
      const x = reverse ? width - 1 - xi : xi;
      for (let zi = 0; zi < depth; zi++) {
        const z = reverse ? depth - 1 - zi : zi;

        // Its four neighbors on the map (written out, not looped: this runs millions of times).
        let minNeighbor = Infinity;
        let maxNeighbor = -Infinity;
        const column = map[x];
        if (x + 1 < width) {
          const nh = map[x + 1][z];
          if (nh < minNeighbor) minNeighbor = nh;
          if (nh > maxNeighbor) maxNeighbor = nh;
        }
        if (x > 0) {
          const nh = map[x - 1][z];
          if (nh < minNeighbor) minNeighbor = nh;
          if (nh > maxNeighbor) maxNeighbor = nh;
        }
        if (z + 1 < depth) {
          const nh = column[z + 1];
          if (nh < minNeighbor) minNeighbor = nh;
          if (nh > maxNeighbor) maxNeighbor = nh;
        }
        if (z > 0) {
          const nh = column[z - 1];
          if (nh < minNeighbor) minNeighbor = nh;
          if (nh > maxNeighbor) maxNeighbor = nh;
        }

        // h must be within 1 of every neighbor at once, i.e. within
        // [maxNeighbor - 1, minNeighbor + 1]. Checking only against the
        // aggregate min/max misses a cell sitting "between" two neighbors
        // that are themselves far apart — e.g. heights 0, 2, 4 in a row.
        const h = column[z];
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
          column[z] = next;
        }
      }
    }

    if (!changed) break;
  }
}
