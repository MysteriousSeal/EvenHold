// Dirt trail from the spawn point to the nearest village square, so the
// player has something to follow. Villages are deliberately not linked to
// each other. Runs after villages (routes around houses and wells) and
// before trees (which avoid trails).

import { MAP_WIDTH, MAP_DEPTH, VILLAGE_PLAZA_RADIUS } from '../constants';
import { NEIGHBORS_4, cellKey, inBounds } from '../grid';
import { MinHeap } from '../../util/MinHeap';
import type { Surface, Village } from '../types';

const EXISTING_PATH_COST = 0.5; // cheaper than fresh ground, so the trail cuts across a village square rather than skirting it
const CLIMB_COST = 2; // per tier of height change, so trails wind around hills
const TURN_COST = 4; // per change of direction, so trails run straight instead of zigzagging

interface TrailGrid {
  heightMap: number[][];
  lakeMap: boolean[][];
  surfaceMap: Surface[][];
  solidCells: ReadonlySet<string>;
}

function index(x: number, z: number): number {
  return x * MAP_DEPTH + z;
}

function plazaCells(village: Village): Array<[number, number]> {
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

// Cheapest walkable route from start to any target cell (Dijkstra over
// tile+direction states), or null if water/buildings cut them off. Every
// turn costs extra, so the trail runs in long straight grid-aligned lines
// with a few clean corners instead of zigzagging diagonally.
function findTrail(
  grid: TrailGrid,
  [startX, startZ]: [number, number],
  targets: ReadonlySet<number>,
): Array<[number, number]> | null {
  const dist = new Float64Array(MAP_WIDTH * MAP_DEPTH * 5).fill(Infinity);
  const prev = new Int32Array(MAP_WIDTH * MAP_DEPTH * 5).fill(-1);
  const heap = new MinHeap();

  const start = state(index(startX, startZ), NO_DIRECTION);
  dist[start] = 0;
  heap.push(start, 0);

  while (heap.size > 0) {
    const [current, d] = heap.pop();
    if (d > dist[current]) continue; // stale entry

    const cell = Math.floor(current / 5);
    const arrivedDir = current % 5;
    if (targets.has(cell)) {
      const route: Array<[number, number]> = [];
      for (let s = current; s !== -1; s = prev[s]) {
        const c = Math.floor(s / 5);
        route.push([Math.floor(c / MAP_DEPTH), c % MAP_DEPTH]);
      }
      return route;
    }

    const x = Math.floor(cell / MAP_DEPTH);
    const z = cell % MAP_DEPTH;
    NEIGHBORS_4.forEach(([dx, dz], dir) => {
      const nx = x + dx;
      const nz = z + dz;
      if (!inBounds(nx, nz) || grid.lakeMap[nx][nz] || grid.solidCells.has(cellKey(nx, nz))) return;

      const stepCost =
        (grid.surfaceMap[nx][nz] === 'natural' ? 1 : EXISTING_PATH_COST) +
        CLIMB_COST * Math.abs(grid.heightMap[nx][nz] - grid.heightMap[x][z]) +
        (arrivedDir !== NO_DIRECTION && arrivedDir !== dir ? TURN_COST : 0);
      const next = state(index(nx, nz), dir);
      if (d + stepCost < dist[next]) {
        dist[next] = d + stepCost;
        prev[next] = current;
        heap.push(next, d + stepCost);
      }
    });
  }
  return null;
}

function paveTrail(surfaceMap: Surface[][], route: Array<[number, number]>): void {
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
  const targets = new Set(villages.flatMap(plazaCells).map(([x, z]) => index(x, z)));
  const route = findTrail(grid, [spawnX, spawnZ], targets);
  if (!route) return null;
  route.reverse(); // reconstructed target-to-start
  paveTrail(grid.surfaceMap, route);
  return route;
}
