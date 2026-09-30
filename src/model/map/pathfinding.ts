// Finding a way around obstacles, tile by tile: A* over tile centers within
// a square window around the start, in 8 directions. A step counts only if
// the walker fits where it ends and halfway there (which catches fences on
// tile edges), and a diagonal only if both straight steps around it are
// clear too, so it never cuts a corner.

import { MinHeap } from '../../util/MinHeap';

export interface Point {
  x: number;
  z: number;
}

const DIRS: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

// Tile centers to walk through from `from` toward `to` (the start tile
// left out). If `to` can't be reached within `radius` tiles, the path ends
// at the reachable tile nearest to it; an empty path means stay put.
// `free(x, z)`: whether the walker fits there.
export function findPath(from: Point, to: Point, radius: number, free: (x: number, z: number) => boolean): Point[] {
  const sx = Math.round(from.x);
  const sz = Math.round(from.z);
  const gx = Math.round(to.x);
  const gz = Math.round(to.z);
  const side = radius * 2 + 1;
  const index = (x: number, z: number) => (x - sx + radius) * side + (z - sz + radius);
  const inWindow = (x: number, z: number) => Math.abs(x - sx) <= radius && Math.abs(z - sz) <= radius;
  const cost = new Float32Array(side * side).fill(Infinity);
  const came = new Int32Array(side * side).fill(-1);
  const heuristic = (x: number, z: number) => Math.hypot(gx - x, gz - z);

  const heap = new MinHeap();
  const start = index(sx, sz);
  cost[start] = 0;
  heap.push(start, heuristic(sx, sz));
  let best = start; // the reached tile nearest the goal
  let bestH = heuristic(sx, sz);
  const stepFree = (x: number, z: number, dx: number, dz: number) => free(x + dx, z + dz) && free(x + dx / 2, z + dz / 2);

  while (heap.size > 0) {
    const [node, priority] = heap.pop();
    const x = sx - radius + Math.floor(node / side);
    const z = sz - radius + (node % side);
    if (priority - heuristic(x, z) > cost[node] + 1e-6) continue; // a stale entry
    const h = heuristic(x, z);
    if (h < bestH) {
      best = node;
      bestH = h;
    }
    if (x === gx && z === gz) break;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx;
      const nz = z + dz;
      if (!inWindow(nx, nz)) continue;
      const diagonal = dx !== 0 && dz !== 0;
      if (diagonal ? !(stepFree(x, z, dx, 0) && stepFree(x, z, 0, dz) && stepFree(x, z, dx, dz)) : !stepFree(x, z, dx, dz)) continue;
      const next = index(nx, nz);
      const c = cost[node] + (diagonal ? Math.SQRT2 : 1);
      if (c >= cost[next]) continue;
      cost[next] = c;
      came[next] = node;
      heap.push(next, c + heuristic(nx, nz));
    }
  }

  const path: Point[] = [];
  for (let node = best; node !== start; node = came[node]) {
    path.push({ x: sx - radius + Math.floor(node / side), z: sz - radius + (node % side) });
  }
  return path.reverse();
}
