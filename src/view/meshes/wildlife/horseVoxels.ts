// A horse in voxels, at 0.03 (a little finer than the world's 0.04: it's seen close, among people): whoever's been
// turned into one (model/spells/chickens.ts). It faces +Z. A bay, read from the game's camera by its shape and few
// colours: a long barrel of a body carried high on four straight legs, black from the knee down to dark hooves; a
// neck arched up and forward, a black mane down the back of it; a long head, a white blaze down its face, two ears;
// a black tail hung behind. A body (its tail with it), a head on its neck (so it can be lowered to graze, or
// tossed) and four legs, each its own part. Grid-aligned voxels only; the rounder shapes come from stepped corners.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const HORSE_VOXEL_SIZE = 0.03;

// The palette, said first: its coat, the shade of its underside, the light along its back; black (mane, tail,
// stockings); its hooves; white (the blaze); an eye.
const ROLES = ['coat', 'shade', 'light', 'black', 'hoof', 'white', 'eye'] as const;
type Role = (typeof ROLES)[number];
const C = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
export const HORSE_PALETTE: number[] = [0x8a5a34, 0x6a4226, 0xa06c40, 0x241c18, 0x3a3028, 0xf0e8d8, 0x14100e];

export const HORSE_BODY: [number, number, number] = [6, 7, 19]; // (its tail hung behind it: the row at z 0)
export const HORSE_HEAD: [number, number, number] = [4, 9, 12];
export const HORSE_LEG: [number, number, number] = [2, 9, 2];
export const HORSE_LEG_HEIGHT = 9; // voxels the body's carried off the ground
// Where its parts sit, in voxels from the middle of it on the ground: each leg's hip (across, along), the base of its neck.
export const HORSE_LEGS: ReadonlyArray<[x: number, z: number]> = [[-2, -7], [2, -7], [-2, 7], [2, 7]]; // hind left, hind right, fore left, fore right
export const HORSE_NECK: [number, number, number] = [0, HORSE_LEG_HEIGHT + 6, 6]; // (on its back, at the front of it)

// Its body: a barrel, rounded by cut corners, its chest forward (+Z) and its quarters behind; darker underneath,
// lighter along the back; its tail, black, hung from the top of its quarters down behind.
export function buildHorseBody(): VoxelGrid {
  const grid = createGrid(HORSE_BODY);
  fillBox(grid, 0, 1, 1, 5, 6, 18, (x, y, z) => {
    const side = x === 0 || x === 5;
    if (side && (y === 1 || y === 6)) return 0; // rounded below and above
    if ((z === 1 || z === 18) && (side || y === 1)) return 0; // and fore and aft
    if (y === 1) return C.shade; // its belly
    if (y === 6) return C.light; // along its back
    return side && y === 2 ? C.shade : C.coat;
  });
  fillBox(grid, 2, 0, 0, 3, 6, 0, C.black); // the tail
  return grid;
}

// Its head on its neck: the neck sloped up and well forward from its base (three steps, each two up and two
// forward), the mane black down the back of it; the head long, carried out before the top of the neck and a little
// down, its muzzle narrower; a white blaze down its face; an eye each side; ears, a forelock between them.
export function buildHorseHead(): VoxelGrid {
  const grid = createGrid(HORSE_HEAD);
  for (const [y, z] of [[0, 0], [2, 2], [4, 4]]) {
    fillBox(grid, 0, y, z + 1, 3, y + 2, z + 3, C.coat);
    fillBox(grid, 1, y + 1, z, 2, y + 2, z, C.black); // the mane, behind it
  }
  // The head: long, forward, its nose a step down.
  fillBox(grid, 0, 5, 6, 3, 7, 9, C.coat);
  fillBox(grid, 1, 4, 9, 2, 6, 11, C.coat); // the muzzle
  fillBox(grid, 1, 7, 7, 2, 7, 9, C.white); // the blaze,
  fillBox(grid, 1, 6, 10, 2, 6, 11, C.white); // down to its nose
  for (const x of [0, 3]) setColor(grid, x, 6, 8, C.eye);
  for (const x of [0, 3]) setColor(grid, x, 8, 6, C.coat); // ears
  fillBox(grid, 1, 8, 6, 2, 8, 6, C.black); // the forelock between them
  fillBox(grid, 1, 4, 11, 2, 4, 11, C.shade); // its lip
  return grid;
}

// A leg: straight, its coat's colour to the knee, black below it, a dark hoof.
export function buildHorseLeg(): VoxelGrid {
  const grid = createGrid(HORSE_LEG);
  fillBox(grid, 0, 0, 0, 1, 8, 1, (_x, y) => (y === 0 ? C.hoof : y <= 4 ? C.black : C.coat));
  return grid;
}
