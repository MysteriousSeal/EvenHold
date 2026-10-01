// A crypt's way down (model/crypts/crypts.ts), two tiles wide (50 x 25
// voxels, in the ruins' palette and stone: ruinVoxels.ts), opening toward
// local +Z where the hero stands: steps going down between two kerbs toward a
// stone front at the back with a round arch in it, black inside; each step
// darker than the last till they're lost in the dark under the arch. A rusted
// iron gate at their head, its two leaves swung back along the kerbs. Moss on
// the kerbs and along the top, ivy up the front. By variant: one leaf sagging
// off its hinges or gone, a corner of the front crumbled away.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { C, block, ivyAt, overgrown } from './ruinVoxels';

export const STAIRS_GRID: [number, number, number] = [50, 40, 25];

const KERB = 6; // the kerbs' height, and the top step's
const FRONT = 6; // the stone front's depth, from the back
const HIGH = 33; // its height
const ARCH = [8, 41] as const; // the arch's sides, across
const archTop = (u: number) => 17 + Math.round(9 * Math.sqrt(Math.max(0, 1 - ((u - 24.5) / 17) ** 2)));
const STEP_TONES = [C.stoneLight, C.stone, C.stoneDark, C.mortar, C.slit, C.dark];

export function buildCryptStairs(variant: number): VoxelGrid {
  const grid = createGrid(STAIRS_GRID);
  const set = (u: number, y: number, v: number, color: number) => fillBox(grid, u, y, v, u, y, v, color);
  const inArch = (u: number, y: number) => u >= ARCH[0] && u <= ARCH[1] && y < archTop(u);

  // The kerbs either side, coursed stone, moss along their tops.
  for (const [u0, u1] of [[0, 5], [44, 49]]) {
    for (let u = u0; u <= u1; u++) for (let y = 0; y <= KERB; y++) for (let v = FRONT; v <= 24; v++) set(u, y, v, overgrown(u + v, y, KERB, variant, 61) || block(u + v * 3, y, u, 61));
  }
  // The steps: six, three deep, down from the kerbs' height toward the arch, each darker; then the dark.
  for (let k = 0; k < 6; k++) {
    const [v0, v1, top] = [22 - k * 3, 24 - k * 3, KERB - 1 - k];
    for (let u = 6; u <= 43; u++) {
      for (let v = v0; v <= v1; v++) {
        for (let y = 0; y <= top; y++) set(u, y, v, y === top ? (v === v0 && k < 3 ? STEP_TONES[k + 1] : STEP_TONES[k]) : STEP_TONES[Math.min(5, k + 2)]);
        if (k < 2 && hashUnit(u, v, 62 + variant) < 0.05) set(u, top + 1, v, C.grass); // grass in the cracks, at the head
      }
    }
  }
  fillBox(grid, 6, 0, 0, 43, 0, 6, C.dark);

  // The stone front at the back: coursed, its top ragged where a corner's crumbled (by variant), the arch through it, dark within.
  const broken = (u: number) => (variant % 2 === 1 && u > 34 ? Math.floor((u - 34) * 0.9 + hashUnit(Math.floor(u / 3), variant, 63) * 3) : 0) + (variant >= 2 && u < 9 ? Math.floor((9 - u) * 0.6) : 0);
  for (let u = 0; u <= 49; u++) {
    const top = HIGH - broken(u);
    for (let y = 0; y <= top; y++) {
      if (inArch(u, y)) {
        for (let v = 0; v <= 1; v++) set(u, y, v, C.dark); // (beyond: the dark)
        continue;
      }
      for (let v = 0; v < FRONT; v++) set(u, y, v, overgrown(u, y, top, variant, 64) || (v === FRONT - 1 ? ivyAt(u, y, variant, 65) : 0) || block(u, y, v, 64));
    }
    // The cap: a course standing out along the top.
    if (top >= HIGH - 1) fillBox(grid, u, top - 1, 0, u, top, FRONT, hashUnit(u, variant, 66) < 0.4 ? C.moss : C.stoneDark);
  }
  // The arch's ring of wedge stones, light, standing out a voxel; the keystone at its crown.
  for (let u = ARCH[0] - 2; u <= ARCH[1] + 2; u++) {
    const crown = archTop(Math.min(ARCH[1], Math.max(ARCH[0], u)));
    for (let y = crown; y <= crown + 2; y++) if (y <= HIGH - broken(u)) set(u, y, FRONT, (u + y) % 5 === 0 ? C.mortar : C.stoneLight);
  }
  for (const u of [ARCH[0] - 2, ARCH[0] - 1, ARCH[1] + 1, ARCH[1] + 2]) for (let y = 0; y < archTop(ARCH[0]); y++) set(u, y, FRONT, y % 5 === 0 ? C.mortar : C.stoneLight); // its jambs
  fillBox(grid, 22, archTop(24), FRONT, 27, archTop(24) + 5, FRONT + 1, C.stoneLight);
  fillBox(grid, 23, archTop(24) + 1, FRONT + 1, 26, archTop(24) + 4, FRONT + 1, C.stone);

  // The gate: a leaf swung back along each kerb from its hinge at the head of the steps, bars and rails of rusted iron;
  // one sagging off its hinge (by variant), the other gone in two of them.
  const leaf = (u: number, sag: boolean) => {
    for (let v = 8; v <= 23; v++) {
      const drop = sag ? Math.floor((23 - v) / 5) : 0;
      const [low, high] = [KERB + 1 - drop, KERB + 14 - drop];
      for (const y of [low, low + 6, high]) set(u, y, v, C.iron); // the rails
      if (v % 3 === 2 || v === 23) for (let y = low; y <= high + 2; y++) set(u, y, v, hashUnit(v, y, 67 + u) < 0.35 ? C.rustDark : C.rust); // a bar, its spike above
    }
  };
  leaf(6, variant === 1);
  if (variant < 2) leaf(43, variant === 0);
  for (const u of [5, 44]) fillBox(grid, u, KERB + 1, 24, u, KERB + 16, 24, C.iron); // the hinge posts
  return grid;
}
