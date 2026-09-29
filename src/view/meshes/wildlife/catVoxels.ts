// Cats in voxels, at 0.016 (chunky, so they read at a distance), facing +Z,
// in parts so they can walk, sit, groom and curl up (catRig.ts): a body
// (pale belly, a coat's stripes or patch), one leg (a pale paw), the head
// (pointed ears pink inside, eyes, a pink nose, a pale muzzle), and a tail
// in two pieces so it can curl. Four coats: ginger and grey tabby, striped
// down the back; black with a white chest and socks; white with a ginger
// patch.

import type { CatVariant } from '../../../model/wildlife/wildlife';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const CAT_VOXEL_SIZE = 0.016;

const ROLES = ['coat', 'stripe', 'belly', 'paw', 'eye', 'nose', 'earInner', 'patch'] as const;
type Role = (typeof ROLES)[number];
const C = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;

const SHARED = { nose: 0xd8888a, earInner: 0xd89a9a };
const COATS: Record<CatVariant, Omit<Record<Role, number>, keyof typeof SHARED>> = {
  ginger: { coat: 0xd8843a, stripe: 0xa85a24, belly: 0xf2d6a8, paw: 0xf2d6a8, eye: 0x9ac83a, patch: 0xa85a24 },
  tabby: { coat: 0x8a8882, stripe: 0x4e4c48, belly: 0xcac6be, paw: 0xdcd8d0, eye: 0xd8c040, patch: 0x4e4c48 },
  black: { coat: 0x2a2828, stripe: 0x3a3636, belly: 0xf0ece4, paw: 0xf0ece4, eye: 0xa8d048, patch: 0x3a3636 },
  white: { coat: 0xf0ece4, stripe: 0xe0dad0, belly: 0xfaf8f4, paw: 0xfaf8f4, eye: 0x6ab0d8, patch: 0xd8843a },
};

export function catPalette(variant: CatVariant): number[] {
  const colors: Record<Role, number> = { ...SHARED, ...COATS[variant] };
  return ROLES.map((role) => colors[role]);
}

// Part sizes in voxels [x, y, z], and the joint each part turns about.
export const BODY_GRID: [number, number, number] = [4, 4, 10];
export const LEG_GRID: [number, number, number] = [2, 3, 2];
export const HEAD_GRID: [number, number, number] = [5, 5, 4];
export const TAIL_GRID: [number, number, number] = [2, 2, 4];
export const BODY_PIVOT: [number, number, number] = [2, 0, 5]; // under its middle
export const LEG_PIVOT: [number, number, number] = [1, 3, 1]; // the top of the leg
export const HEAD_PIVOT: [number, number, number] = [2.5, 0, 0]; // under the back of the head
export const TAIL_PIVOT: [number, number, number] = [1, 1, 0]; // its root
export const LEG_LENGTH = LEG_GRID[1];
export const TAIL_LENGTH = TAIL_GRID[2];
// Where the head and tail sit on the body, and the legs under it, in voxels from the body's pivot.
export const HEAD_AT: [number, number, number] = [0, 3, 4];
export const TAIL_AT: [number, number, number] = [0, 3, -5];
export const LEGS_AT = { front: 3.5, back: -3.5, side: 1 };

export function buildCatBody(variant: CatVariant): VoxelGrid {
  const grid = createGrid(BODY_GRID);
  const striped = variant === 'ginger' || variant === 'tabby';
  fillBox(grid, 0, 0, 0, 3, 3, 9, (x, y, z) => {
    if (variant === 'black') return z >= 8 && y <= 2 && x >= 1 && x <= 2 ? C.belly : C.coat; // a white chest
    if (y === 0) return C.belly;
    if (striped && y >= 2 && z % 3 === 1) return C.stripe; // down the back and flanks
    if (variant === 'white' && y === 3 && z >= 3 && z <= 6 && x >= 1) return C.patch;
    return C.coat;
  });
  return grid;
}

export function buildCatLeg(): VoxelGrid {
  const grid = createGrid(LEG_GRID);
  fillBox(grid, 0, 0, 0, 1, 2, 1, (_x, y) => (y === 0 ? C.paw : C.coat));
  return grid;
}

export function buildCatHead(variant: CatVariant): VoxelGrid {
  const grid = createGrid(HEAD_GRID);
  fillBox(grid, 0, 0, 0, 4, 3, 3, (x, y) => (y === 3 && (x === 1 || x === 3) && (variant === 'ginger' || variant === 'tabby') ? C.stripe : C.coat)); // the head, stripes on the brow
  fillBox(grid, 1, 0, 3, 3, 1, 3, variant === 'black' ? C.coat : C.belly); // the muzzle
  setColor(grid, 2, 1, 3, C.nose);
  for (const x of [1, 3]) setColor(grid, x, 2, 3, C.eye);
  for (const x of [0, 4]) {
    setColor(grid, x, 4, 1, C.coat); // pointed ears, pink inside
    setColor(grid, x, 4, 2, C.earInner);
  }
  return grid;
}

// One piece of the tail (two make it, the second tipped darker on a striped coat).
export function buildCatTail(variant: CatVariant, tip: boolean): VoxelGrid {
  const grid = createGrid(TAIL_GRID);
  fillBox(grid, 0, 0, 0, 1, 1, 3, (_x, _y, z) => (tip && z === 3 ? (variant === 'white' ? C.patch : C.stripe) : (variant === 'ginger' || variant === 'tabby') && z % 2 === 1 ? C.stripe : C.coat));
  return grid;
}
