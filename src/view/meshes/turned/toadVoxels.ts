// A toad in voxels: whoever's been turned into one. It faces +Z. At 0.012, finer than the hen and the cattle (0.02):
// a toad stands six voxels high at that, the least its shape can be said in (at 0.02 it would be four: a lump), and
// no finer, so that a voxel of it is still a dot from the game's camera. Read from there by its shape and two
// colours: a squat body, wider than it's tall, its back sloping down from its shoulders to the ground behind; a
// broad flat head set straight on it, no neck, the mouth a dark line right round the front of it over a pale jaw;
// its eyes two bumps on top of its head, gold; a great folded hind leg along each side, a short foreleg under each
// shoulder, turned out. Close to (its turning: view/cinema/): warts, the lighter bumps on its back and the spots on
// its shoulders; a pale throat under its jaw (`isToadThroat`: a part of its own in its rig, to pulse). A body, a head
// and four legs, each its own part. Grid-aligned voxels only; what's round, stepped.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import type { Quadruped } from './quadruped';

export const TOAD_VOXEL_SIZE = 0.012;

// The palette, said first: its skin and the shade of it (low on its flanks, its feet, its knees); its warts (the
// spots in its skin, and the bumps that stand out of it: a shade apart, to be told from each other); the pale of its
// belly, jaw and throat; the line of its mouth; the gold of its eyes, and their pupils.
const ROLES = ['skin', 'shade', 'wart', 'bump', 'belly', 'mouth', 'eye', 'pupil'] as const;
type Role = (typeof ROLES)[number];
export const TOAD_COLORS = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
const C = TOAD_COLORS;
// Its coats, each the same roles in other colours: brown; green.
const EYES = [0xe2aa2c, 0x17130f];
export const TOAD_PALETTES: number[][] = [
  [0x8c6a40, 0x69492a, 0xb8965c, 0xc4a266, 0xdccb9e, 0x38281a, ...EYES],
  [0x6c8c38, 0x4c6a28, 0xa6b458, 0xb2c062, 0xdedca4, 0x2a3416, ...EYES],
];

export const TOAD_BODY: [number, number, number] = [6, 5, 6];
export const TOAD_HEAD: [number, number, number] = [6, 5, 4];
export const TOAD_LEG: [number, number, number] = [2, 4, 5];
export const TOAD_LEG_HEIGHT = 2; // voxels its hips and shoulders are off the ground (its belly's on it, between its legs)
// Where each part's own (0, 0, 0) is from where it hangs, in voxels.
export const TOAD_BODY_PIVOT: [number, number, number] = [3, 2, 4];
export const TOAD_HEAD_PIVOT: [number, number, number] = [3, 0, 0];
export const TOAD_LEG_PIVOT: [number, number, number] = [1, 2, 2];
// Where its parts sit, in voxels from the middle of it on the ground: each leg's hip (across, along), the back of its jaw.
export const TOAD_LEGS: ReadonlyArray<[x: number, z: number]> = [[-3, -2], [3, -2], [-3, 1], [3, 1]]; // hind left, hind right, fore left, fore right
export const TOAD_NECK: [number, number, number] = [0, 1, 2];

// Its body, slice by slice from its rump (z 0) to its shoulders (z 5): the rows each fills, bottom to top. Its back
// slopes down behind; its chest is held up off the ground on its forelegs.
const SLICES: ReadonlyArray<[bottom: number, top: number]> = [[0, 2], [0, 3], [0, 3], [0, 4], [1, 4], [1, 4]];
// Its warts: the spots in its skin (its shoulders, a flank), and the bumps stood on its back, behind.
const SPOTS: ReadonlyArray<[number, number, number]> = [[1, 4, 3], [4, 4, 5], [0, 3, 4], [5, 3, 5], [3, 3, 1], [2, 4, 4]];
const BUMPS: ReadonlyArray<[number, number, number]> = [[4, 3, 0], [1, 4, 1], [3, 4, 2]];
// (The spots on its head; and where its eyes are before they rise to the top of it, as its turning has them: on its face.)
const HEAD_SPOTS: ReadonlyArray<[number, number, number]> = [[3, 3, 0], [1, 3, 1]];
export const TOAD_FACE_EYES: ReadonlyArray<[number, number, number]> = [[1, 3, 3], [4, 3, 3]];

// Six wide at its shoulders; four where a leg lies along it (a hind leg, to the top of its knee; a foreleg, under
// its shoulder), so no leg's ever inside it.
export function buildToadBody(): VoxelGrid {
  const grid = createGrid(TOAD_BODY);
  for (const [z, [bottom, top]] of SLICES.entries()) {
    for (let y = bottom; y <= top; y++) {
      const inset = (z <= 3 && y <= 3) || y <= 1 ? 1 : 0;
      for (let x = inset; x < TOAD_BODY[0] - inset; x++) setColor(grid, x, y, z, y === bottom ? C.belly : y <= 2 ? C.shade : C.skin);
    }
  }
  for (const [x, y, z] of SPOTS) setColor(grid, x, y, z, C.wart);
  for (const [x, y, z] of BUMPS) setColor(grid, x, y, z, C.bump);
  return grid;
}

// Its head: a pale throat under it (row 0); its jaw, pale; its mouth, a dark line across the front and back along
// each side; its crown; and on top of that its eyes, a bump each side: gold, the pupil to the front and outside.
export function buildToadHead(): VoxelGrid {
  const grid = createGrid(TOAD_HEAD);
  for (let z = 0; z <= 2; z++) for (let x = 1; x <= 4; x++) setColor(grid, x, 0, z, C.belly);
  for (let z = 0; z <= 3; z++) {
    const inset = z === 3 ? 1 : 0; // (its snout: blunt, a voxel in each side)
    for (let y = 1; y <= 3; y++) {
      for (let x = inset; x < 6 - inset; x++) setColor(grid, x, y, z, y === 1 ? C.belly : y === 2 && (z === 3 || (z === 2 && (x === 0 || x === 5))) ? C.mouth : C.skin);
    }
  }
  for (const [x, y, z] of HEAD_SPOTS) setColor(grid, x, y, z, C.wart);
  for (const [outer, inner] of [[0, 1], [5, 4]]) {
    setColor(grid, outer, 4, 1, C.eye);
    setColor(grid, outer, 4, 2, C.pupil);
    setColor(grid, inner, 4, 2, C.eye);
    setColor(grid, inner, 4, 1, C.skin);
  }
  return grid;
}
// Its throat, of its head's voxels (those hung under its jaw).
export const isToadThroat = (_x: number, y: number, _z: number): boolean => y === 0;
// Where its throat hangs from, in its head's voxels: the back of it, under its jaw.
export const TOAD_THROAT_JOINT: [number, number, number] = [3, 1, 0];

// A leg, row by row up from the ground: how far along it reaches (from, to). A hind leg, folded: a long foot
// forward along the ground, its shank back over that, its thigh forward again, its knee stood up beside its back.
// A foreleg: short and straight, its foot turned forward.
const HIND: ReadonlyArray<[number, number]> = [[1, 4], [0, 3], [0, 3], [1, 2]];
const FORE: ReadonlyArray<[number, number]> = [[2, 3], [2, 2]];
export function buildToadLeg(hind = false): VoxelGrid {
  const grid = createGrid(TOAD_LEG);
  for (const [y, [from, to]] of (hind ? HIND : FORE).entries()) {
    for (let z = from; z <= to; z++) for (let x = 0; x < 2; x++) setColor(grid, x, y, z, y === 0 ? (z === to ? C.belly : C.shade) : hind && y === 3 ? C.shade : C.skin);
  }
  return grid;
}

// A toad in one of its coats, said once (quadruped.ts): for its rig, its turning, its icon.
export const toadShape = (coat = 0): Quadruped => ({ voxel: TOAD_VOXEL_SIZE, palette: TOAD_PALETTES[coat] ?? TOAD_PALETTES[0], legHeight: TOAD_LEG_HEIGHT, legs: TOAD_LEGS, neck: TOAD_NECK, pivots: { body: TOAD_BODY_PIVOT, head: TOAD_HEAD_PIVOT, leg: TOAD_LEG_PIVOT }, body: buildToadBody, head: buildToadHead, leg: buildToadLeg });
