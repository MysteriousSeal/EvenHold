// The wolf as voxel parts, palette first: three greys of fur with a darker
// saddle along the back, a pale belly, chest and tail tip, amber eyes, a
// black nose and pink inner ears. Same 0.025 voxels as the hero, so the two
// read at one scale. Faces +Z; every part is its own grid so legs, head
// and tail can move on their joints.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const WOLF_VOXEL_SIZE = 0.025;

const ENTRIES = {
  fur: 0x80838b,
  furDark: 0x5d6068,
  saddle: 0x4b4d54,
  furLight: 0xa3a5ab,
  belly: 0xc9c6bc,
  eye: 0xf2b63c,
  nose: 0x222226,
  ear: 0xb08478,
} as const;

export const WOLF_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

export const BODY_GRID: [number, number, number] = [7, 6, 14];
export const HEAD_GRID: [number, number, number] = [6, 8, 9]; // with snout and ears
export const LEG_GRID: [number, number, number] = [2, 6, 2];
export const TAIL_GRID: [number, number, number] = [3, 3, 7];

// Barrel body: pale underside and chest, a dark saddle down the back,
// darker flanks toward the rear.
export function buildBody(): VoxelGrid {
  const grid = createGrid(BODY_GRID);
  fillBox(grid, 0, 0, 0, 6, 5, 13, (x, y, z) => {
    if (y === 5 && x >= 2 && x <= 4) return C.saddle;
    if (y <= 1 || (z >= 12 && y <= 3)) return C.belly;
    if (y === 5) return C.furDark;
    return z <= 4 ? C.furDark : C.fur;
  });
  // Round off the top edges a touch so it reads as a body, not a crate.
  for (const x of [0, 6]) for (const z of [0, 13]) setColor(grid, x, 5, z, 0);
  return grid;
}

// Head: skull with a long snout (black nose at the tip), amber eyes, and
// upright ears with pink insides.
export function buildHead(): VoxelGrid {
  const grid = createGrid(HEAD_GRID);
  fillBox(grid, 0, 0, 0, 5, 4, 4, (x, y) => (y === 4 && x >= 2 && x <= 3 ? C.saddle : x === 0 || x === 5 ? C.furDark : C.fur));
  fillBox(grid, 1, 0, 5, 4, 2, 8, (_x, y) => (y === 0 ? C.belly : C.furLight)); // snout
  fillBox(grid, 2, 1, 8, 3, 2, 8, C.nose);
  setColor(grid, 1, 3, 4, C.eye);
  setColor(grid, 4, 3, 4, C.eye);
  for (const x of [0, 4]) {
    fillBox(grid, x, 5, 1, x + 1, 7, 2, C.furDark); // ears
    setColor(grid, x + (x === 0 ? 1 : 0), 5, 2, C.ear);
    setColor(grid, x + (x === 0 ? 1 : 0), 6, 2, C.ear);
  }
  return grid;
}

export function buildLeg(): VoxelGrid {
  const grid = createGrid(LEG_GRID);
  fillBox(grid, 0, 0, 0, 1, 5, 1, (_x, y) => (y === 0 ? C.furDark : y >= 4 ? C.fur : C.furLight));
  return grid;
}

// Bushy tail, darker along the top, pale at the tip.
export function buildTail(): VoxelGrid {
  const grid = createGrid(TAIL_GRID);
  fillBox(grid, 0, 0, 0, 2, 2, 6, (_x, y, z) => (z <= 1 ? C.belly : y === 2 ? C.furDark : C.fur)); // the root is at +Z, the tip at 0
  return grid;
}
