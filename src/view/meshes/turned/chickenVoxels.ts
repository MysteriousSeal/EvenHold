// A hen in voxels, at 0.02 as the ducks are (duckVoxels.ts; a hen is small): whoever's been turned into one
// (model/spells/turned.ts). She faces +Z. Read from the game's camera by her shape and three colours, no more:
// a plump white body carried high on two thin yellow legs, a tail cocked up behind, a small head held forward with
// a red comb on top, a red wattle under a yellow beak. A body, a head and two legs, each its own part, so she can
// strut, bob her head and peck. Grid-aligned voxels only; the rounder shapes come from stepped corners.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const CHICKEN_VOXEL_SIZE = 0.02;

// The palette, said first: white feathers and their shade, the cream of her breast; red; yellow and its shade; an eye.
const ROLES = ['white', 'shade', 'cream', 'red', 'redDark', 'yellow', 'yellowDark', 'eye'] as const;
type Role = (typeof ROLES)[number];
const C = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
export const CHICKEN_PALETTE: number[] = [0xf4f0e6, 0xcfc8b8, 0xfaf3dc, 0xd23a2e, 0x9c241c, 0xe8b23a, 0xb8842a, 0x1c1a18];

export const BODY_GRID: [number, number, number] = [5, 6, 8];
export const HEAD_GRID: [number, number, number] = [3, 6, 5];
export const LEG_GRID: [number, number, number] = [1, 3, 3];
export const LEG_HEIGHT = 3; // voxels the body's carried off the ground

// Her body: breast forward (+Z), rounded by cut corners; the tail at the back, stepped up two rows above her back; a
// wing's shade along each side.
export function buildChickenBody(): VoxelGrid {
  const grid = createGrid(BODY_GRID);
  fillBox(grid, 0, 0, 1, 4, 3, 6, (x, y, z) => {
    const side = x === 0 || x === 4;
    if (side && (y === 0 || y === 3)) return 0; // rounded below and above
    if ((z === 1 || z === 6) && (y === 0 || side)) return 0; // and fore and aft
    if (y === 0) return C.shade; // her underside
    if (z === 6) return C.cream; // the breast
    if (side && y === 2 && z >= 2 && z <= 4) return C.shade; // the wing
    return C.white;
  });
  // The tail: up and back, a fan of three feathers.
  fillBox(grid, 1, 3, 0, 3, 3, 1, C.white);
  fillBox(grid, 1, 4, 0, 3, 4, 0, C.white);
  setColor(grid, 2, 5, 0, C.shade);
  for (const x of [1, 3]) setColor(grid, x, 4, 0, C.shade);
  return grid;
}

// Her head on its neck: the comb in three points along the top, an eye each side, the beak out in front, the wattle
// hung under it.
export function buildChickenHead(): VoxelGrid {
  const grid = createGrid(HEAD_GRID);
  fillBox(grid, 1, 0, 1, 1, 1, 2, C.white); // the neck
  fillBox(grid, 0, 2, 1, 2, 4, 3, C.white); // the head
  for (const x of [0, 2]) setColor(grid, x, 3, 2, C.eye);
  fillBox(grid, 1, 5, 1, 1, 5, 3, (_x, _y, z) => (z === 2 ? C.red : C.redDark)); // the comb
  setColor(grid, 1, 3, 4, C.yellow); // the beak
  setColor(grid, 1, 2, 4, C.red); // the wattle
  setColor(grid, 1, 1, 3, C.redDark);
  return grid;
}

// A leg: a thin shank, a foot of two toes forward.
export function buildChickenLeg(): VoxelGrid {
  const grid = createGrid(LEG_GRID);
  fillBox(grid, 0, 1, 0, 0, 2, 0, C.yellowDark);
  fillBox(grid, 0, 0, 0, 0, 0, 2, C.yellow);
  return grid;
}
