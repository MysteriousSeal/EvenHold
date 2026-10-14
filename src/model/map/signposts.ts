// Signposts where roads meet out in the wilds: one at each junction (a road tile with three ways or four out of it, away
// from any village's own square and lanes), an arm for each way that leads to a village, naming the nearest one along
// it (the paving followed out that way, the first square it comes to). Worked out from the tiles alone, where they're
// drawn (view/meshes/road/signpostMesh.ts), the same every time.

import { REACH } from '../worldgen/roads';
import type { Village } from '../types';
import { NEIGHBORS_4 } from './grid';
import type { Obstacles } from './obstacles';
import type { Tiles } from './tiles';

const FOLLOWED = 4000; // tiles of paving followed out along an arm, at most, to a square
export const SIGN_CORNER = 0.38; // how far off its tile's middle a signpost stands (across, and along: on the grass, at a corner)
const SIGN_HALF = 0.06; // its post's girth, walked round (two voxels square, and the stones at its foot)
const SIGN_EDGE = 2; // tiles in from its area's edges a post must stand to be walked round (nearer, what's past the edge may not be made: its post found only once it is)

export interface SignArm {
  dir: number; // the way it points (NEIGHBORS_4: +x, -x, +z, -z)
  village: Village; // where that way leads
  tiles: number; // how far, along the road
}

export interface Signpost {
  x: number; // its junction's tile
  z: number;
  corner: [number, number]; // which of the tile's corners it stands at (each ±1)
  arms: SignArm[];
}

const paved = (tiles: Tiles, x: number, z: number) => {
  const s = tiles.surface(x, z);
  return s === 'path' || s === 'plaza';
};

function isJunction(tiles: Tiles, villages: readonly Village[], x: number, z: number): boolean {
  if (tiles.surface(x, z) !== 'path') return false;
  let ways = 0;
  for (const [dx, dz] of NEIGHBORS_4) if (paved(tiles, x + dx, z + dz)) ways++;
  return ways >= 3 && villages.every((v) => Math.max(Math.abs(v.x - x), Math.abs(v.z - z)) > REACH);
}

// The village a way out of (x, z) leads to first, and how far: the paving followed out from it (never back through
// (x, z)), the first square reached; its village the nearest to it.
function leadsTo(tiles: Tiles, villages: readonly Village[], x: number, z: number, dir: number): { village: Village; tiles: number } | null {
  const [dx, dz] = NEIGHBORS_4[dir];
  const start = `${x + dx},${z + dz}`;
  const seen = new Set([`${x},${z}`, start]);
  let ring: Array<[number, number]> = [[x + dx, z + dz]];
  for (let far = 1; ring.length > 0 && seen.size < FOLLOWED; far++) {
    const next: Array<[number, number]> = [];
    for (const [cx, cz] of ring) {
      if (tiles.surface(cx, cz) === 'plaza') {
        let best: Village | null = null;
        for (const v of villages) if (!best || Math.hypot(v.x - cx, v.z - cz) < Math.hypot(best.x - cx, best.z - cz)) best = v;
        return best && { village: best, tiles: far };
      }
      for (const [ex, ez] of NEIGHBORS_4) {
        const [nx, nz] = [cx + ex, cz + ez];
        const key = `${nx},${nz}`;
        if (seen.has(key) || !paved(tiles, nx, nz)) continue;
        seen.add(key);
        next.push([nx, nz]);
      }
    }
    ring = next;
  }
  return null;
}

// The signpost at (x, z), if a junction's there (and the first of a knot of them: roads met side by side make
// several, given one post); null if not, or no way out of it leads anywhere.
export function signpostAt(tiles: Tiles, villages: readonly Village[], x: number, z: number): Signpost | null {
  if (!isJunction(tiles, villages, x, z)) return null;
  for (let ox = -1; ox <= 1; ox++) {
    for (let oz = -1; oz <= 1; oz++) if ((ox < 0 || (ox === 0 && oz < 0)) && isJunction(tiles, villages, x + ox, z + oz)) return null;
  }
  const arms: SignArm[] = [];
  NEIGHBORS_4.forEach(([dx, dz], dir) => {
    if (!paved(tiles, x + dx, z + dz)) return;
    const to = leadsTo(tiles, villages, x, z, dir);
    if (!to) return;
    const same = arms.findIndex((a) => a.village === to.village);
    if (same < 0) arms.push({ dir, ...to });
    else if (to.tiles < arms[same].tiles) arms[same] = { dir, ...to }; // (two ways to one village: the shorter told)
  });
  if (arms.length === 0) return null;
  // At a corner between two ways out (on the grass), the one that hash of its tile picks.
  const corners: Array<[number, number]> = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  const corner = corners[((x * 73856093) ^ (z * 19349663)) >>> 0 & 3];
  return { x, z, corner, arms };
}

// The signposts on the tiles x0..x1 - 1, z0..z1 - 1.
export function signpostsIn(tiles: Tiles, villages: readonly Village[], area: { x0: number; z0: number; x1: number; z1: number }): Signpost[] {
  const out: Signpost[] = [];
  for (let x = area.x0; x < area.x1; x++) {
    for (let z = area.z0; z < area.z1; z++) {
      if (tiles.surface(x, z) !== 'path') continue;
      const post = signpostAt(tiles, villages, x, z);
      if (post) out.push(post);
    }
  }
  return out;
}

// The signposts on `area` (a region of a streamed world, as it's made: its own tiles and villages), each a thin post
// walked round at its corner of its junction (low: it hides no one). Those right by its edges left out (whether
// they're there at all hangs on the tiles past it, not made with it).
export function addSignpostObstacles(obstacles: Obstacles, tiles: Tiles, villages: readonly Village[], area: { x0: number; z0: number; x1: number; z1: number }): void {
  const inner = { x0: area.x0 + SIGN_EDGE, z0: area.z0 + SIGN_EDGE, x1: area.x1 - SIGN_EDGE, z1: area.z1 - SIGN_EDGE };
  for (const { x, z, corner } of signpostsIn(tiles, villages, inner)) obstacles.addProp(x, z, SIGN_HALF, true, SIGN_HALF, true, corner[0] * SIGN_CORNER, corner[1] * SIGN_CORNER);
}
