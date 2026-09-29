// The wild boar as voxel parts, palette first: dark bristly brown flecked
// with grizzled lighter hairs, a near-black ridge down the back (humped over
// the shoulders) and hooves, a pink-grey snout disc with dark nostrils,
// small black eyes, and ivory tusks curving up from its jaw. Same 0.025
// voxels as the wolf, but lower and stockier: short thick legs, a heavy
// barrel of a body, the head carried low. Faces +Z, in parts like the wolf's.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

const ENTRIES = {
  coat: 0x5a4232,
  grizzle: 0x7e654c,
  ridge: 0x2a2220,
  belly: 0x4a3628,
  hoof: 0x1c1816,
  snout: 0xb48c84,
  nostril: 0x5e403a,
  tusk: 0xf0e6cc,
  eye: 0x120e0e,
} as const;

export const BOAR_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

export const BOAR_BODY_GRID: [number, number, number] = [8, 7, 13];
export const BOAR_HEAD_GRID: [number, number, number] = [6, 7, 8];
export const BOAR_LEG_GRID: [number, number, number] = [2, 4, 2];
export const BOAR_TAIL_GRID: [number, number, number] = [1, 1, 4];

// A heavy barrel: the ridge down the back rising to a hump over the
// shoulders, grizzled flecks on the flanks, a darker belly.
export function buildBoarBody(): VoxelGrid {
  const grid = createGrid(BOAR_BODY_GRID);
  fillBox(grid, 0, 0, 0, 7, 5, 12, (x, y, z) => {
    if (y === 5 && (x === 3 || x === 4)) return C.ridge;
    if (y === 0) return C.belly;
    return (x + y * 3 + z * 5) % 7 === 0 ? C.grizzle : C.coat;
  });
  fillBox(grid, 2, 6, 7, 5, 6, 11, (x) => (x === 3 || x === 4 ? C.ridge : C.coat)); // the hump at the shoulders
  for (const x of [0, 7]) for (const z of [0, 12]) setColor(grid, x, 5, z, 0); // its top edges rounded a touch
  return grid;
}

// A low wedge of a head: the skull, tapering to a flat snout disc with two
// nostrils, small black eyes, pointed ears, and a tusk curving up from each side of the jaw.
export function buildBoarHead(): VoxelGrid {
  const grid = createGrid(BOAR_HEAD_GRID);
  fillBox(grid, 0, 1, 0, 5, 5, 3, (x, y) => (y === 5 && (x === 2 || x === 3) ? C.ridge : C.coat)); // the skull
  fillBox(grid, 1, 1, 4, 4, 3, 6, (_x, y) => (y === 1 ? C.belly : C.coat)); // the wedge of the face
  fillBox(grid, 1, 1, 7, 4, 3, 7, C.snout); // the snout's flat disc
  setColor(grid, 2, 2, 7, C.nostril);
  setColor(grid, 3, 2, 7, C.nostril);
  setColor(grid, 1, 4, 3, C.eye);
  setColor(grid, 4, 4, 3, C.eye);
  for (const x of [0, 5]) {
    fillBox(grid, x, 6, 1, x, 6, 2, C.ridge); // pointed ears
    setColor(grid, x, 1, 5, C.tusk); // a tusk from the jaw, curving up and forward
    setColor(grid, x, 2, 6, C.tusk);
  }
  return grid;
}

export function buildBoarLeg(): VoxelGrid {
  const grid = createGrid(BOAR_LEG_GRID);
  fillBox(grid, 0, 0, 0, 1, 3, 1, (_x, y) => (y === 0 ? C.hoof : C.coat));
  return grid;
}

// A thin tail with a dark tuft (the root at +Z, the tip at 0).
export function buildBoarTail(): VoxelGrid {
  const grid = createGrid(BOAR_TAIL_GRID);
  fillBox(grid, 0, 0, 0, 0, 0, 3, (_x, _y, z) => (z === 0 ? C.ridge : C.coat));
  return grid;
}
