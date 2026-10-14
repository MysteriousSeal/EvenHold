// The roads on into the next region (a streamed world is made a region at a time, each a small world of its own:
// regions.ts), so the land's roads run on across it and not each region's to itself. Each border has its crossing,
// found the same from either side of it (regions.ts crossingsOf): and each region runs a road from its side of the
// crossing in, as its villages' roads are found (trails.ts), to the nearest of its roads or its nearest village's
// square and lanes (the next nearest, if water cuts that one off). Made last, after the trees (so none of the
// region's trees or anything after them is moved; those it runs through felled for it), keeping off fields, ruins and
// camps. Kept with the trails (paved ways with no village at each end: no travellers walk them).

import { sizeOf } from '../map/grid';
import type { Village } from '../types';
import { findTrail, paveTrail, type TrailGrid } from './trails';
import { GREED, MARGIN, REACH, type Road, villageTiles } from './roads';

const TRIES = 3; // nearest villages tried, for each crossing
const FURTHEST = 320; // tiles from a crossing to a village, at most, for a road in to it
export const STRAIGHT_IN = 6; // tiles straight in from the border, before it finds its way (never along the border, beside the next region's)
const KEEP_OFF = 3; // tiles in from the region's edges its way keeps to, past those

export function roadsToBorders(
  grid: TrailGrid,
  villages: readonly Village[],
  roads: readonly Road[],
  crossings: ReadonlyArray<[number, number]>, // its side of each border's crossing, on its maps
  kept: (x: number, z: number) => boolean, // tiles no road may cross besides (a ruin's, a camp's)
): Array<Array<[number, number]>> {
  const size = sizeOf(grid.heightMap);
  const solid = new Uint8Array(size.width * size.depth);
  for (const key of grid.solidCells) {
    const [x, z] = key.split(',').map(Number);
    if (x >= 0 && x < size.width && z >= 0 && z < size.depth) solid[x * size.depth + z] = 1;
  }
  for (let x = 0; x < size.width; x++) {
    for (let z = 0; z < size.depth; z++) if (grid.surfaceMap[x][z] === 'field' || kept(x, z)) solid[x * size.depth + z] = 1;
  }
  const open = { ...grid, solid };
  const onRoads = roads.flatMap((r) => r.route.map(([x, z]) => x * size.depth + z));
  const ways: Array<Array<[number, number]>> = [];
  for (const [cx, cz] of crossings) {
    // Straight in from the border first (as far as it's open), then on from there.
    const [ix, iz] = cx === 0 ? [1, 0] : cx === size.width - 1 ? [-1, 0] : cz === 0 ? [0, 1] : [0, -1];
    const blocked = (x: number, z: number) => grid.lakeMap[x][z] || solid[x * size.depth + z] === 1;
    if (blocked(cx, cz)) continue;
    const start: Array<[number, number]> = [[cx, cz]];
    for (let step = 1; step <= STRAIGHT_IN && !blocked(cx + ix * step, cz + iz * step); step++) start.push([cx + ix * step, cz + iz * step]);
    const [sx, sz] = start[start.length - 1];
    const near = villages
      .map((v) => ({ v, d: Math.hypot(v.x - cx, v.z - cz) }))
      .filter(({ d }) => d <= FURTHEST)
      .sort((a, b) => a.d - b.d)
      .slice(0, TRIES);
    for (const { v } of near) {
      const targets = new Set([...onRoads, ...villageTiles(open, v).map(([x, z]) => x * size.depth + z)]);
      const bounds = {
        x0: Math.max(Math.min(KEEP_OFF, sx), Math.min(sx, v.x) - MARGIN),
        z0: Math.max(Math.min(KEEP_OFF, sz), Math.min(sz, v.z) - MARGIN),
        x1: Math.min(Math.max(size.width - 1 - KEEP_OFF, sx), Math.max(sx, v.x) + MARGIN),
        z1: Math.min(Math.max(size.depth - 1 - KEEP_OFF, sz), Math.max(sz, v.z) + MARGIN),
      };
      const found = findTrail(open, [[sx, sz]], targets, bounds, { x: v.x, z: v.z, within: REACH, weight: GREED });
      if (!found) continue;
      const route = [...start.slice(0, -1), ...found.reverse()]; // (from the border in)
      paveTrail(grid.surfaceMap, route);
      ways.push(route);
      break;
    }
  }
  return ways;
}
