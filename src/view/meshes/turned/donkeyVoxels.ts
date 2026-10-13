// A donkey in voxels, at 0.02 (as the horse and the cow are): whoever's been turned into one. It faces +Z. A horse's
// build, smaller and stockier, read by its shape first and few colours: a deep barrel on short straight legs, a
// level back, low withers, a sloped croup; a thick neck carried low and forward, a short mane stood upright along
// its crest; a big, heavy head, pale at the muzzle; very long ears, upright on its poll, dark at their tips; a pale
// belly; a dark stripe along its back and a cross of it over its withers; a thin tail hung from its dock to a dark
// tuft. In one of two coats (DONKEY_PALETTES): grey; brown. A body (its tail with it), a head on its neck (so it
// can be lowered to graze, or shaken) and four legs, each its own part. Grid-aligned voxels only; what's round, stepped.
import type { VoxelGrid } from '../voxel/greedyMesh';
import type { Quadruped } from './quadruped';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const DONKEY_VOXEL_SIZE = 0.02;

// The palette, said first: its coat and its shade; pale (its muzzle, its belly, inside its legs); dark (its mane,
// its stripe and cross, its tail's tuft, the tips of its ears); its hooves; a nostril; an eye.
const ROLES = ['coat', 'shade', 'pale', 'dark', 'hoof', 'nostril', 'eye'] as const;
type Role = (typeof ROLES)[number];
export const DONKEY_COLORS = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
const C = DONKEY_COLORS;
// Its coats, each the same roles in other colours: grey; brown.
export const DONKEY_PALETTES: number[][] = [
  [0x8c8884, 0x6e6a66, 0xdcd4c4, 0x2e2a28, 0x3a3028, 0x4a4240, 0x14100e],
  [0x7a5a40, 0x5e442e, 0xe0d2b8, 0x2a1e16, 0x30261e, 0x4a3a30, 0x14100e],
];
export const DONKEY_PALETTE = DONKEY_PALETTES[0];

export const DONKEY_BODY: [number, number, number] = [8, 13, 24]; // (its tail hung behind it: the two rows at z 0 and 1)
export const DONKEY_HEAD: [number, number, number] = [6, 15, 14];
export const DONKEY_LEG: [number, number, number] = [2, 10, 4];
export const DONKEY_LEG_HEIGHT = 10; // voxels its hips and shoulders are off the ground
// Where each part's own (0, 0, 0) is from where it hangs, in voxels: its body from the middle of it at its hips'
// height, its head from the base of its neck, a leg from its hip.
export const DONKEY_BODY_PIVOT: [number, number, number] = [4, 3, 13];
export const DONKEY_HEAD_PIVOT: [number, number, number] = [3, 0, 3];
export const DONKEY_LEG_PIVOT: [number, number, number] = [1, 10, 2];
// Where its parts sit, in voxels from the middle of it on the ground: each leg's hip (across, along), the base of its neck.
export const DONKEY_LEGS: ReadonlyArray<[x: number, z: number]> = [[-3, -7], [3, -7], [-3, 7], [3, 7]]; // hind left, hind right, fore left, fore right
export const DONKEY_NECK: [number, number, number] = [0, DONKEY_LEG_HEIGHT + 4, 8]; // (in its shoulders, before its withers)
export const DONKEY_EAR_ROWS = 5; // the rows of its head's grid that are its ears
const WITHERS: [number, number] = [19, 19]; // the slices its cross lies over

// Its body, slice by slice from its quarters (z 2) to its breast (z 23): each the rows it fills, bottom to top. A
// sloped croup; a belly near level, deep; a back a row under its withers; a breast cut back above and below.
const BARREL: ReadonlyArray<[bottom: number, top: number]> = [
  [5, 9], [4, 10], [2, 11], [2, 11], [2, 11], [2, 11], // quarters, croup
  [3, 11], [3, 11], // flank
  [2, 11], [2, 11], [2, 11], [2, 11], [2, 11], [2, 11], // barrel, its back
  [2, 11], [2, 11], [2, 12], [2, 12], // girth, withers
  [2, 11], [3, 11], [4, 10], [5, 9], // shoulder, breast
];

// Rounded across: its top and bottom rows two voxels in each side, the rows next to them one; its ends a voxel in too.
export function buildDonkeyBody(): VoxelGrid {
  const grid = createGrid(DONKEY_BODY);
  const w = DONKEY_BODY[0];
  for (const [i, [bottom, top]] of BARREL.entries()) {
    const z = i + 2;
    const end = i === 0 || i === BARREL.length - 1;
    const cross = z >= WITHERS[0] && z <= WITHERS[1];
    for (let y = bottom; y <= top; y++) {
      const fromEdge = Math.min(y - bottom, top - y);
      // (Under its hips' height: only what's between its legs, so no leg's ever inside it.)
      const inset = Math.max(y < DONKEY_BODY_PIVOT[1] ? 2 : 0, 2 - fromEdge) + (end ? 1 : 0);
      // (Its stripe: the middle of its top row, from its croup to its withers; its cross: down each shoulder from them. Pale under its belly, not up its croup or breast.)
      for (let x = inset; x < w - inset; x++) setColor(grid, x, y, z, (y === top && (x === 3 || x === 4) && z >= 4 && z <= WITHERS[1]) || (cross && y >= top - 3 && (y === top || x === inset || x === w - inset - 1)) ? C.dark : bottom > 3 ? (y <= bottom + 1 ? C.shade : C.coat) : y <= bottom + 1 ? C.pale : y === bottom + 2 ? C.shade : C.coat);
    }
  }
  // Its tail: thin, from its dock down behind it, to a tuft.
  for (const x of [3, 4]) setColor(grid, x, 9, 1, C.shade);
  for (let y = 4; y <= 8; y++) setColor(grid, 4, y, 0, C.shade);
  for (let y = 1; y <= 3; y++) for (const x of [3, 4]) setColor(grid, x, y, 0, C.dark);
  return grid;
}

// Its head on its neck. The neck, row by row up from its base: thick, sloped forward, its mane a row of dark stood
// up along the crest. The head, slice by slice from its poll forward: big and deep, broad at the cheek, narrowing
// to a pale muzzle, a nostril each side; an eye each side; its ears, long, upright from its poll, dark at the tip.
export function buildDonkeyHead(): VoxelGrid {
  const grid = createGrid(DONKEY_HEAD);
  // (Where its neck goes into its shoulders: none of it, so nothing of the two's ever in the same place.)
  const body = buildDonkeyBody();
  const inBody = (x: number, y: number, z: number) => colorAt(body, x + DONKEY_NECK[0] - DONKEY_HEAD_PIVOT[0] + DONKEY_BODY_PIVOT[0], y + DONKEY_NECK[1] - DONKEY_LEG_HEIGHT - DONKEY_HEAD_PIVOT[1] + DONKEY_BODY_PIVOT[1], z + DONKEY_NECK[2] - DONKEY_HEAD_PIVOT[2] + DONKEY_BODY_PIVOT[2]) !== 0;
  for (let y = 0; y <= 6; y++) {
    const crest = 1 + Math.floor(y * 0.6);
    const deep = y < 2 ? 6 : y < 5 ? 5 : 4;
    for (let z = crest; z < crest + deep; z++) for (let x = 1; x <= 4; x++) if (!inBody(x, y, z)) setColor(grid, x, y, z, z === crest + deep - 1 ? C.shade : C.coat);
    for (const x of [2, 3]) if (y >= 1 && !inBody(x, y, crest - 1)) setColor(grid, x, y, crest - 1, C.dark); // its mane
  }
  const SKULL: ReadonlyArray<[z: number, bottom: number, top: number, narrow: boolean]> = [[5, 5, 9, false], [6, 4, 9, false], [7, 4, 9, false], [8, 4, 9, false], [9, 3, 8, false], [10, 3, 8, true], [11, 2, 7, true], [12, 2, 6, true]];
  for (const [z, bottom, top, narrow] of SKULL) {
    for (let y = bottom; y <= top; y++) {
      for (let x = narrow ? 1 : 0; x <= (narrow ? 4 : 5); x++) {
        if (!narrow && (x === 0 || x === 5) && (y === bottom || y === top)) continue; // (its cheeks, rounded)
        setColor(grid, x, y, z, z >= 11 || (z === 10 && y <= 5) ? C.pale : y === bottom ? C.shade : C.coat);
      }
    }
  }
  for (const x of [1, 4]) setColor(grid, x, 4, 12, C.nostril);
  for (const x of [0, 5]) setColor(grid, x, 7, 8, C.eye);
  for (const x of [2, 3]) setColor(grid, x, 7, 4, C.dark); // the mane, up to its poll
  // Its ears: broad, two voxels across and two along at the root, one along above, a point at the tip; five rows of them.
  const tall = DONKEY_HEAD[1] - DONKEY_EAR_ROWS;
  for (const [x, out] of [[1, 0], [4, 5]]) {
    for (let y = tall; y < DONKEY_HEAD[1]; y++) for (const z of y < tall + 2 ? [5, 6] : [5]) for (const across of y === DONKEY_HEAD[1] - 1 ? [out] : [x, out]) setColor(grid, across, y, z, y >= DONKEY_HEAD[1] - 2 ? C.dark : z === 6 || (y >= tall + 2 && across === x) ? C.pale : C.coat);
  }
  return grid;
}

// A leg, row by row up from its hoof: how far along it reaches (from, to). Short and straight. A foreleg: its knee
// a voxel forward. A hind leg: its hock a voxel behind.
const FORE: ReadonlyArray<[number, number]> = [[1, 3], [1, 2], [1, 2], [1, 2], [1, 3], [1, 2], [1, 3], [0, 3], [0, 3], [0, 3]];
const HIND: ReadonlyArray<[number, number]> = [[1, 3], [1, 2], [1, 2], [0, 2], [1, 2], [1, 2], [0, 2], [0, 3], [0, 3], [0, 3]];
// Its coat's colour, shaded at the knee, pale above the hoof; a dark hoof.
export function buildDonkeyLeg(hind = false): VoxelGrid {
  const grid = createGrid(DONKEY_LEG);
  for (const [y, [from, to]] of (hind ? HIND : FORE).entries()) {
    for (let z = from; z <= to; z++) for (let x = 0; x < 2; x++) setColor(grid, x, y, z, y === 0 ? C.hoof : y === 1 ? C.pale : y === 4 ? C.shade : C.coat);
  }
  return grid;
}

// A donkey in one of its coats, said once (quadruped.ts): for the rig, the turning, the icon.
export const donkeyShape = (coat = 0): Quadruped => ({ voxel: DONKEY_VOXEL_SIZE, palette: DONKEY_PALETTES[coat] ?? DONKEY_PALETTES[0], legHeight: DONKEY_LEG_HEIGHT, legs: DONKEY_LEGS, neck: DONKEY_NECK, pivots: { body: DONKEY_BODY_PIVOT, head: DONKEY_HEAD_PIVOT, leg: DONKEY_LEG_PIVOT }, body: buildDonkeyBody, head: buildDonkeyHead, leg: buildDonkeyLeg });
