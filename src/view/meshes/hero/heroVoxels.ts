// The hero's base body as voxel parts, palette first: warm skin in three
// shades, chestnut hair, dark eyes with rosy cheeks, and undyed linen braies
// (medieval underwear) with a darker waist cord. This is the bare body armor
// will be fitted over, so it's kept simple and slightly slim.
//
// 0.025 voxels, finer than the world's 0.04: at world scale the 0.45-tall
// hero would be 11 voxels, too coarse for a face or armor detail. Proportions
// are chunky and readable from the isometric camera: 5 voxels of legs, 6 of
// torso, a big 7-voxel head (18 = 0.45 tall). Every part faces +Z (the
// eyes and toes point that way) and is a separate grid, so each can swing on
// its own joint.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const HERO_VOXEL_SIZE = 0.025;

const ENTRIES = {
  skin: 0xf0c49a,
  skinShade: 0xd9a37a,
  skinLight: 0xf8d9b6,
  hair: 0x6b4226,
  hairLight: 0x8a5a35,
  eye: 0x2b2522,
  cheek: 0xe8a58a,
  mouth: 0xb5705a,
  linen: 0xe8dcc0,
  linenShade: 0xcfc0a0,
  cord: 0x8a6a45,
} as const;

export const HERO_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

// Part sizes in voxels [x, y, z].
export const LEG_GRID: [number, number, number] = [3, 5, 4]; // the foot sticks out forward
export const TORSO_GRID: [number, number, number] = [7, 6, 4];
export const ARM_GRID: [number, number, number] = [2, 6, 2];
export const HEAD_GRID: [number, number, number] = [7, 7, 7];

// A leg: linen braies over the thigh, bare shin, a foot one voxel longer
// toward the front (+Z). Shaded on its outer side so the two legs separate.
export function buildLeg(): VoxelGrid {
  const grid = createGrid(LEG_GRID);
  fillBox(grid, 0, 1, 0, 2, 4, 2, (x, y) => (y >= 3 ? (x === 0 ? C.linenShade : C.linen) : x === 0 ? C.skinShade : C.skin));
  fillBox(grid, 0, 0, 0, 2, 0, 3, (x, _y, z) => (z === 3 ? C.skinLight : x === 0 ? C.skinShade : C.skin)); // foot
  return grid;
}

// The torso: braies up to the waist, tied with a cord, bare chest above
// with a hint of shading at the sides, a navel and collarbones.
export function buildTorso(): VoxelGrid {
  const grid = createGrid(TORSO_GRID);
  fillBox(grid, 0, 0, 0, 6, 5, 3, (x, y, z) => {
    if (y <= 1) return x === 0 || z === 0 ? C.linenShade : C.linen;
    if (y === 2) return C.cord;
    return x === 0 || x === 6 || z === 0 ? C.skinShade : C.skin;
  });
  setColor(grid, 3, 3, 3, C.skinShade); // navel
  fillBox(grid, 1, 5, 3, 5, 5, 3, C.skinLight); // collarbones catching the light
  return grid;
}

// An arm hanging from the shoulder, the hand a lighter voxel pair at the end.
export function buildArm(): VoxelGrid {
  const grid = createGrid(ARM_GRID);
  fillBox(grid, 0, 0, 0, 1, 5, 1, (x, y) => (y <= 1 ? C.skinLight : x === 0 ? C.skinShade : C.skin));
  return grid;
}

// The head: a face on the +Z side (eyes two voxels tall, rosy cheeks, a
// small mouth), chestnut hair over the top, back and sides, and a fringe.
export function buildHead(): VoxelGrid {
  const grid = createGrid(HEAD_GRID);
  fillBox(grid, 0, 0, 0, 6, 6, 6, (x, _y, z) => (x === 0 || x === 6 || z === 0 ? C.skinShade : C.skin));
  // Hair: a cap over the top, down the back and the sides above the ears.
  fillBox(grid, 0, 6, 0, 6, 6, 6, (x, _y, z) => ((x + z) % 3 === 0 ? C.hairLight : C.hair));
  fillBox(grid, 0, 1, 0, 6, 5, 1, (x, y) => ((x + y) % 4 === 0 ? C.hairLight : C.hair));
  for (const x of [0, 6]) fillBox(grid, x, 3, 0, x, 5, 4, C.hair);
  fillBox(grid, 1, 5, 6, 5, 5, 6, (x) => (x === 3 ? C.skin : C.hair)); // fringe, parted
  // Face.
  for (const x of [2, 4]) fillBox(grid, x, 2, 6, x, 3, 6, C.eye);
  setColor(grid, 1, 1, 6, C.cheek);
  setColor(grid, 5, 1, 6, C.cheek);
  setColor(grid, 3, 1, 6, C.mouth);
  return grid;
}
