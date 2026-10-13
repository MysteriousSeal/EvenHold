// A rat in voxels, at 0.012 (as the toad is: toadVoxels.ts; a rat stands six voxels to the top of its ears at that):
// whoever's been turned into one. It faces +Z. Read from the game's camera by its shape and two colours: a long low
// body, three voxels wide, its back arched over its haunches and falling to its shoulders; a head drawn out to a
// point, a pink nose at the end of it; two round pink ears stood up and out, behind; a long thin pink tail laid out
// along the ground, as long again as its body; four pink feet, all there is to see of its legs. Close to (its
// turning: view/cinema/): a darker stripe down its back, a bead of an eye each side, pale whiskers out from its
// snout. A body (its tail with it: `isRatTail`, a part of its own in its rig, in two lengths), a head and four legs,
// each its own part. An odd number of voxels wide throughout, so its snout, its nose and its tail are in the middle
// of it. Grid-aligned voxels only.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import type { Quadruped } from './quadruped';

export const RAT_VOXEL_SIZE = 0.012;

// The palette, said first: its coat, and the shade of it down its back; the pale of its chin and chest; pink (its
// ears, nose, feet and tail); an eye; its whiskers.
const ROLES = ['coat', 'shade', 'belly', 'pink', 'eye', 'whisker'] as const;
type Role = (typeof ROLES)[number];
export const RAT_COLORS = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
const C = RAT_COLORS;
// Its coats, each the same roles in other colours: brown; black (its eyes a dull red, to be seen in it).
export const RAT_PALETTES: number[][] = [
  [0x86633f, 0x5e4229, 0xd2bf9c, 0xdc9a8c, 0x14100d, 0xe4dccb],
  [0x3a3533, 0x24201f, 0x6a625c, 0xcf8d86, 0x9a2c24, 0xdcd6ca],
];

export const RAT_TAIL = 8; // voxels its tail's long: the rows of its body's grid behind its rump
export const RAT_BODY: [number, number, number] = [3, 5, RAT_TAIL + 7];
export const RAT_HEAD: [number, number, number] = [5, 5, 5];
export const RAT_LEG: [number, number, number] = [1, 1, 2];
export const RAT_LEG_HEIGHT = 1; // voxels its hips are off the ground: no more than its feet
// Where each part's own (0, 0, 0) is from where it hangs, in voxels.
export const RAT_BODY_PIVOT: [number, number, number] = [1.5, 1, RAT_TAIL + 3];
export const RAT_HEAD_PIVOT: [number, number, number] = [2.5, 0, 0];
export const RAT_LEG_PIVOT: [number, number, number] = [0.5, 1, 0];
// Where its parts sit, in voxels from the middle of its body on the ground: each foot (across, along), the back of its head.
export const RAT_LEGS: ReadonlyArray<[x: number, z: number]> = [[-1, -3], [1, -3], [-1, 2], [1, 2]]; // hind left, hind right, fore left, fore right
export const RAT_NECK: [number, number, number] = [0, 1, 4];

// Its back, slice by slice from its rump to its shoulders: the row each rises to (from row 1: its feet under it).
const BACK = [2, 3, 4, 4, 3, 3, 3];

// Its body: rounded behind; the top of its arched back one voxel wide, darker, the stripe carried on down to its
// shoulders; its chest pale. Its tail: out of its rump a row up, then down along the ground.
export function buildRatBody(): VoxelGrid {
  const grid = createGrid(RAT_BODY);
  for (const [i, top] of BACK.entries()) {
    for (let y = 1; y <= top; y++) {
      for (let x = 0; x < 3; x++) {
        if (x !== 1 && (y === 4 || (i === 0 && y === 2))) continue; // (rounded: over its haunches, and behind)
        setColor(grid, x, y, RAT_TAIL + i, y === top && x === 1 ? C.shade : y === 1 && (x === 1 || i === BACK.length - 1) ? C.belly : C.coat);
      }
    }
  }
  setColor(grid, 1, 1, RAT_TAIL - 1, C.pink);
  for (let z = 0; z < RAT_TAIL - 1; z++) setColor(grid, 1, 0, z, C.pink);
  return grid;
}
// Its tail, of its body's voxels, and the far half of that.
export const isRatTail = (_x: number, _y: number, z: number): boolean => z < RAT_TAIL;
export const isRatTailEnd = (_x: number, _y: number, z: number): boolean => z < RAT_TAIL / 2;
// Where its tail turns, in its body's voxels: at its rump; and half way along it.
export const RAT_TAIL_JOINT: [number, number, number] = [1.5, 1.5, RAT_TAIL];
export const RAT_TAIL_END_JOINT: [number, number, number] = [1.5, 0.5, RAT_TAIL / 2];

// Its head: three wide behind, an eye high on each side, its chin pale; its snout narrowing to one voxel, the nose
// at the end of it; its ears, round, a voxel out past each side of it; its whiskers, a pale voxel each side of its snout.
export function buildRatHead(): VoxelGrid {
  const grid = createGrid(RAT_HEAD);
  for (let z = 0; z <= 2; z++) {
    for (let y = 0; y <= (z === 2 ? 1 : 2); y++) for (let x = 1; x <= 3; x++) setColor(grid, x, y, z, y === 0 && z > 0 ? C.belly : y === 2 && x === 2 ? C.shade : C.coat);
  }
  for (const x of [1, 3]) setColor(grid, x, 2, 1, C.eye);
  setColor(grid, 2, 0, 3, C.belly);
  setColor(grid, 2, 1, 3, C.coat);
  setColor(grid, 2, 1, 4, C.pink);
  for (const x of [0, 1, 3, 4]) for (const y of [3, 4]) setColor(grid, x, y, 0, C.pink); // an ear: two by two
  for (const x of [1, 3]) setColor(grid, x, 1, 3, C.whisker);
  return grid;
}

// A foot: pink, two voxels long.
export function buildRatLeg(): VoxelGrid {
  const grid = createGrid(RAT_LEG);
  for (const z of [0, 1]) setColor(grid, 0, 0, z, C.pink);
  return grid;
}

// A rat in one of its coats, said once (quadruped.ts): for its rig, its turning, its icon.
export const ratShape = (coat = 0): Quadruped => ({ voxel: RAT_VOXEL_SIZE, palette: RAT_PALETTES[coat] ?? RAT_PALETTES[0], legHeight: RAT_LEG_HEIGHT, legs: RAT_LEGS, neck: RAT_NECK, pivots: { body: RAT_BODY_PIVOT, head: RAT_HEAD_PIVOT, leg: RAT_LEG_PIVOT }, body: buildRatBody, head: buildRatHead, leg: buildRatLeg });
