// Deer in voxels, at 0.025 (like people), facing +Z, in parts so the legs
// can stride and the head can drop to graze: a body (pale belly, white rump
// and a little tail, a darker line down the back), one leg (dark shins,
// hooves), and the head on its neck (ears, eyes, a dark nose). The stag
// carries antlers, stepped out and up with tines, grid-aligned; the fawn is
// lighter and dappled with white spots, and drawn smaller (deerRig.ts).

import type { DeerVariant } from '../../../model/wildlife/wildlife';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const DEER_VOXEL_SIZE = 0.025;

const ROLES = ['coat', 'coatDark', 'belly', 'white', 'hoof', 'nose', 'eye', 'antler', 'antlerTip', 'spot'] as const;
type Role = (typeof ROLES)[number];
const C = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;

const SHARED = { belly: 0xe6d8bc, white: 0xf3ede0, hoof: 0x2e241c, nose: 0x241c18, eye: 0x17110d, antler: 0xd6c49c, antlerTip: 0xf0e6cc, spot: 0xf6efdc };
const COATS: Record<DeerVariant, { coat: number; coatDark: number }> = {
  stag: { coat: 0x8c5a32, coatDark: 0x6a4224 },
  doe: { coat: 0xa26c40, coatDark: 0x7e5230 },
  fawn: { coat: 0xb67a48, coatDark: 0x8e5c36 },
};

export function deerPalette(variant: DeerVariant): number[] {
  const colors: Record<Role, number> = { ...SHARED, ...COATS[variant] };
  return ROLES.map((role) => colors[role]);
}

// Part sizes in voxels [x, y, z], and the joint each part turns about.
export const BODY_GRID: [number, number, number] = [6, 6, 15];
export const LEG_GRID: [number, number, number] = [2, 9, 2];
export const HEAD_GRID: [number, number, number] = [8, 15, 8];
export const BODY_PIVOT: [number, number, number] = [3, 0, 7.5]; // under its middle
export const LEG_PIVOT: [number, number, number] = [1, 9, 1]; // the top of the leg
export const HEAD_PIVOT: [number, number, number] = [4, 0, 2]; // the base of the neck
export const LEG_LENGTH = LEG_GRID[1];
// Where the neck sits on the body, and the legs under it, in voxels from the body's pivot.
export const NECK_AT: [number, number, number] = [0, 5, 5];
export const LEGS_AT = { front: 5, back: -5, side: 1.5 };

export function buildDeerBody(variant: DeerVariant): VoxelGrid {
  const grid = createGrid(BODY_GRID);
  fillBox(grid, 0, 0, 1, 5, 5, 14, (x, y, z) => {
    if (y === 0) return C.belly;
    if (y === 5 && (x === 2 || x === 3)) return C.coatDark; // down the back
    if (z === 1 && y >= 2 && x >= 1 && x <= 4) return C.white; // the rump
    // A fawn's spots, in rows along its flanks and back.
    if (variant === 'fawn' && y >= 2 && (x === 0 || x === 5 || y === 5) && (y * 3 + z * 5 + x) % 7 === 0) return C.spot;
    return C.coat;
  });
  fillBox(grid, 2, 3, 0, 3, 5, 0, (_x, y) => (y === 5 ? C.coatDark : C.white)); // the tail, white beneath
  return grid;
}

export function buildDeerLeg(): VoxelGrid {
  const grid = createGrid(LEG_GRID);
  fillBox(grid, 0, 0, 0, 1, 8, 1, (_x, y) => (y === 0 ? C.hoof : y < 4 ? C.coatDark : C.coat));
  return grid;
}

export function buildDeerHead(variant: DeerVariant): VoxelGrid {
  const grid = createGrid(HEAD_GRID);
  fillBox(grid, 3, 0, 1, 4, 6, 3, (_x, y, z) => (z === 3 && y >= 2 ? C.white : C.coat)); // the neck, a pale throat
  fillBox(grid, 2, 6, 1, 5, 9, 4, C.coat); // the head
  fillBox(grid, 3, 6, 5, 4, 8, 7, (_x, y, z) => (z === 7 && y >= 7 ? C.nose : y === 6 ? C.white : C.coat)); // the muzzle
  for (const x of [2, 5]) setColor(grid, x, 8, 3, C.eye);
  for (const x of [1, 6]) fillBox(grid, x, 9, 1, x, 10, 2, (_x, y) => (y === 10 ? C.coatDark : C.coat)); // ears
  if (variant === 'stag') {
    // Antlers: each beam steps out and up from the crown, with a tine
    // forward, one back, and pale tips.
    for (const s of [-1, 1]) {
      const bx = s < 0 ? 2 : 5;
      for (const [x, y, z] of [[bx, 10, 2], [bx + s, 11, 2], [bx + s, 12, 2], [bx + 2 * s, 13, 2], [bx + s, 12, 3], [bx + 2 * s, 13, 1]]) setColor(grid, x, y, z, C.antler);
      for (const [x, y, z] of [[bx + 2 * s, 14, 2], [bx + s, 13, 4], [bx + 2 * s, 14, 0]]) setColor(grid, x, y, z, C.antlerTip);
      setColor(grid, bx + s, 13, 3, C.antler);
      setColor(grid, bx + 2 * s, 13, 0, C.antler);
    }
  }
  return grid;
}
