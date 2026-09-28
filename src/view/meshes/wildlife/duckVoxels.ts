// Ducks in voxels, at 0.02 (finer than the world's 0.04; a duck is small),
// each a body and a head so the head can bob and the duck can tip up to feed.
// They face +Z. Three looks share one palette layout:
// - the mallard drake: bottle-green head, white collar, chestnut breast,
//   grey body, black tail with a white band and a curl on top, a blue wing
//   patch and a yellow bill;
// - the hen: mottled browns, a dark stripe through the eye, an orange bill;
// - the duckling: small and fluffy yellow with an olive back.
// Grid-aligned voxels only; the rounder shapes come from stepped corners.

import type { DuckVariant } from '../../../model/wildlife/wildlife';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const DUCK_VOXEL_SIZE = 0.02;

const ROLES = ['body', 'bodyDark', 'back', 'breast', 'tail', 'tailBand', 'wing', 'speculum', 'head', 'headLight', 'collar', 'bill', 'billDark', 'eye'] as const;
type Role = (typeof ROLES)[number];
const C = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;

const COLORS: Record<DuckVariant, Record<Role, number>> = {
  drake: {
    body: 0xb4afa5,
    bodyDark: 0x958f86,
    back: 0x7d786f,
    breast: 0x7a4a32,
    tail: 0x2a2826,
    tailBand: 0xf1eee4,
    wing: 0x8e8a82,
    speculum: 0x3a5aa8,
    head: 0x2f6b3a,
    headLight: 0x3f8a4a,
    collar: 0xf1eee4,
    bill: 0xd8c24a,
    billDark: 0xb09a30,
    eye: 0x1c1a18,
  },
  hen: {
    body: 0x9a7048,
    bodyDark: 0x7a5434,
    back: 0x6a4a2e,
    breast: 0xa87e52,
    tail: 0x6a4a2e,
    tailBand: 0xc8a878,
    wing: 0x7a5434,
    speculum: 0x3a5aa8,
    head: 0xa07a50,
    headLight: 0xb8905e,
    collar: 0xa07a50,
    bill: 0xd88a3a,
    billDark: 0x5a4028,
    eye: 0x1c1a18,
  },
  duckling: {
    body: 0xf0d060,
    bodyDark: 0xd8b440,
    back: 0x9a8a44,
    breast: 0xf6e08a,
    tail: 0xd8b440,
    tailBand: 0xf0d060,
    wing: 0xd8b440,
    speculum: 0xd8b440,
    head: 0xf0d060,
    headLight: 0xf6e08a,
    collar: 0xf0d060,
    bill: 0x6a5a3a,
    billDark: 0x5a4a30,
    eye: 0x1c1a18,
  },
};

export function duckPalette(variant: DuckVariant): number[] {
  return ROLES.map((role) => COLORS[variant][role]);
}

// Body sizes in voxels [x, y, z], and how many rows sit under the water.
export const BODY_GRID: Record<DuckVariant, [number, number, number]> = { drake: [5, 5, 9], hen: [5, 4, 9], duckling: [3, 3, 5] };
export const HEAD_GRID: Record<DuckVariant, [number, number, number]> = { drake: [3, 5, 5], hen: [3, 5, 5], duckling: [3, 4, 4] };
export const SUBMERGED = { adult: 1.5, duckling: 1 };

// An adult's body: tail at z 0 (lifted clear of the water), breast at the
// front, a narrower back, wing patches on the sides. Hens are mottled.
function adultBody(variant: 'drake' | 'hen'): VoxelGrid {
  const grid = createGrid(BODY_GRID[variant]);
  const hen = variant === 'hen';
  fillBox(grid, 0, 0, 0, 4, 3, 8, (x, y, z) => {
    const side = x === 0 || x === 4;
    if (y === 3 && side) return 0; // a narrower back
    if (z === 0 && (y <= 1 || side)) return 0; // the tail lifts up
    if (z === 8 && (y === 0 || y === 3)) return 0; // stepped breast
    if (z === 0) return C.tail;
    if (z === 1) return hen ? C.tail : C.tailBand;
    const mottled = hen && (x + y * 2 + z) % 3 === 0;
    if (z >= 7) return mottled ? C.bodyDark : C.breast;
    if (y === 3) return mottled ? C.bodyDark : C.back;
    if (side && y === 2) return z === 3 || z === 4 ? C.speculum : C.wing;
    if (y === 0 || mottled) return C.bodyDark;
    return C.body;
  });
  if (!hen) setColor(grid, 2, 4, 1, C.tail); // the drake's curl
  return grid;
}

function ducklingBody(): VoxelGrid {
  const grid = createGrid(BODY_GRID.duckling);
  fillBox(grid, 0, 0, 0, 2, 2, 4, (x, y, z) => {
    const side = x === 0 || x === 2;
    if (y === 2 && side) return 0;
    if (z === 0 && (y === 0 || side)) return 0; // a stub of a tail
    if (z === 4 && y === 2) return 0;
    if (y === 2) return C.back;
    if (z >= 3) return C.breast;
    return y === 0 ? C.bodyDark : C.body;
  });
  return grid;
}

export function buildDuckBody(variant: DuckVariant): VoxelGrid {
  return variant === 'duckling' ? ducklingBody() : adultBody(variant);
}

// A head on a short neck, the bill sticking out in front (+Z). The drake
// has a white collar at the base of its neck; the hen a dark eye stripe.
export function buildDuckHead(variant: DuckVariant): VoxelGrid {
  const grid = createGrid(HEAD_GRID[variant]);
  if (variant === 'duckling') {
    setColor(grid, 1, 0, 1, C.head); // neck
    fillBox(grid, 0, 1, 0, 2, 3, 2, (_x, y) => (y === 3 ? C.headLight : C.head));
    for (const x of [0, 2]) setColor(grid, x, 2, 1, C.eye);
    setColor(grid, 1, 1, 3, C.bill);
    return grid;
  }
  setColor(grid, 1, 0, 1, variant === 'drake' ? C.collar : C.head); // neck
  setColor(grid, 1, 1, 1, C.head);
  fillBox(grid, 0, 2, 0, 2, 4, 2, (x, y) => {
    if (y === 4) return C.headLight;
    if (variant === 'hen' && y === 3 && (x === 0 || x === 2)) return C.billDark; // eye stripe
    return C.head;
  });
  for (const x of [0, 2]) setColor(grid, x, 3, 1, C.eye);
  setColor(grid, 1, 2, 3, C.bill);
  setColor(grid, 1, 2, 4, C.billDark); // the nail at the bill's tip
  return grid;
}
