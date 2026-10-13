// A goat in voxels, at 0.02 (as the horse and the cow are): whoever's been turned into one. It faces +Z. Read by its
// shape first and few colours: lean and narrow, its back straight from rump to withers, its flank tucked up, its
// chest deep between its forelegs; slender legs, a knee and a hock to each; a neck up and forward; a wedge of a
// head, narrow at the muzzle; horns up from its poll and swept back over its neck; an ear out each side; a beard
// hung under its chin; a short tail held upright. In one of three coats (GOAT_PALETTES): white; brown; piebald
// (white, dark over its quarters, a shoulder and its neck). A body (its tail with it), a head on its neck (so it
// can be lowered to graze, or tossed) and four legs, each its own part. Grid-aligned voxels only; what's round, stepped.
import type { VoxelGrid } from '../voxel/greedyMesh';
import type { Quadruped } from './quadruped';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const GOAT_VOXEL_SIZE = 0.02;

// The palette, said first: its coat and the shade of its underside; its patches and their shade; horn; its beard;
// its hooves; an eye.
const ROLES = ['coat', 'shade', 'patch', 'patchDark', 'horn', 'beard', 'hoof', 'eye'] as const;
type Role = (typeof ROLES)[number];
export const GOAT_COLORS = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
const C = GOAT_COLORS;
// Its coats, each the same roles in other colours: white; brown; piebald (the only one patched).
export const GOAT_PALETTES: number[][] = [
  [0xeee8dc, 0xcbc2b0, 0x5a4230, 0x3e2c20, 0x6e6252, 0xdcd4c2, 0x3a3028, 0x14100e],
  [0x9a6c40, 0x77502e, 0x5a4230, 0x3e2c20, 0x54483c, 0x4e3420, 0x2a2018, 0x14100e],
  [0xeee8dc, 0xcbc2b0, 0x4a3628, 0x33241a, 0x6e6252, 0xdcd4c2, 0x3a3028, 0x14100e],
];
export const GOAT_PIEBALD = 2; // the coat with patches
export const GOAT_PALETTE = GOAT_PALETTES[0];

export const GOAT_BODY: [number, number, number] = [6, 9, 19]; // (its tail behind it, held up: the row at z 0)
export const GOAT_HEAD: [number, number, number] = [6, 10, 11];
export const GOAT_LEG: [number, number, number] = [2, 9, 3];
export const GOAT_LEG_HEIGHT = 9; // voxels its hips and shoulders are off the ground
// Where each part's own (0, 0, 0) is from where it hangs, in voxels: its body from the middle of it at its hips'
// height, its head from the base of its neck, a leg from its hip.
export const GOAT_BODY_PIVOT: [number, number, number] = [3, 1, 10];
export const GOAT_HEAD_PIVOT: [number, number, number] = [3, 0, 2];
export const GOAT_LEG_PIVOT: [number, number, number] = [1, 9, 1];
// Where its parts sit, in voxels from the middle of it on the ground: each leg's hip (across, along), the base of its neck.
export const GOAT_LEGS: ReadonlyArray<[x: number, z: number]> = [[-2, -6], [2, -6], [-2, 6], [2, 6]]; // hind left, hind right, fore left, fore right
export const GOAT_NECK: [number, number, number] = [0, GOAT_LEG_HEIGHT + 3, 8]; // (in its breast)

// Its body, slice by slice from its rump (z 1) to its breast (z 18): each the rows it fills, bottom to top. A
// straight back; its flank tucked up; its chest a row under its shoulders, between its forelegs.
const BARREL: ReadonlyArray<[bottom: number, top: number]> = [
  [3, 6], [2, 7], [1, 7], [1, 7], [1, 7], // rump, hips
  [2, 7], [2, 7], [2, 7], // flank
  [1, 7], [1, 7], [1, 7], [1, 7], // its back, its belly
  [0, 7], [0, 7], [0, 7], [0, 7], // chest
  [1, 7], [2, 6], // breast
];
// Its patches (a piebald one's): over its quarters; a shoulder.
const patched = (x: number, y: number, z: number): boolean => (z <= 6 && y >= 3 && !(z >= 5 && y <= 4)) || (x >= 2 && z >= 12 && z <= 15 && y >= 4 && !(x === 2 && (z === 12 || z === 15)));

// Narrow: only its top and bottom rows a voxel in each side; its ends a voxel in too.
export function buildGoatBody(piebald = false): VoxelGrid {
  const grid = createGrid(GOAT_BODY);
  const w = GOAT_BODY[0];
  for (const [i, [bottom, top]] of BARREL.entries()) {
    const z = i + 1;
    const end = i === 0 || i === BARREL.length - 1;
    for (let y = bottom; y <= top; y++) {
      // (Under its hips' height: only what's between its legs, so no leg's ever inside it.)
      const inset = Math.max(y < GOAT_BODY_PIVOT[1] ? 2 : 0, y === bottom || y === top ? 1 : 0) + (end ? 1 : 0);
      const low = y <= bottom + 1;
      for (let x = inset; x < w - inset; x++) setColor(grid, x, y, z, piebald && patched(x, y, z) ? (low ? C.patchDark : C.patch) : low ? C.shade : C.coat);
    }
  }
  // Its tail: short, up from its rump.
  for (let y = 6; y <= 8; y++) for (const x of [2, 3]) setColor(grid, x, y, 0, piebald ? C.patchDark : C.shade);
  return grid;
}

// Its head on its neck. The neck, row by row up from its base: sloped forward, thinner as it rises. The head, slice
// by slice from its poll forward: a wedge, narrow at its muzzle; an eye each side; an ear out each side; horns up
// from its poll, then back and down over its neck; a beard under its chin.
export function buildGoatHead(piebald = false): VoxelGrid {
  const grid = createGrid(GOAT_HEAD);
  // (Where its neck goes into its breast: none of it, so nothing of the two's ever in the same place.)
  const body = buildGoatBody(piebald);
  const inBody = (x: number, y: number, z: number) => colorAt(body, x + GOAT_NECK[0] - GOAT_HEAD_PIVOT[0] + GOAT_BODY_PIVOT[0], y + GOAT_NECK[1] - GOAT_LEG_HEIGHT - GOAT_HEAD_PIVOT[1] + GOAT_BODY_PIVOT[1], z + GOAT_NECK[2] - GOAT_HEAD_PIVOT[2] + GOAT_BODY_PIVOT[2]) !== 0;
  for (let y = 0; y <= 4; y++) {
    const crest = 1 + Math.floor(y * 0.6);
    const deep = y < 2 ? 4 : 3;
    for (let z = crest; z < crest + deep; z++) for (let x = 1; x <= 4; x++) if (!inBody(x, y, z)) setColor(grid, x, y, z, piebald ? (z === crest + deep - 1 ? C.patchDark : C.patch) : z === crest + deep - 1 ? C.shade : C.coat);
  }
  const SKULL: ReadonlyArray<[z: number, bottom: number, top: number, narrow: boolean]> = [[4, 4, 6, false], [5, 3, 6, false], [6, 3, 6, false], [7, 3, 6, false], [8, 3, 5, false], [9, 3, 5, true], [10, 3, 4, true]];
  for (const [z, bottom, top, narrow] of SKULL) {
    for (let y = bottom; y <= top; y++) for (let x = narrow ? 2 : 1; x <= (narrow ? 3 : 4); x++) setColor(grid, x, y, z, y === bottom && z >= 8 ? C.shade : C.coat); // (its lip and chin, in shade)
  }
  for (const x of [1, 4]) {
    setColor(grid, x, 5, 7, C.eye);
    for (const [y, z] of [[7, 5], [8, 4], [9, 3], [9, 2], [8, 1], [7, 0]]) setColor(grid, x, y, z, C.horn); // a horn: up, back, down
  }
  for (const x of [0, 5]) for (const z of [4, 5]) setColor(grid, x, 5, z, C.shade); // ears
  // Its beard: under its chin, to a point.
  for (const [y, z] of [[2, 8], [2, 9], [1, 8], [0, 8]]) for (const x of [2, 3]) setColor(grid, x, y, z, C.beard);
  return grid;
}

// A leg, row by row up from its hoof: how far along it reaches (from, to). Slender. A foreleg: straight, its knee a
// voxel forward. A hind leg: its hock a voxel behind.
const FORE: ReadonlyArray<[number, number]> = [[1, 2], [1, 1], [1, 1], [1, 1], [1, 2], [1, 1], [1, 2], [0, 2], [0, 2]];
const HIND: ReadonlyArray<[number, number]> = [[1, 2], [1, 1], [1, 1], [0, 1], [1, 1], [1, 2], [0, 2], [0, 2], [0, 2]];
// Its coat's colour, shaded at the knee; a dark hoof.
export function buildGoatLeg(hind = false): VoxelGrid {
  const grid = createGrid(GOAT_LEG);
  for (const [y, [from, to]] of (hind ? HIND : FORE).entries()) {
    for (let z = from; z <= to; z++) for (let x = 0; x < 2; x++) setColor(grid, x, y, z, y === 0 ? C.hoof : y === 4 || y === 1 ? C.shade : C.coat);
  }
  return grid;
}

// A goat in one of its coats, said once (quadruped.ts): for the rig, the turning, the icon.
export const goatShape = (coat = 0): Quadruped => ({ voxel: GOAT_VOXEL_SIZE, palette: GOAT_PALETTES[coat] ?? GOAT_PALETTES[0], legHeight: GOAT_LEG_HEIGHT, legs: GOAT_LEGS, neck: GOAT_NECK, pivots: { body: GOAT_BODY_PIVOT, head: GOAT_HEAD_PIVOT, leg: GOAT_LEG_PIVOT }, body: () => buildGoatBody(coat === GOAT_PIEBALD), head: () => buildGoatHead(coat === GOAT_PIEBALD), leg: buildGoatLeg });
