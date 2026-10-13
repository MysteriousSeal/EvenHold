// A horse in voxels, at 0.02 (as the hen is: finer than the world's 0.04, for it's seen close, among people, and a
// leg needs a knee): whoever's been turned into one (model/spells/turned.ts). It faces +Z. A bay, read by its
// shape first and few colours: a deep chest and a belly tucked up behind it, withers, a level back, a rounded croup;
// legs with a side to them (a forearm or a gaskin above, a knee or an angled hock, a narrow cannon, a fetlock, a
// hoof), black from the knee down; a neck sloped up and forward, thick at its base and tapering to the throat, a
// black mane along its crest; a wedge of a head, deep at the jaw and narrowing to the muzzle, a white blaze down its
// face, ears on its poll, a forelock; a black tail hung from its dock to its hocks. A body (its tail with it), a
// head on its neck (so it can be lowered to graze, or tossed) and four legs, each its own part. Grid-aligned voxels
// only; the rounder shapes come from stepped rows and cut corners.
import type { VoxelGrid } from '../voxel/greedyMesh';
import type { Quadruped } from './quadruped';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const HORSE_VOXEL_SIZE = 0.02;

// The palette, said first: its coat, the shade of its underside, the light along its back; black (mane, tail,
// stockings); its hooves; white (the blaze); an eye.
const ROLES = ['coat', 'shade', 'light', 'black', 'hoof', 'white', 'eye'] as const;
type Role = (typeof ROLES)[number];
const C = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
export const HORSE_PALETTE: number[] = [0x8a5a34, 0x6a4226, 0xa06c40, 0x241c18, 0x3a3028, 0xf0e8d8, 0x14100e];

export const HORSE_BODY: [number, number, number] = [9, 13, 28]; // (its tail hung behind it: the two rows at z 0 and 1)
export const HORSE_HEAD: [number, number, number] = [5, 15, 15];
export const HORSE_LEG: [number, number, number] = [2, 13, 5];
export const HORSE_LEG_HEIGHT = 13; // voxels its hips and shoulders are off the ground
// Where each part's own (0, 0, 0) is from where it hangs, in voxels: its body from the middle of it at its hips'
// height, its head from the base of its neck, a leg from its hip.
export const HORSE_BODY_PIVOT: [number, number, number] = [4.5, 4, 14];
export const HORSE_HEAD_PIVOT: [number, number, number] = [2.5, 0, 3];
export const HORSE_LEG_PIVOT: [number, number, number] = [1, 13, 2.5];
// Where its parts sit, in voxels from the middle of it on the ground: each leg's hip (across, along), the base of its neck.
export const HORSE_LEGS: ReadonlyArray<[x: number, z: number]> = [[-3.5, -8], [3.5, -8], [-3.5, 8], [3.5, 8]]; // hind left, hind right, fore left, fore right
export const HORSE_NECK: [number, number, number] = [0, HORSE_LEG_HEIGHT + 6, 7]; // (in its shoulders, before its withers)
export const HORSE_EAR_ROWS = 2; // the rows of its head's grid that are its ears (and its forelock between them)

// Its body, slice by slice from its quarters (z 2) to its breast (z 25): each the rows it fills, bottom to top. A
// rounded croup; a belly tucked up before its stifle; a back a row lower than croup and withers; a chest deep
// between its forelegs (as deep as its legs are long below it, near enough); a breast cut back above and below.
const BARREL: ReadonlyArray<[bottom: number, top: number]> = [
  [5, 10], [4, 11], [3, 11], [3, 11], [3, 11], [3, 11], [3, 11], // quarters, croup
  [4, 11], [4, 10], [4, 10], [4, 10], // flank: tucked up
  [2, 10], [2, 10], [2, 10], [2, 10], // barrel, its back
  [1, 11], [1, 11], [1, 12], [1, 12], [1, 11], // girth, withers
  [1, 11], [2, 10], [3, 10], [4, 9], // shoulder, breast
];

// Rounded across: its top and bottom rows two voxels in each side, the rows next to them one; its ends a voxel in too.
export function buildHorseBody(): VoxelGrid {
  const grid = createGrid(HORSE_BODY);
  const w = HORSE_BODY[0];
  for (const [i, [bottom, top]] of BARREL.entries()) {
    const z = i + 2;
    const end = i === 0 || i === BARREL.length - 1;
    for (let y = bottom; y <= top; y++) {
      const fromEdge = Math.min(y - bottom, top - y);
      // (Under its hips' height: only what's between its legs, so no leg's ever inside it.)
      const inset = Math.max(y < HORSE_BODY_PIVOT[1] ? 2 : 0, 2 - fromEdge) + (end ? 1 : 0);
      for (let x = inset; x < w - inset; x++) setColor(grid, x, y, z, y === top ? C.light : y <= bottom + 1 ? C.shade : C.coat);
    }
  }
  // Its tail: from its dock, at the top of its quarters, hung down behind to its hocks; fuller in its middle.
  for (const x of [3, 4, 5]) setColor(grid, x, 10, 1, C.black);
  for (let y = 1; y <= 9; y++) for (const x of y >= 3 && y <= 7 ? [3, 4, 5] : [4]) setColor(grid, x, y, 0, C.black);
  for (let y = 6; y <= 9; y++) setColor(grid, 4, y, 1, C.black);
  return grid;
}

// Its head on its neck. The neck, row by row up from its base: sloped forward (its crest going forward a voxel
// every two rows), thick below and tapering to the throat; its mane along the crest, black. The head, slice by slice
// from its poll forward: deep at the jaw, its face sloping down to a narrow muzzle; an eye each side; a white blaze
// down its face to its nose; ears on its poll, a forelock between them.
export function buildHorseHead(): VoxelGrid {
  const grid = createGrid(HORSE_HEAD);
  // (Where its neck goes into its shoulders: none of it, so nothing of the two's ever in the same place.)
  const body = buildHorseBody();
  const inBody = (x: number, y: number, z: number) => colorAt(body, x + HORSE_NECK[0] - HORSE_HEAD_PIVOT[0] + HORSE_BODY_PIVOT[0], y + HORSE_NECK[1] - HORSE_LEG_HEIGHT - HORSE_HEAD_PIVOT[1] + HORSE_BODY_PIVOT[1], z + HORSE_NECK[2] - HORSE_HEAD_PIVOT[2] + HORSE_BODY_PIVOT[2]) !== 0;
  for (let y = 0; y <= 9; y++) {
    const crest = 1 + Math.floor(y * 0.6);
    const deep = y < 3 ? 6 : y < 6 ? 5 : 4;
    const [x0, x1] = y < 2 ? [0, 4] : [1, 3]; // (wider where it joins its shoulders)
    for (let z = crest; z < crest + deep; z++) for (let x = x0; x <= x1; x++) if (!inBody(x, y, z)) setColor(grid, x, y, z, z === crest + deep - 1 && y < 8 ? C.shade : C.coat);
    if (y >= 1 && !inBody(2, y, crest - 1)) setColor(grid, 2, y, crest - 1, C.black); // its mane
  }
  const SKULL: ReadonlyArray<[z: number, bottom: number, top: number, narrow: boolean]> = [[6, 9, 12, false], [7, 8, 12, false], [8, 8, 12, false], [9, 8, 12, false], [10, 7, 11, false], [11, 6, 10, true], [12, 5, 9, true], [13, 5, 8, true]];
  for (const [z, bottom, top, narrow] of SKULL) {
    for (let y = bottom; y <= top; y++) {
      for (let x = narrow ? 1 : 0; x <= (narrow ? 3 : 4); x++) {
        const blaze = x === 2 && z >= 9 && (y === top || z === 13);
        setColor(grid, x, y, z, blaze ? C.white : y === bottom && z >= 11 ? C.shade : C.coat); // (its lip and chin, in shade)
      }
    }
  }
  for (const x of [0, 4]) setColor(grid, x, 11, 9, C.eye);
  setColor(grid, 2, 12, 5, C.black); // the mane, up to its poll
  for (const x of [1, 3]) for (const y of [13, 14]) setColor(grid, x, y, 7, C.coat); // ears
  for (const z of [7, 8]) setColor(grid, 2, 13, z, C.black); // the forelock between them
  return grid;
}

// A leg, row by row up from its hoof: how far along it reaches (from, to). A foreleg: straight, its knee a voxel
// forward. A hind leg: its gaskin sloping back down to the point of its hock, its cannon upright under that.
const FORE: ReadonlyArray<[number, number]> = [[2, 4], [2, 4], [2, 3], [1, 3], [2, 3], [2, 3], [2, 3], [1, 3], [1, 3], [1, 4], [1, 4], [1, 4], [1, 4]];
const HIND: ReadonlyArray<[number, number]> = [[1, 3], [1, 3], [1, 2], [0, 2], [1, 2], [1, 2], [1, 2], [0, 2], [0, 2], [0, 3], [0, 3], [1, 4], [1, 4]];
// Its coat's colour above the knee, black below it, a dark hoof.
export function buildHorseLeg(hind = false): VoxelGrid {
  const grid = createGrid(HORSE_LEG);
  for (const [y, [from, to]] of (hind ? HIND : FORE).entries()) {
    for (let z = from; z <= to; z++) for (let x = 0; x < 2; x++) setColor(grid, x, y, z, y === 0 ? C.hoof : y <= 6 ? C.black : y === 7 ? C.shade : C.coat);
  }
  return grid;
}

// The horse, said once (quadruped.ts): for its rig, its turning, its icon.
export const HORSE_SHAPE: Quadruped = { voxel: HORSE_VOXEL_SIZE, palette: HORSE_PALETTE, legHeight: HORSE_LEG_HEIGHT, legs: HORSE_LEGS, neck: HORSE_NECK, pivots: { body: HORSE_BODY_PIVOT, head: HORSE_HEAD_PIVOT, leg: HORSE_LEG_PIVOT }, body: buildHorseBody, head: buildHorseHead, leg: buildHorseLeg };
