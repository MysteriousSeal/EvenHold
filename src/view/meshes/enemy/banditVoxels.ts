// A bandit, on the same body parts and grids as the hero (so it moves on the
// same rig), palette first: an earthy hood framing the face, a dark cloth
// mask over mouth and nose, a leather vest over a dark green shirt, a belt
// with a brass buckle, brown trousers and black boots. Plus a short iron
// sword for the right hand.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import { ARM_GRID, HEAD_GRID, LEG_GRID, TORSO_GRID } from '../hero/heroVoxels';
import type { HumanParts } from '../hero/heroMesh';

const ENTRIES = {
  skin: 0xe2b48c,
  skinShade: 0xc79670,
  hood: 0x6b4a33,
  hoodDark: 0x523826,
  mask: 0x2e2a28,
  eye: 0x2b2522,
  vest: 0x7a5236,
  vestDark: 0x5e3f28,
  shirt: 0x3f4a3a,
  belt: 0x2e2622,
  buckle: 0xb89a5a,
  trousers: 0x4a3b2e,
  boots: 0x2a2420,
  glove: 0x3a2e26,
  steel: 0xb9bec6,
  steelDark: 0x7d828a,
  grip: 0x4a3222,
} as const;

export const BANDIT_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

function leg(): VoxelGrid {
  const grid = createGrid(LEG_GRID);
  fillBox(grid, 0, 1, 0, 2, 4, 2, (x, y) => (y <= 1 ? C.boots : x === 0 ? C.hoodDark : C.trousers));
  fillBox(grid, 0, 0, 0, 2, 0, 3, C.boots);
  return grid;
}

function torso(): VoxelGrid {
  const grid = createGrid(TORSO_GRID);
  fillBox(grid, 0, 0, 0, 6, 5, 3, (x, y, z) => {
    if (y === 1) return x === 3 && z === 3 ? C.buckle : C.belt;
    if (y === 0) return C.trousers;
    if (z === 3 && x === 3 && y >= 3) return C.shirt; // the vest's open front
    if (x === 0 || x === 6) return C.shirt; // sleeves' shoulders
    return z === 0 ? C.vestDark : C.vest;
  });
  return grid;
}

function arm(): VoxelGrid {
  const grid = createGrid(ARM_GRID);
  fillBox(grid, 0, 0, 0, 1, 5, 1, (_x, y) => (y <= 1 ? C.glove : C.shirt));
  return grid;
}

// Hooded head: the hood over the top, back and sides, a brim over the
// brow; the face shows only between brim and mask.
function head(): VoxelGrid {
  const grid = createGrid(HEAD_GRID);
  fillBox(grid, 0, 0, 0, 6, 6, 6, (x, _y, z) => (x === 0 || x === 6 || z === 0 ? C.skinShade : C.skin));
  fillBox(grid, 0, 5, 0, 6, 6, 6, (x) => (x % 3 === 0 ? C.hoodDark : C.hood)); // crown
  fillBox(grid, 0, 0, 0, 6, 6, 1, C.hood); // back
  for (const x of [0, 6]) fillBox(grid, x, 0, 0, x, 6, 6, C.hoodDark); // sides
  fillBox(grid, 1, 1, 6, 5, 2, 6, C.mask);
  for (const x of [2, 4]) setColor(grid, x, 3, 6, C.eye);
  return grid;
}

export const BANDIT_PARTS: HumanParts = { palette: BANDIT_PALETTE, leg, torso, arm, head };

// A short sword along +Z from the hilt (the hand): grip, crossguard, blade.
export const SWORD_GRID: [number, number, number] = [3, 1, 11];
export function buildSword(): VoxelGrid {
  const grid = createGrid(SWORD_GRID);
  fillBox(grid, 1, 0, 0, 1, 0, 1, C.grip);
  fillBox(grid, 0, 0, 2, 2, 0, 2, C.steelDark); // crossguard
  fillBox(grid, 1, 0, 3, 1, 0, 10, (_x, _y, z) => (z === 10 ? C.steelDark : C.steel));
  return grid;
}
