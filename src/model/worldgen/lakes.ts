// Lake/basin generation. Depends on the height grid, not on trees or the hero.

import { WATER_LEVEL, LAKE_NOISE_SCALE, MIN_LAKE_SIZE } from '../constants';
import { sizeOf } from '../map/grid';

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
  const map: boolean[][] = Array.from({ length: size.width }, () => new Array<boolean>(size.depth).fill(false));
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
        // Its four neighbors, in NEIGHBORS_4's order (+x, -x, +z, -z), written out: this runs millions of times.
        const push = (nx: number, nz: number) => {
          if (heightMap[nx][nz] > WATER_LEVEL) return;
          const next = nx * size.depth + nz;
          if (visited[next]) return;
          visited[next] = 1;
          stack[top++] = next;
        };
        if (cx + 1 < size.width) push(cx + 1, cz);
        if (cx > 0) push(cx - 1, cz);
        if (cz + 1 < size.depth) push(cx, cz + 1);
        if (cz > 0) push(cx, cz - 1);
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

  drainAroundSpawn(map, spawnX, spawnZ, stack, visited);
  return map;
}

const SPAWN_LAND = 2000; // tiles of dry land the hero can walk to from spawn, at least

// Spawn on dry land ringed by lakes (an islet) would keep the hero there
// for good: the lakes round it are drained until there's land enough to
// walk out on. (Almost always there is at once, and nothing's changed.)
// `stack` and `seen`: scratch space as big as the map.
function drainAroundSpawn(map: boolean[][], spawnX: number, spawnZ: number, stack: Int32Array, seen: Uint8Array): void {
  const size = sizeOf(map);
  const neighbours = (cell: number, visit: (next: number, x: number, z: number) => void) => {
    const x = Math.floor(cell / size.depth);
    const z = cell - x * size.depth;
    if (x + 1 < size.width) visit(cell + size.depth, x + 1, z);
    if (x > 0) visit(cell - size.depth, x - 1, z);
    if (z + 1 < size.depth) visit(cell + 1, x, z + 1);
    if (z > 0) visit(cell - 1, x, z - 1);
  };
  for (let round = 0; round < 8; round++) {
    // The land walkable from spawn (as far as SPAWN_LAND), and the water at its shores.
    seen.fill(0);
    const shore: number[] = [];
    let top = 0;
    let land = 0;
    stack[top++] = spawnX * size.depth + spawnZ;
    seen[stack[0]] = 1;
    while (top > 0 && land < SPAWN_LAND) {
      land++;
      neighbours(stack[--top], (next, x, z) => {
        if (seen[next]) return;
        seen[next] = 1;
        if (map[x][z]) shore.push(next);
        else stack[top++] = next;
      });
    }
    if (land >= SPAWN_LAND) return;
    // Too little: each lake at its shores, drained whole (a lake is one basin, so it's all of one connected water).
    for (const start of shore) {
      const sx = Math.floor(start / size.depth);
      if (!map[sx][start - sx * size.depth]) continue;
      top = 0;
      stack[top++] = start;
      map[sx][start - sx * size.depth] = false;
      while (top > 0) {
        neighbours(stack[--top], (next, x, z) => {
          if (!map[x][z]) return;
          map[x][z] = false;
          stack[top++] = next;
        });
      }
    }
  }
}
