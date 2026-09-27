// Lake/basin generation. Depends on the height grid, not on trees or the hero.

import { MAP_WIDTH, MAP_DEPTH, WATER_LEVEL, LAKE_NOISE_SCALE, MIN_LAKE_SIZE } from './constants';

// Water physically can't flood part of a connected low-lying basin and
// leave the rest dry — it finds its own level. So instead of deciding
// per-cell, this flood-fills every connected group of cells at or below
// WATER_LEVEL (4-directional) and makes ONE flood/no-flood decision for
// the whole basin: the average of a low-frequency "lake blob" noise
// sampled across the basin's cells against the seed's lake threshold.
// Basins under MIN_LAKE_SIZE never flood, avoiding puddle-sized clutter.
// Whichever basin contains the spawn point never floods either, since
// forcing that single cell dry afterward would carve a hole into an
// otherwise-uniform lake.
export function generateLakeMap(
  heightMap: number[][],
  noise2D: (x: number, y: number) => number,
  lakeThreshold: number,
  spawnX: number,
  spawnZ: number,
): boolean[][] {
  const map: boolean[][] = heightMap.map((row) => row.map(() => false));
  const visited: boolean[][] = heightMap.map((row) => row.map(() => false));
  const offsets: Array<[number, number]> = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      if (heightMap[x][z] > WATER_LEVEL || visited[x][z]) continue;

      const basin: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[x, z]];
      visited[x][z] = true;

      while (stack.length > 0) {
        const [cx, cz] = stack.pop()!;
        basin.push([cx, cz]);

        for (const [dx, dz] of offsets) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (
            nx >= 0 &&
            nx < MAP_WIDTH &&
            nz >= 0 &&
            nz < MAP_DEPTH &&
            heightMap[nx][nz] <= WATER_LEVEL &&
            !visited[nx][nz]
          ) {
            visited[nx][nz] = true;
            stack.push([nx, nz]);
          }
        }
      }

      const containsSpawn = basin.some(([cx, cz]) => cx === spawnX && cz === spawnZ);
      if (basin.length < MIN_LAKE_SIZE || containsSpawn) continue;

      let blobSum = 0;
      for (const [cx, cz] of basin) {
        blobSum += noise2D(cx / LAKE_NOISE_SCALE + 500, cz / LAKE_NOISE_SCALE + 500);
      }
      const blobAverage = blobSum / basin.length;

      if (blobAverage > lakeThreshold) {
        for (const [cx, cz] of basin) map[cx][cz] = true;
      }
    }
  }

  return map;
}
