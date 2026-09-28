// Lake/basin generation. Depends on the height grid, not on trees or the hero.

import { WATER_LEVEL, LAKE_NOISE_SCALE, MIN_LAKE_SIZE } from '../constants';
import { NEIGHBORS_4, inBounds, sizeOf } from '../grid';

// Water physically can't flood part of a connected low-lying basin and
// leave the rest dry — it finds its own level. So instead of deciding
// per-cell, this flood-fills every connected group of cells at or below
// WATER_LEVEL and makes ONE flood/no-flood decision for the whole basin:
// the average of a low-frequency "lake blob" noise (sampled at a large
// offset so it's decorrelated from the height noise) against the seed's
// lake threshold. Basins under MIN_LAKE_SIZE never flood, and neither does
// the basin containing spawn — forcing just the spawn cell dry afterward
// would carve a hole into an otherwise-uniform lake.
export function generateLakeMap(
  heightMap: number[][],
  noise2D: (x: number, y: number) => number,
  lakeThreshold: number,
  spawnX: number,
  spawnZ: number,
): boolean[][] {
  const size = sizeOf(heightMap);
  const map: boolean[][] = heightMap.map((row) => row.map(() => false));
  // Flat typed arrays (index x * depth + z): a big map has millions of tiles.
  const visited = new Uint8Array(size.width * size.depth);
  const stack = new Int32Array(size.width * size.depth);
  const basin = new Int32Array(size.width * size.depth);
  const spawn = spawnX * size.depth + spawnZ;

  for (let x = 0; x < size.width; x++) {
    for (let z = 0; z < size.depth; z++) {
      const start = x * size.depth + z;
      if (heightMap[x][z] > WATER_LEVEL || visited[start]) continue;

      let top = 0;
      let count = 0;
      let containsSpawn = false;
      stack[top++] = start;
      visited[start] = 1;
      while (top > 0) {
        const cell = stack[--top];
        basin[count++] = cell;
        if (cell === spawn) containsSpawn = true;
        const cx = Math.floor(cell / size.depth);
        const cz = cell - cx * size.depth;
        for (const [dx, dz] of NEIGHBORS_4) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (!inBounds(size, nx, nz) || heightMap[nx][nz] > WATER_LEVEL) continue;
          const next = nx * size.depth + nz;
          if (visited[next]) continue;
          visited[next] = 1;
          stack[top++] = next;
        }
      }

      if (count < MIN_LAKE_SIZE || containsSpawn) continue;

      let blobSum = 0;
      for (let i = 0; i < count; i++) {
        const cx = Math.floor(basin[i] / size.depth);
        const cz = basin[i] - cx * size.depth;
        blobSum += noise2D(cx / LAKE_NOISE_SCALE + 500, cz / LAKE_NOISE_SCALE + 500);
      }

      if (blobSum / count > lakeThreshold) {
        for (let i = 0; i < count; i++) {
          const cx = Math.floor(basin[i] / size.depth);
          map[cx][basin[i] - cx * size.depth] = true;
        }
      }
    }
  }

  return map;
}
