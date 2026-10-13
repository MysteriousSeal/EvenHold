// A bandit stronghold's war hound in voxels, at 0.02 (as the horse and the cow are: finer than the wolf's, for a
// broad head needs jowls and a collar its spikes). It faces +Z. A mastiff, read by its shape first and few colours:
// heavy before and lighter behind (a chest as broad as it's deep, its brisket hung between its forelegs, a loin
// tucked up, quarters a voxel narrower each side); short thick legs, the fore ones set wide; a neck as thick as its
// head, carried forward; a square block of a skull, a short broad muzzle in a black mask, jowls hung either side of
// it, its ears cropped to stubs; a short coat in three tones (fawn, a darker stripe along its spine and its
// poll, pale under its brisket and up its breast); and what says whose it is: a red leather collar set with
// iron spikes. A body (its tail with it), a head on its neck (so it can be thrown up and snapped down) and four
// legs, each its own part. Grid-aligned voxels only; what's round, stepped.
import type { VoxelGrid } from '../voxel/greedyMesh';
import type { Quadruped } from '../turned/quadruped';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const HOUND_VOXEL_SIZE = 0.02;

// The palette, said first: its coat, the saddle's darker shade, the pale of its underside; black (its mask, its
// ears, its nose and claws); the collar's red leather and its iron spikes; an amber eye; a tooth.
const ENTRIES = { coat: 0xc49658, saddle: 0x8a6238, pale: 0xe2c898, black: 0x241c18, collar: 0x9c2a22, spike: 0xd0d4da, eye: 0xf2b63c, tooth: 0xefe6d2 } as const;
export const HOUND_PALETTE: number[] = Object.values(ENTRIES);
export const HOUND_COLORS = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
const C = HOUND_COLORS;

export const HOUND_BODY: [number, number, number] = [10, 11, 21]; // (its tail hung behind it: the two rows at z 0 and 1)
export const HOUND_HEAD: [number, number, number] = [10, 11, 12];
export const HOUND_LEG: [number, number, number] = [3, 7, 4];
export const HOUND_LEG_HEIGHT = 7; // voxels its hips and shoulders are off the ground
// Where each part's own (0, 0, 0) is from where it hangs, in voxels: its body from the middle of it at its hips'
// height, its head from the base of its neck, a leg from its hip.
export const HOUND_BODY_PIVOT: [number, number, number] = [5, 2, 10];
export const HOUND_HEAD_PIVOT: [number, number, number] = [5, 2, 1];
export const HOUND_LEG_PIVOT: [number, number, number] = [1.5, 7, 2];
// Where its parts sit, in voxels from the middle of it on the ground: each leg's hip (across, along: the hind ones
// closer in, under its narrower quarters), the base of its neck.
export const HOUND_LEGS: ReadonlyArray<[x: number, z: number]> = [[-2.5, -6], [2.5, -6], [-3.5, 6], [3.5, 6]]; // hind left, hind right, fore left, fore right
export const HOUND_NECK: [number, number, number] = [0, HOUND_LEG_HEIGHT + 3, 8]; // (in its shoulders, under its withers)

// Its body, slice by slice from its rump (z 2) to its breast (z 20): each the rows it fills, bottom to top (row 2
// its hips' height). Quarters rounded off behind; a loin tucked up; ribs; a chest two rows deeper, its withers a
// row over its back; a breast cut back above and below.
const BARREL: ReadonlyArray<[bottom: number, top: number]> = [
  [3, 7], [2, 8], [2, 8], [2, 8], [2, 8], // rump, quarters
  [3, 8], [3, 8], [3, 8], [3, 8], // loin: tucked up
  [2, 8], [1, 8], [1, 9], // ribs
  [0, 9], [0, 10], [0, 10], [0, 9], [0, 9], // chest, brisket, withers
  [1, 8], [3, 7], // breast
];
const WAIST = 11; // behind this, a voxel narrower each side (its quarters, its loin)

// Its top and bottom rows a voxel in each side; its ends a voxel in too.
export function buildHoundBody(): VoxelGrid {
  const grid = createGrid(HOUND_BODY);
  const w = HOUND_BODY[0];
  for (const [i, [bottom, top]] of BARREL.entries()) {
    const z = i + 2;
    const end = i === 0 || i === BARREL.length - 1;
    const narrow = z < WAIST ? 1 : 0;
    for (let y = bottom; y <= top; y++) {
      // (Under its hips' height: only what's between its legs, so no leg's ever inside it.)
      const inset = Math.max(y < HOUND_BODY_PIVOT[1] ? 3 : 0, y === bottom || y === top ? 1 : 0) + (end ? 1 : 0) + narrow;
      for (let x = inset; x < w - inset; x++) {
        const saddle = y === top && x >= 3 && x <= 6; // along its spine
        const under = y <= bottom + 1 && z >= 12; // its brisket, and up its breast
        setColor(grid, x, y, z, i >= BARREL.length - 2 && y <= 6 ? C.pale : under ? C.pale : saddle ? C.saddle : C.coat);
      }
    }
  }
  // Its tail: thick at the root, hung down behind it, short.
  for (const x of [4, 5]) for (const y of [6, 7]) setColor(grid, x, y, 1, C.saddle);
  for (const x of [4, 5]) for (let y = 3; y <= 6; y++) setColor(grid, x, y, 0, y === 3 ? C.coat : C.saddle);
  return grid;
}

// Its head on its neck. The neck: thick, forward, the collar round it (red, a spike standing off it above and at
// either side, and a row back another pair: stepped, so they read as points). The skull: a block, its brow over
// its eyes; ears cropped to stubs; a short broad muzzle, black, the nose at its tip, jowls hung under it either
// side and a tooth showing below each.
export function buildHoundHead(): VoxelGrid {
  const grid = createGrid(HOUND_HEAD);
  // (Where its neck goes into its shoulders: none of it, so nothing of the two's ever in the same place.)
  const body = buildHoundBody();
  const inBody = (x: number, y: number, z: number) => colorAt(body, x + HOUND_NECK[0] - HOUND_HEAD_PIVOT[0] + HOUND_BODY_PIVOT[0], y + HOUND_NECK[1] - HOUND_LEG_HEIGHT - HOUND_HEAD_PIVOT[1] + HOUND_BODY_PIVOT[1], z + HOUND_NECK[2] - HOUND_HEAD_PIVOT[2] + HOUND_BODY_PIVOT[2]) !== 0;
  const put = (x: number, y: number, z: number, color: number) => !inBody(x, y, z) && setColor(grid, x, y, z, color);
  for (let z = 0; z <= 4; z++) {
    for (let y = 1; y <= 7; y++) for (let x = 2; x <= 7; x++) {
      if ((y === 1 || y === 7) && (x === 2 || x === 7)) continue; // (rounded)
      put(x, y, z, z === 3 || z === 4 ? C.collar : y === 7 ? C.saddle : y <= 2 ? C.pale : C.coat);
    }
  }
  // The collar's spikes: off its top and its sides.
  for (const [x, y] of [[1, 3], [1, 6], [8, 3], [8, 6], [3, 8], [6, 8]]) put(x, y, 3, C.spike);
  for (const [x, y] of [[1, 4], [8, 4], [4, 8], [5, 8]]) put(x, y, 4, C.spike);
  // The skull.
  for (let z = 5; z <= 9; z++) {
    for (let y = 2; y <= 8; y++) for (let x = 1; x <= 8; x++) {
      if ((y === 2 || y === 8) && (x === 1 || x === 8)) continue;
      if (z === 9 && y === 8) continue; // (its brow, stepped down to its face)
      setColor(grid, x, y, z, y === 8 && x >= 3 && x <= 6 && z <= 7 ? C.saddle : y <= 3 ? C.pale : C.coat);
    }
  }
  for (const x of [2, 7]) setColor(grid, x, 6, 9, C.eye);
  for (const x of [1, 2, 7, 8]) for (const z of [5, 6]) setColor(grid, x, 9, z, C.black); // its ears, cropped
  // Its muzzle, black; its nose; its jowls and teeth.
  for (let z = 10; z <= 11; z++) for (let y = 2; y <= 5; y++) for (let x = 2; x <= 7; x++) if (!(z === 11 && y === 5 && (x === 2 || x === 7))) setColor(grid, x, y, z, C.black);
  for (const x of [2, 7]) {
    for (const z of [9, 10, 11]) setColor(grid, x, 1, z, C.black);
    setColor(grid, x === 2 ? 3 : 6, 1, 11, C.tooth);
  }
  return grid;
}

// A leg, row by row up from its paw: how far along it reaches (from, to). Short and thick. A foreleg: straight, its
// paw forward. A hind leg: its hock a voxel behind, its thigh broad.
const FORE: ReadonlyArray<[number, number]> = [[1, 3], [1, 2], [1, 2], [1, 2], [0, 2], [0, 2], [0, 3]];
const HIND: ReadonlyArray<[number, number]> = [[1, 3], [0, 1], [0, 1], [0, 2], [0, 2], [0, 3], [0, 3]];
// Its coat, a shade darker at the pastern; a paw pale, its claws black.
export function buildHoundLeg(hind = false): VoxelGrid {
  const grid = createGrid(HOUND_LEG);
  for (const [y, [from, to]] of (hind ? HIND : FORE).entries()) {
    for (let z = from; z <= to; z++) for (let x = 0; x < 3; x++) setColor(grid, x, y, z, y === 0 ? (z === to ? C.black : C.pale) : y === 1 ? C.saddle : C.coat);
  }
  return grid;
}

// The hound, said once (turned/quadruped.ts): for its rig, and whatever else reads it part by part.
export const HOUND_SHAPE: Quadruped = { voxel: HOUND_VOXEL_SIZE, palette: HOUND_PALETTE, legHeight: HOUND_LEG_HEIGHT, legs: HOUND_LEGS, neck: HOUND_NECK, pivots: { body: HOUND_BODY_PIVOT, head: HOUND_HEAD_PIVOT, leg: HOUND_LEG_PIVOT }, body: buildHoundBody, head: buildHoundHead, leg: buildHoundLeg };
