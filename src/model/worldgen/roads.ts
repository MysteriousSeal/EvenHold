// Dirt roads between the villages: each linked to its neighbours, the
// shortest links that join them all (a spanning tree, by distance, none longer
// than MAX_LINK: a village cut off beyond it, or by water, keeps to itself),
// then every village left with one road given a second, to its nearest
// neighbour not yet joined (MIN_ROADS: no dead ends, where there's another in
// reach). Each road found as the spawn's trail is (trails.ts: round lakes,
// houses and wells, winding round hills, joining a road already there rather
// than running beside it), searched only within a box round its two
// villages, leaving each from the end of its lane toward the other (or its square). Run after the spawn's trail, before the fields and trees (which
// keep off roads). Travellers walk them (travellers/travellers.ts).

import { NEIGHBORS_4, sizeOf } from '../map/grid';
import { LANE_LENGTH_MAX, VILLAGE_OUTER_RADIUS } from '../constants';
import type { Village } from '../types';
import { findTrail, paveTrail, plazaCells, type TrailGrid } from './trails';

export const MAX_LINK = 220; // tiles between two villages, at most, for a road between them
const GREED = 1.5; // each tile still to go counted as so much, searching toward the other village (over 1: quicker, a touch less the cheapest)
const SECOND_TRIES = 3; // nearest villages tried for a second road (one cut off by water: not searched for long)
export const MIN_ROADS = 2; // roads out of each village, at least (where it has neighbours in reach)
const MARGIN = 40; // tiles round the two villages a road's search may stray
const REACH = VILLAGE_OUTER_RADIUS + LANE_LENGTH_MAX + 2; // tiles from a village's well its lanes may run (and jog)

export interface Road {
  from: number; // its villages, by index
  to: number;
  route: Array<[number, number]>; // its tiles, from `from`'s square to `to`'s
}

export function linkVillages(trailGrid: TrailGrid, villages: readonly Village[]): Road[] {
  const size = sizeOf(trailGrid.heightMap);
  // What's solid, by tile (quicker than by key, for so many searches).
  const solid = new Uint8Array(size.width * size.depth);
  for (const key of trailGrid.solidCells) {
    const [x, z] = key.split(',').map(Number);
    if (x >= 0 && x < size.width && z >= 0 && z < size.depth) solid[x * size.depth + z] = 1;
  }
  const grid = { ...trailGrid, solid };
  const own = villages.map((v) => villageTiles(grid, v)); // (each one's square and lanes, before any road's paved)
  // The links: every pair near enough, nearest first, kept if it joins two villages not yet joined (union-find).
  const pairs: Array<[number, number, number]> = [];
  for (let i = 0; i < villages.length; i++) {
    for (let j = i + 1; j < villages.length; j++) {
      const d = Math.hypot(villages[i].x - villages[j].x, villages[i].z - villages[j].z);
      if (d <= MAX_LINK) pairs.push([d, i, j]);
    }
  }
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const parent = villages.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  const roads: Road[] = [];
  const linked = new Set<string>(); // (pairs with a road between them)
  const count = villages.map(() => 0); // roads out of each
  const link = (i: number, j: number): boolean => {
    const route = roadBetween(grid, villages[i], villages[j], own[i], own[j], size);
    if (!route) return false; // (no way through: water, or boxed in)
    paveTrail(grid.surfaceMap, route);
    roads.push({ from: i, to: j, route });
    linked.add(`${i},${j}`).add(`${j},${i}`);
    [count[i], count[j]] = [count[i] + 1, count[j] + 1];
    return true;
  };
  for (const [, i, j] of pairs) {
    if (root(i) === root(j) || !link(i, j)) continue;
    parent[root(i)] = root(j);
  }
  // Then every village with a single road (the tree's ends) a second, to the nearest it isn't joined to yet: none a
  // dead end where another's in reach.
  for (let i = 0; i < villages.length; i++) {
    if (count[i] >= MIN_ROADS) continue;
    const near = pairs.filter(([, a, b]) => (a === i || b === i) && !linked.has(`${a},${b}`)).slice(0, SECOND_TRIES); // (nearest first)
    for (const [, a, b] of near) if (count[i] < MIN_ROADS) link(i, a === i ? b : a);
  }
  return roads;
}

// A village's own paving: its square and the dirt lanes leaving it (path or square, joined to the square, within its
// reach), its well left out.
function villageTiles(grid: TrailGrid, v: Village): Array<[number, number]> {
  const paved = (x: number, z: number) => grid.surfaceMap[x]?.[z] === 'path' || grid.surfaceMap[x]?.[z] === 'plaza';
  const seen = new Set<string>();
  const tiles: Array<[number, number]> = [];
  const todo: Array<[number, number]> = plazaCells(v).filter(([x, z]) => paved(x, z));
  while (todo.length > 0) {
    const [x, z] = todo.pop()!;
    if (seen.has(`${x},${z}`)) continue;
    seen.add(`${x},${z}`);
    tiles.push([x, z]);
    for (const [dx, dz] of NEIGHBORS_4) {
      const [nx, nz] = [x + dx, z + dz];
      if (Math.max(Math.abs(nx - v.x), Math.abs(nz - v.z)) <= REACH && paved(nx, nz) && !seen.has(`${nx},${nz}`)) todo.push([nx, nz]);
    }
  }
  return tiles;
}

// The road from one village to another: setting out from any of `a`'s square and lanes (the end of a lane, the way
// to `b`: so it carries on from it), to any of `b`'s.
function roadBetween(grid: TrailGrid, a: Village, b: Village, from: Array<[number, number]>, to: Array<[number, number]>, size: { width: number; depth: number }): Array<[number, number]> | null {
  const open = ([x, z]: [number, number]) => !grid.lakeMap[x]?.[z] && !grid.solid![x * size.depth + z];
  const starts = from.filter(open);
  if (starts.length === 0) return null;
  const targets = new Set(to.map(([x, z]) => x * size.depth + z));
  const bounds = {
    x0: Math.max(0, Math.min(a.x, b.x) - MARGIN),
    z0: Math.max(0, Math.min(a.z, b.z) - MARGIN),
    x1: Math.min(size.width - 1, Math.max(a.x, b.x) + MARGIN),
    z1: Math.min(size.depth - 1, Math.max(a.z, b.z) + MARGIN),
  };
  const route = findTrail(grid, starts, targets, bounds, { x: b.x, z: b.z, within: REACH, weight: GREED }); // (over open ground's cost a little: far quicker, near enough the cheapest)
  return route ? route.reverse() : null; // (found from the end back)
}
