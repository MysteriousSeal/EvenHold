// A pig in voxels, at 0.02 (as the horse and the cow are): whoever's been turned into one. It faces +Z. Read by its
// shape first and few colours: a long low barrel of a body, its back a little arched, its belly hung between its
// legs near the ground; four short legs on trotters; no neck to speak of: a wedge of a head carried low, straight
// out of its shoulders, narrowing to a snout that ends in a flat disc with two nostrils; an ear each side flopped
// forward over its eye; a tail in one curl behind. In one of three coats (PIG_PALETTES): pink; pale with dark
// spots; black. A body (its tail with it), a head (so it can be lowered to root) and four legs, each its own part.
// Grid-aligned voxels only; what's round, stepped.
import type { VoxelGrid } from '../voxel/greedyMesh';
import type { Quadruped } from './quadruped';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const PIG_VOXEL_SIZE = 0.02;

// The palette, said first: its skin and the shade of its underside; its ears and tail, a little deeper; its spots;
// the disc of its snout, and its nostrils; its trotters; an eye.
const ROLES = ['skin', 'shade', 'ear', 'spot', 'snout', 'nostril', 'hoof', 'eye'] as const;
type Role = (typeof ROLES)[number];
export const PIG_COLORS = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
const C = PIG_COLORS;
// Its coats, each the same roles in other colours: pink; paler, with dark spots (the only one spotted); black.
export const PIG_PALETTES: number[][] = [
  [0xeeb0a6, 0xd2928a, 0xcc847e, 0x4e3e40, 0xe08a86, 0x7a4648, 0x5a4640, 0x14100e],
  [0xf2cabe, 0xd9aa9e, 0xd69a90, 0x4a3c3c, 0xe59a94, 0x7a4648, 0x5a4640, 0x14100e],
  [0x403a3c, 0x2c2729, 0x242021, 0x1c1819, 0x80605e, 0x2e1e20, 0x1a1516, 0x0a0808],
];
export const PIG_SPOTTED = 1; // the coat with spots
export const PIG_PALETTE = PIG_PALETTES[0];

export const PIG_BODY: [number, number, number] = [8, 10, 23]; // (its tail curled behind it: the three rows at z 0 to 2)
export const PIG_HEAD: [number, number, number] = [8, 8, 10];
export const PIG_LEG: [number, number, number] = [2, 4, 3];
export const PIG_LEG_HEIGHT = 4; // voxels its hips and shoulders are off the ground
// Where each part's own (0, 0, 0) is from where it hangs, in voxels: its body from the middle of it at its hips'
// height, its head from where it leaves its shoulders, a leg from its hip.
export const PIG_BODY_PIVOT: [number, number, number] = [4, 1, 13];
export const PIG_HEAD_PIVOT: [number, number, number] = [4, 0, 1];
export const PIG_LEG_PIVOT: [number, number, number] = [1, 4, 1];
// Where its parts sit, in voxels from the middle of it on the ground: each leg's hip (across, along), the base of its neck.
export const PIG_LEGS: ReadonlyArray<[x: number, z: number]> = [[-3, -6], [3, -6], [-3, 6], [3, 6]]; // hind left, hind right, fore left, fore right
export const PIG_NECK: [number, number, number] = [0, PIG_LEG_HEIGHT + 1, 9]; // (low in its shoulders)
export const PIG_SNOUT_ROWS = 4; // the rows at the front of its head's grid that are its snout

// Its body, slice by slice from its hams (z 3) to its shoulders (z 22): each the rows it fills, bottom to top. Round
// hams; a back arched a little, highest over its middle; a belly down to the bottom row; shoulders cut back.
const BARREL: ReadonlyArray<[bottom: number, top: number]> = [
  [3, 7], [2, 8], [1, 8], // hams
  [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], // its back, its belly
  [0, 8], [0, 8], [0, 8], // shoulders
  [1, 8], [2, 7], // where its head leaves them
];
const BELLY: [number, number] = [10, 16]; // the slices between its legs, where its belly hangs its whole width
// Its spots (a spotted one's): a blob on its off ham, one over its back, one on its near shoulder, one low on its
// off side; each: its middle, how far it reaches each way.
const SPOTS: ReadonlyArray<[x: number, y: number, z: number, rx: number, ry: number, rz: number]> = [[7.5, 6, 6.5, 3, 2.4, 2.6], [2.5, 9.5, 13.5, 2.6, 3, 2.6], [0, 5, 18.5, 2.5, 2.3, 2.2], [8, 3.5, 13, 2.5, 2, 2.4]];
const spotted = (x: number, y: number, z: number): boolean => SPOTS.some(([sx, sy, sz, rx, ry, rz]) => ((x + 0.5 - sx) / rx) ** 2 + ((y + 0.5 - sy) / ry) ** 2 + ((z + 0.5 - sz) / rz) ** 2 <= 1);

// Rounded across: its top row two voxels in each side, the row under it one; its ends a voxel in too.
export function buildPigBody(spots = false): VoxelGrid {
  const grid = createGrid(PIG_BODY);
  const w = PIG_BODY[0];
  for (const [i, [bottom, top]] of BARREL.entries()) {
    const z = i + 3;
    const end = i === 0 || i === BARREL.length - 1;
    for (let y = bottom; y <= top; y++) {
      // (Under its hips' height: only what's between its legs, so no leg's ever inside it; all its width where no leg is.)
      const under = y < PIG_BODY_PIVOT[1] ? (z >= BELLY[0] && z <= BELLY[1] ? 1 : 2) : y === bottom ? 1 : 0;
      const inset = Math.max(under, 2 - (top - y)) + (end ? 1 : 0);
      for (let x = inset; x < w - inset; x++) setColor(grid, x, y, z, spots && spotted(x, y, z) ? C.spot : y <= bottom + 1 ? C.shade : C.skin);
    }
  }
  // Its tail: one curl, behind its hams.
  for (const [y, z] of [[7, 2], [7, 1], [7, 0], [6, 0], [5, 0], [5, 1], [5, 2]]) setColor(grid, 4, y, z, C.ear);
  return grid;
}

// Its head. Thick where it leaves its shoulders, its brow sloping down forward; a snout, narrower, ending flat in a
// disc, a nostril at each side of it; an eye each side; an ear each side, out from its poll and flopped forward.
export function buildPigHead(): VoxelGrid {
  const grid = createGrid(PIG_HEAD);
  // (Where it goes into its shoulders: none of it, so nothing of the two's ever in the same place.)
  const body = buildPigBody();
  const inBody = (x: number, y: number, z: number) => colorAt(body, x + PIG_NECK[0] - PIG_HEAD_PIVOT[0] + PIG_BODY_PIVOT[0], y + PIG_NECK[1] - PIG_LEG_HEIGHT - PIG_HEAD_PIVOT[1] + PIG_BODY_PIVOT[1], z + PIG_NECK[2] - PIG_HEAD_PIVOT[2] + PIG_BODY_PIVOT[2]) !== 0;
  const front = PIG_HEAD[2] - PIG_SNOUT_ROWS; // (where its snout begins)
  for (let z = 0; z < front; z++) {
    const top = z <= 3 ? 7 : 6;
    for (let y = 0; y <= top; y++) {
      for (let x = 1; x <= 6; x++) {
        if ((y === 0 || y === top) && (x === 1 || x === 6)) continue; // (rounded)
        if (!inBody(x, y, z)) setColor(grid, x, y, z, y <= 1 ? C.shade : C.skin);
      }
    }
  }
  // Its snout: a wedge, then the disc.
  for (let z = front; z < PIG_HEAD[2]; z++) {
    const disc = z === PIG_HEAD[2] - 1;
    for (let y = 0; y <= (z === front ? 4 : 3); y++) for (let x = 2; x <= 5; x++) setColor(grid, x, y, z, disc ? C.snout : y === 0 ? C.shade : C.skin);
  }
  for (const x of [2, 5]) setColor(grid, x, 2, PIG_HEAD[2] - 1, C.nostril);
  for (const x of [1, 6]) setColor(grid, x, 4, 4, C.eye);
  for (const x of [0, 7]) for (const [y, z] of [[7, 1], [6, 1], [7, 2], [6, 2], [5, 2], [6, 3], [5, 3], [5, 4]]) setColor(grid, x, y, z, C.ear);
  return grid;
}

// A leg, row by row up from its trotter: how far along it reaches (from, to). Short; a hind leg's hock a voxel behind.
const FORE: ReadonlyArray<[number, number]> = [[0, 2], [0, 1], [0, 2], [0, 2]];
const HIND: ReadonlyArray<[number, number]> = [[0, 2], [1, 2], [0, 2], [0, 2]];
// Its skin's colour, shaded above the trotter; a dark trotter.
export function buildPigLeg(hind = false): VoxelGrid {
  const grid = createGrid(PIG_LEG);
  for (const [y, [from, to]] of (hind ? HIND : FORE).entries()) {
    for (let z = from; z <= to; z++) for (let x = 0; x < 2; x++) setColor(grid, x, y, z, y === 0 ? C.hoof : y === 1 ? C.shade : C.skin);
  }
  return grid;
}

// A pig in one of its coats, said once (quadruped.ts): for the rig, the turning, the icon.
export const pigShape = (coat = 0): Quadruped => ({ voxel: PIG_VOXEL_SIZE, palette: PIG_PALETTES[coat] ?? PIG_PALETTES[0], legHeight: PIG_LEG_HEIGHT, legs: PIG_LEGS, neck: PIG_NECK, pivots: { body: PIG_BODY_PIVOT, head: PIG_HEAD_PIVOT, leg: PIG_LEG_PIVOT }, body: () => buildPigBody(coat === PIG_SPOTTED), head: buildPigHead, leg: buildPigLeg });
