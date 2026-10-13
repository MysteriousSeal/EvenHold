// A sheep in voxels, at 0.02 (as the horse and the cow are): whoever's been turned into one. It faces +Z. Read by
// its shape first and few colours: a round body of wool, far wider and deeper than the thin legs under it, rounded
// at every edge; a small bare face on a woolly neck, a tuft of wool on its poll, a short ear out each side; a dock
// of a tail. Under its fleece, itself (its skin, shorn: the voxels inside the wool), so that it can be seen bare
// before its wool grows (view/cinema/stagings/sheepStaging.ts). In one of two coats (SHEEP_PALETTES): white wool
// and a pale face; white wool, its face and legs black. A body (its tail with it), a head on its neck (so it can be
// lowered to graze) and four legs, each its own part. Grid-aligned voxels only; what's round, stepped.
import type { VoxelGrid } from '../voxel/greedyMesh';
import type { Quadruped } from './quadruped';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const SHEEP_VOXEL_SIZE = 0.02;

// The palette, said first: its wool, the shade under it, the light along its back; its skin under the wool; its
// face and legs; its ears; its hooves; an eye.
const ROLES = ['wool', 'shade', 'light', 'skin', 'face', 'ear', 'hoof', 'eye'] as const;
type Role = (typeof ROLES)[number];
export const SHEEP_COLORS = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
const C = SHEEP_COLORS;
// Its coats, each the same roles in other colours: a pale face and legs; a black face and legs (its eye, amber).
const FLEECE = [0xece6d8, 0xc9c0ad, 0xf8f4ea, 0xe4c2b2];
export const SHEEP_PALETTES: number[][] = [
  [...FLEECE, 0xd6bf9f, 0xc9a68e, 0x4a3c32, 0x14100e],
  [...FLEECE, 0x2e2a28, 0x221e1c, 0x161210, 0xd0aa52],
];
export const SHEEP_PALETTE = SHEEP_PALETTES[0];

export const SHEEP_BODY: [number, number, number] = [12, 10, 20]; // (its tail behind it: the row at z 0)
export const SHEEP_HEAD: [number, number, number] = [8, 8, 9];
export const SHEEP_LEG: [number, number, number] = [2, 6, 2];
export const SHEEP_LEG_HEIGHT = 6; // voxels its hips and shoulders are off the ground
// Where each part's own (0, 0, 0) is from where it hangs, in voxels: its body from the middle of it at its hips'
// height, its head from the base of its neck, a leg from its hip.
export const SHEEP_BODY_PIVOT: [number, number, number] = [6, 1, 10];
export const SHEEP_HEAD_PIVOT: [number, number, number] = [4, 0, 1];
export const SHEEP_LEG_PIVOT: [number, number, number] = [1, 6, 1];
// Where its parts sit, in voxels from the middle of it on the ground: each leg's hip (across, along), the base of its neck.
export const SHEEP_LEGS: ReadonlyArray<[x: number, z: number]> = [[-3, -5], [3, -5], [-3, 5], [3, 5]]; // hind left, hind right, fore left, fore right
export const SHEEP_NECK: [number, number, number] = [0, SHEEP_LEG_HEIGHT + 4, 8]; // (in its breast)

// Its fleece, slice by slice from its rump (z 1) to its breast (z 18): each the rows it fills, bottom to top. Round
// at both ends; its belly's wool a row under its hips, between its legs.
const WOOL: ReadonlyArray<[bottom: number, top: number]> = [
  [3, 7], [2, 8], [1, 9], // rump
  [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], [0, 9], // its back, its belly
  [1, 9], [2, 8], [3, 7], // breast
];
// Itself, under it: two voxels in from its fleece all round; and through the wool of its breast, where its neck leaves it.
const shorn = (x: number, y: number, z: number): boolean => {
  const body = z >= 3 && z <= 16 && y >= 1 && y <= 7 && x >= (y === 7 ? 3 : 2) && x <= (y === 7 ? 8 : 9) && !((z === 3 || z === 16) && (y === 1 || y === 7));
  return body || (z >= 17 && x >= 4 && x <= 7 && y >= 5 && y <= 7);
};

// Rounded across: its top row two voxels in each side, the row under it one, its bottom row one; its ends two voxels in, the slices next to them one.
export function buildSheepBody(): VoxelGrid {
  const grid = createGrid(SHEEP_BODY);
  const w = SHEEP_BODY[0];
  for (const [i, [bottom, top]] of WOOL.entries()) {
    const z = i + 1;
    const end = Math.max(0, 2 - Math.min(i, WOOL.length - 1 - i));
    for (let y = bottom; y <= top; y++) {
      // (Under its hips' height: only what's between its legs, so no leg's ever inside it.)
      const under = y < SHEEP_BODY_PIVOT[1] ? 4 : y === bottom || y === 1 ? 1 : 0;
      const inset = Math.max(under, 2 - (top - y)) + end;
      for (let x = inset; x < w - inset; x++) setColor(grid, x, y, z, shorn(x, y, z) ? C.skin : y === top ? C.light : y <= 2 ? C.shade : C.wool);
    }
  }
  for (let z = 17; z <= 18; z++) for (let y = 5; y <= 7; y++) for (let x = 4; x <= 7; x++) setColor(grid, x, y, z, C.skin); // (its neck's root)
  // Its tail: a dock of wool, behind its rump.
  for (let y = 5; y <= 7; y++) for (const x of [5, 6]) setColor(grid, x, y, 0, C.shade);
  return grid;
}

// Its head on its neck. The neck: short, forward and up, woolly, itself inside the wool. The face: small, bare,
// narrowing to its nose; an eye each side; a tuft of wool over its poll and brow; an ear out each side, behind its eye.
export function buildSheepHead(): VoxelGrid {
  const grid = createGrid(SHEEP_HEAD);
  // (Where its neck goes into its breast: none of it, so nothing of the two's ever in the same place.)
  const body = buildSheepBody();
  const inBody = (x: number, y: number, z: number) => colorAt(body, x + SHEEP_NECK[0] - SHEEP_HEAD_PIVOT[0] + SHEEP_BODY_PIVOT[0], y + SHEEP_NECK[1] - SHEEP_LEG_HEIGHT - SHEEP_HEAD_PIVOT[1] + SHEEP_BODY_PIVOT[1], z + SHEEP_NECK[2] - SHEEP_HEAD_PIVOT[2] + SHEEP_BODY_PIVOT[2]) !== 0;
  for (let z = 0; z <= 3; z++) {
    for (let y = 0; y <= 6; y++) {
      for (let x = 1; x <= 6; x++) {
        if ((y === 0 || y === 6) && (x === 1 || x === 6)) continue; // (rounded)
        const inside = x >= 2 && x <= 5 && y <= 5 && y >= (z === 3 ? 2 : 1); // (itself: none of it showing under its throat)
        if (!inBody(x, y, z)) setColor(grid, x, y, z, inside ? C.skin : y === 6 ? C.light : y <= 1 ? C.shade : C.wool);
      }
    }
  }
  for (let z = 4; z <= 7; z++) for (let y = 2; y <= (z <= 5 ? 6 : z === 6 ? 5 : 4); y++) for (let x = 2; x <= 5; x++) setColor(grid, x, y, z, C.face);
  for (const x of [2, 5]) setColor(grid, x, 5, 5, C.eye);
  for (let z = 1; z <= 4; z++) for (let x = 2; x <= 5; x++) setColor(grid, x, 7, z, C.light); // the tuft on its poll
  for (const x of [0, 1, 6, 7]) setColor(grid, x, 5, 4, C.ear);
  return grid;
}

// A leg: thin, straight, its face's colour, a dark hoof.
export function buildSheepLeg(_hind = false): VoxelGrid {
  const grid = createGrid(SHEEP_LEG);
  for (let y = 0; y < SHEEP_LEG[1]; y++) for (let z = 0; z < 2; z++) for (let x = 0; x < 2; x++) setColor(grid, x, y, z, y === 0 ? C.hoof : C.face);
  return grid;
}

// A sheep in one of its coats, said once (quadruped.ts): for the rig, the turning, the icon.
export const sheepShape = (coat = 0): Quadruped => ({ voxel: SHEEP_VOXEL_SIZE, palette: SHEEP_PALETTES[coat] ?? SHEEP_PALETTES[0], legHeight: SHEEP_LEG_HEIGHT, legs: SHEEP_LEGS, neck: SHEEP_NECK, pivots: { body: SHEEP_BODY_PIVOT, head: SHEEP_HEAD_PIVOT, leg: SHEEP_LEG_PIVOT }, body: buildSheepBody, head: buildSheepHead, leg: buildSheepLeg });
