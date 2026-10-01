// A crypt's way out (model/crypts/cryptFoes.ts: exitDoor), in its great hall's
// back wall, a wall piece out from the rock's face (as a niche is: OUT voxels
// toward the floor), in the crypt's stone: a deep round arch between stepped
// jambs, a ring of light wedge stones round it, a skull carved for its
// keystone, an iron brazier burning either side; and in it either the slab
// that seals it (a heavy stone, a skull carved on it: sinking into the floor as
// it opens) or, open, a step up into pale cold light. Three pieces: the frame
// (always), the slab (shut), the light (open), each its own grid.

import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { C, OUT, TALL, TILE } from './cryptVoxels';

export const EXIT_GRID: [number, number, number] = [TILE, TALL, TILE + OUT];
const [A0, A1] = [6, 18]; // the arch's sides
const archTop = (u: number) => 14 + Math.round(6 * Math.sqrt(Math.max(0, 1 - ((u - 12) / 6.6) ** 2)));
const inArch = (u: number, y: number) => u >= A0 && u <= A1 && y < archTop(u);
const FACE = TILE; // the rock's face (all drawn from here out)

export function exitFrame(): VoxelGrid {
  const g = createGrid(EXIT_GRID);
  const set = (u: number, y: number, v: number, c: number) => fillBox(g, u, y, v, u, y, v, c);
  // The jambs, stepped: the outer standing out three, the inner one more; coursed, light.
  for (let y = 0; y <= archTop(12) + 3; y++) {
    for (const [u0, u1] of [[3, 5], [19, 21]]) for (let u = u0; u <= u1; u++) for (let v = FACE; v <= FACE + 2; v++) if (!inArch(u, y)) set(u, y, v, y % 4 === 0 ? C.mortar : u === u0 || u === u1 ? C.stone : C.stoneLight);
    for (const u of [A0 - 1, A1 + 1]) if (y < archTop(A0) + 1) set(u, y, FACE + 3, y % 4 === 0 ? C.mortar : C.stoneLight);
  }
  // The ring of wedge stones over the arch, a voxel out; the keystone, a skull carved in it.
  for (let u = A0 - 2; u <= A1 + 2; u++) {
    const crown = archTop(Math.min(A1, Math.max(A0, u)));
    for (let y = crown; y <= crown + 2; y++) for (let v = FACE; v <= FACE + 3; v++) set(u, y, v, (u + y) % 3 === 0 && v === FACE + 3 ? C.mortar : C.stoneLight);
  }
  fillBox(g, 10, 21, FACE + 3, 14, 26, FACE + 4, C.bone);
  fillBox(g, 11, 20, FACE + 3, 13, 20, FACE + 4, C.boneShade); // its jaw
  fillBox(g, 10, 23, FACE + 4, 11, 24, FACE + 4, C.socket); // its sockets
  fillBox(g, 13, 23, FACE + 4, 14, 24, FACE + 4, C.socket);
  // The threshold: a step before it, worn.
  fillBox(g, A0 - 1, 0, FACE, A1 + 1, 0, FACE + 4, C.stoneDark);
  fillBox(g, A0, 1, FACE, A1, 1, FACE + 1, C.stone);
  // An iron brazier either side: a stand, a bowl, flames.
  for (const u of [1, 23]) {
    fillBox(g, u - 1, 0, FACE + 2, u + 1, 0, FACE + 4, C.ironDark);
    fillBox(g, u, 1, FACE + 3, u, 8, FACE + 3, C.iron);
    fillBox(g, u - 1, 9, FACE + 2, u + 1, 10, FACE + 4, C.iron);
    fillBox(g, u - 1, 11, FACE + 2, u + 1, 11, FACE + 4, C.flame);
    fillBox(g, u, 12, FACE + 3, u, 13, FACE + 3, C.core);
  }
  return g;
}

// The slab sealing it: filling the arch, a voxel out from the face, banded, a skull carved on it.
export function exitSlab(): VoxelGrid {
  const g = createGrid(EXIT_GRID);
  for (let u = A0; u <= A1; u++) for (let y = 0; y < archTop(u); y++) fillBox(g, u, y, FACE, u, y, FACE + 1, y % 6 === 5 ? C.stoneDark : C.lid);
  fillBox(g, 10, 9, FACE + 2, 14, 13, FACE + 2, C.stoneLight); // the skull carved on it
  fillBox(g, 10, 11, FACE + 2, 11, 12, FACE + 2, C.stoneDark);
  fillBox(g, 13, 11, FACE + 2, 14, 12, FACE + 2, C.stoneDark);
  fillBox(g, 11, 8, FACE + 2, 13, 8, FACE + 2, C.stone);
  return g;
}

// The light within, the way open: pale and cold, deeper at its edges.
export function exitLight(): VoxelGrid {
  const g = createGrid(EXIT_GRID);
  for (let u = A0; u <= A1; u++) for (let y = 2; y < archTop(u); y++) fillBox(g, u, y, FACE, u, y, FACE, u === A0 || u === A1 || y === archTop(u) - 1 ? C.portalDeep : C.portal);
  return g;
}
