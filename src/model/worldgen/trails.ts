// Dirt trail from the spawn point to the nearest village square, so the
// player has something to follow (the villages linked to each other by
// roads.ts, the same way). Runs after villages (routes around houses and
// wells) and before trees (which avoid trails).

import { VILLAGE_PLAZA_RADIUS } from '../constants';
import { NEIGHBORS_4, cellKey, inBounds, sizeOf, type MapSize } from '../map/grid';
import { MinHeap } from '../../util/MinHeap';
import type { Surface, Village } from '../types';

const EXISTING_PATH_COST = 0.5; // cheaper than fresh ground, so the trail cuts across a village square rather than skirting it
const CLIMB_COST = 2; // per tier of height change, so trails wind around hills
const TURN_COST = 4; // per change of direction, so trails run straight instead of zigzagging

export interface TrailGrid {
  heightMap: number[][];
  lakeMap: boolean[][];
  surfaceMap: Surface[][];
  solidCells: ReadonlySet<string>;
  solid?: Uint8Array; // the same, by tile (x * depth + z): quicker, for many searches (roads.ts)
}

function index(size: MapSize, x: number, z: number): number {
  return x * size.depth + z;
}

export function plazaCells(village: Village): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let dx = -VILLAGE_PLAZA_RADIUS; dx <= VILLAGE_PLAZA_RADIUS; dx++) {
    for (let dz = -VILLAGE_PLAZA_RADIUS; dz <= VILLAGE_PLAZA_RADIUS; dz++) {
      if (dx !== 0 || dz !== 0) cells.push([village.x + dx, village.z + dz]); // center is the well
    }
  }
  return cells;
}

// Search state = tile + the direction the trail arrived from (4 = none yet),
// so turning can be priced separately from going straight.
const NO_DIRECTION = 4;
function state(cell: number, dir: number): number {
  return cell * 5 + dir;
}

// The tiles a search may cover (inclusive): the whole map for the spawn's trail, a box round two villages for a road.
export interface Bounds {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

// Cheapest walkable route from start to any target cell (Dijkstra over
// tile+direction states, within `bounds`), or null if water/buildings cut them
// off. Every turn costs extra, so the trail runs in long straight grid-aligned
// lines with a few clean corners instead of zigzagging diagonally. Existing
// paths are cheaper: a new trail joins and follows them.
// Kept between searches (grown as needed; only what a search touched set back after it): a road's search is one of
// hundreds, and making these afresh for each was most of the cost.
let dist = new Float64Array(0);
let prev = new Int32Array(0);

export function findTrail(
  grid: TrailGrid,
  starts: ReadonlyArray<[number, number]>, // where it may set out from (any: the cheapest)
  targets: ReadonlySet<number>,
  bounds?: Bounds,
  toward?: { x: number; z: number; within: number; weight: number }, // where the targets are (within so many tiles of it): searched toward it first (A*), each tile still to go counted `weight` (a path's cost: the cheapest route; open ground's: far quicker, near enough)
): Array<[number, number]> | null {
  const size = sizeOf(grid.heightMap);
  const b = bounds ?? { x0: 0, z0: 0, x1: size.width - 1, z1: size.depth - 1 };
  const [w, d0] = [b.x1 - b.x0 + 1, b.z1 - b.z0 + 1];
  const local = (x: number, z: number) => (x - b.x0) * d0 + (z - b.z0); // (a tile within the bounds)
  if (dist.length < w * d0 * 5) [dist, prev] = [new Float64Array(w * d0 * 5).fill(Infinity), new Int32Array(w * d0 * 5).fill(-1)];
  const touched: number[] = [];
  const set = (s: number, d: number, from: number) => {
    if (dist[s] === Infinity) touched.push(s);
    dist[s] = d;
    prev[s] = from;
  };
  const heap = new MinHeap();
  // How far it must still be at the least (no step's cheaper than a path's), to search toward `toward` first.
  const least = (x: number, z: number) => (toward ? Math.max(0, Math.abs(x - toward.x) + Math.abs(z - toward.z) - 2 * toward.within) * toward.weight : 0);
  const solidAt = grid.solid ? (x: number, z: number) => grid.solid![x * size.depth + z] === 1 : (x: number, z: number) => grid.solidCells.has(cellKey(x, z));

  for (const [sx, sz] of starts) {
    if (sx < b.x0 || sx > b.x1 || sz < b.z0 || sz > b.z1) continue;
    const start = state(local(sx, sz), NO_DIRECTION);
    set(start, 0, -1);
    heap.push(start, least(sx, sz));
  }
  const done = <T>(result: T): T => {
    for (const s of touched) [dist[s], prev[s]] = [Infinity, -1];
    return result;
  };

  while (heap.size > 0) {
    const [current, priority] = heap.pop();
    const d = dist[current];
    const cell = Math.floor(current / 5);
    const arrivedDir = current % 5;
    const x = b.x0 + Math.floor(cell / d0);
    const z = b.z0 + (cell % d0);
    if (priority > d + least(x, z) + 1e-9) continue; // stale entry
    if (targets.has(index(size, x, z))) {
      const route: Array<[number, number]> = [];
      for (let s = current; s !== -1; s = prev[s]) {
        const c = Math.floor(s / 5);
        route.push([b.x0 + Math.floor(c / d0), b.z0 + (c % d0)]);
      }
      return done(route);
    }

    NEIGHBORS_4.forEach(([dx, dz], dir) => {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < b.x0 || nx > b.x1 || nz < b.z0 || nz > b.z1) return;
      if (!inBounds(size, nx, nz) || grid.lakeMap[nx][nz] || solidAt(nx, nz)) return;

      const stepCost =
        (grid.surfaceMap[nx][nz] === 'natural' ? 1 : EXISTING_PATH_COST) +
        CLIMB_COST * Math.abs(grid.heightMap[nx][nz] - grid.heightMap[x][z]) +
        (arrivedDir !== NO_DIRECTION && arrivedDir !== dir ? TURN_COST : 0);
      const next = state(local(nx, nz), dir);
      if (d + stepCost < dist[next]) {
        set(next, d + stepCost, current);
        heap.push(next, d + stepCost + least(nx, nz));
      }
    });
  }
  return done(null);
}

export function paveTrail(surfaceMap: Surface[][], route: Array<[number, number]>): void {
  for (const [x, z] of route) {
    if (surfaceMap[x][z] === 'natural') surfaceMap[x][z] = 'path';
  }
}

// Mutates surfaceMap and returns the route, ordered from spawn to the
// square. Leads to whichever village is cheapest to reach; if water cuts
// spawn off from every village, there's simply no trail (null).
export function generateSpawnTrail(
  grid: TrailGrid,
  villages: Village[],
  spawnX: number,
  spawnZ: number,
): Array<[number, number]> | null {
  if (villages.length === 0) return null;
  const size = sizeOf(grid.heightMap);
  const targets = new Set(villages.flatMap(plazaCells).map(([x, z]) => index(size, x, z)));
  const route = findTrail(grid, [[spawnX, spawnZ]], targets);
  if (!route) return null;
  route.reverse(); // reconstructed target-to-start
  paveTrail(grid.surfaceMap, route);
  return route;
}
