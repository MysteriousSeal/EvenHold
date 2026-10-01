// The ruins' outer walls (ruinVoxels.ts: wall, wallBroken, arch, corner), in
// their strip along the tile's -Z edge (WALL deep, what blocks: ruins.ts),
// jutting a voxel at most toward the ruin's middle. Ashlar: chunky blocks in
// courses five high, of lengths varied course to course, the joints sunk a
// voxel (shadowed) on both faces, each block's top edge catching the light
// and its foot in shade; a plinth course along the bottom, jutting; at each
// end of a tile half a pilaster (a whole one where two walls meet, so a wall
// runs on with a pier every tile, never a seam); a coping course along the
// top, overhanging, crenels gapped in it. Weathered: a block fallen out here
// and there (dark behind), moss on top dripping over the edge, ivy hanging
// in curtains from the top, grass at the foot.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { C } from './ruinVoxels';

export const WALL = 7; // a wall's thickness, from the tile's -Z edge
const PLINTH = 2; // the plinth's top course
const PIER = 2; // a half-pilaster's width, at each end
// Where the joints fall along each course (between them, a block), by course: never in line course to course.
const JOINTS = [
  [8, 16],
  [5, 12, 19],
  [10, 17],
  [6, 13, 20],
];

// Which block of its course `along` is in, at `y` up from the ashlar's foot (-1: a joint).
export function ashlarBlock(along: number, y: number, variant: number): number {
  const joints = JOINTS[(Math.floor(y / 5) + variant) % JOINTS.length];
  const at = ((along % 25) + 25) % 25; // (the joints laid out a tile at a time)
  return y % 5 === 4 || joints.includes(at) ? -1 : joints.filter((j) => j < at).length + Math.floor(along / 25) * 4;
}

// The stone of ashlar at `along` and `y` up from its foot: courses five high, chunky blocks, the joints in
// mortar (sunk on its `face`: 0, nothing there); a block's top edge lit, its foot in shade, on the face.
export function ashlarStone(along: number, y: number, face: boolean, variant: number, salt: number): number {
  const block = ashlarBlock(along, y, variant);
  if (block < 0) return face ? 0 : C.mortar;
  const [course, row] = [Math.floor(y / 5), y % 5];
  const tone = [C.stone, C.stoneDark, C.stone, C.stoneLight][Math.floor(hashUnit(block * 7 + course, variant, salt) * 4)];
  return face && row === 3 ? (tone === C.stoneDark ? C.stone : C.stoneLight) : face && row === 0 ? C.stoneDark : tone;
}

// A wall's crenellated top, `high` at its merlons: the piers a little higher, a crenel gapped in the middle,
// worn ragged (by variant, how far).
export const crenellated = (high: number, variant: number, salt: number) => (u: number) => {
  if (u <= PIER || u >= 24 - PIER) return high + 2;
  const crenel = u >= 9 && u <= 15 ? 4 : 0;
  return high - crenel - Math.floor(hashUnit(Math.floor(u / 3), variant, salt) * (1 + variant));
};

// Where a wall stands across its tile: from its -Z edge (or `from` in), `deep` thick; `inner`, one standing
// free across the inside (seen both sides, nothing jutting: no more than its stone blocks).
export interface WallAt {
  alongX?: boolean; // false: along the -X edge instead (a corner's other arm)
  from?: number;
  deep?: number;
  inner?: boolean;
}

// Lays a wall, its top at `top(u)`.
export function ashlarWall(grid: VoxelGrid, variant: number, top: (u: number) => number, salt: number, { alongX = true, from = 0, deep = WALL, inner = false }: WallAt = {}): void {
  const FACE = deep - 1;
  const set = (u: number, y: number, v: number, color: number) => {
    if (inner && (v < 0 || v > FACE)) return;
    const w = v + from;
    if (alongX) fillBox(grid, u, y, w, u, y, w, color);
    else fillBox(grid, w, y, u, w, y, u, color);
  };
  for (let u = 0; u <= 24; u++) {
    const t = Math.max(PLINTH + 1, top(u));
    const pier = u <= PIER || u >= 24 - PIER;
    for (let y = 0; y <= t; y++) {
      for (let v = 0; v <= FACE + 1; v++) {
        const face = v === 0 || v === FACE;
        if (y <= PLINTH) {
          // The plinth: dark, its top edge light, jutting a voxel inward at its foot.
          if (v === FACE + 1 && y === PLINTH) continue;
          set(u, y, v, y === PLINTH && face ? C.stone : C.stoneDark);
          continue;
        }
        if (y >= t - 1) {
          // The coping: light stone along the top, overhanging inward; moss on it.
          const moss = y === t && hashUnit(u, v, salt + variant * 7) < 0.45;
          set(u, y, v, moss ? (hashUnit(u, y, salt) < 0.5 ? C.moss : C.mossDark) : y === t ? C.stoneLight : C.stone);
          continue;
        }
        if (v === FACE + 1 && !pier) continue; // (only the pilasters jut)
        if (pier) {
          // A pilaster: courses of three, light and plain, sunk joints.
          const joint = (y - PLINTH) % 4 === 0;
          if (joint && (face || v === FACE + 1)) continue;
          set(u, y, v, joint ? C.mortar : Math.floor((y - PLINTH) / 4) % 2 ? C.stoneLight : C.stone);
          continue;
        }
        // Ashlar; a block fallen out here and there, gone from the face two deep, dark behind.
        const stone = ashlarStone(u, y - PLINTH - 1, face, variant, salt);
        const [course, block] = [Math.floor((y - PLINTH - 1) / 5), ashlarBlock(u, y - PLINTH - 1, variant)];
        if (stone && course > 0 && y < t - 3 && block >= 0 && hashUnit(block * 13 + course, variant, salt + 3) < 0.08) {
          if (v >= FACE - 1) continue;
          if (v === FACE - 2) {
            set(u, y, v, C.slit);
            continue;
          }
        }
        if (stone) set(u, y, v, stone);
      }
    }
    // Moss dripping over the top edge, both faces; ivy hanging in curtains from the top, inside.
    for (const v of inner ? [0, FACE] : [0, FACE + 1]) {
      const drip = hashUnit(u, v, salt + 11 + variant) < 0.35 ? 1 + Math.floor(hashUnit(u, v, salt + 12) * 3) : 0;
      for (let y = t - 1 - drip; y < t - 1; y++) if (v === 0 || y > PLINTH) set(u, y, v, C.moss);
    }
    const curtain = Math.floor(u / 4);
    for (const [v, side] of inner ? [[0, 0], [FACE, 1]] : [[FACE + 1, 0]]) {
      if (pier || hashUnit(curtain + side * 31, variant, salt + 13) >= 0.3 + variant * 0.1) continue;
      const reach = 6 + Math.floor(hashUnit(curtain + side * 31, variant, salt + 14) * Math.max(1, t - 8));
      for (let y = t - 2 - reach; y < t - 1; y++) if (y > PLINTH && hashUnit(u, y, salt + 15 + side) < 0.75) set(u, y, v, hashUnit(u, y, salt + 16) < 0.5 ? C.ivy : C.ivyLight);
    }
    // Grass at its foot, inside (an inner wall's both sides, just off it: drawn whatever it blocks).
    for (const [v, side] of inner ? [[-1, 0], [FACE + 1, 1]] : [[FACE + 2, 0]]) {
      if (hashUnit(u + side * 31, variant, salt + 17) >= 0.3) continue;
      for (let y = 0; y <= Math.floor(hashUnit(u, 1 + side, salt + 18) * 3); y++) {
        const w = v + from;
        if (alongX) fillBox(grid, u, y, w, u, y, w, C.grass);
        else fillBox(grid, w, y, u, w, y, u, C.grass);
      }
    }
  }
}
