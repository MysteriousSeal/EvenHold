// A cow in voxels, at 0.02 (as the horse and the hen are): whoever's been turned into one (model/spells/chickens.ts).
// She faces +Z. A cow of an old breed (red and white, or another coat: COW_PALETTES), read by her shape first and few colours: a long, deep, square
// barrel of a body on short thick legs, her back level, her hips standing square above it, a heavy belly; her neck
// short, carried forward and low, a dewlap under it; a broad head with a wide pink muzzle, horns out and up from her
// poll, an ear under each; red patches over her shoulders and neck, her rump, a flank; a pink udder under her,
// behind; a thin tail hung from her rump to a tuft. A body (her tail and udder with it), a head on its neck (so it
// can be lowered to graze) and four legs, each its own part. Grid-aligned voxels only; what's round, stepped.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const COW_VOXEL_SIZE = 0.02;

// The palette, said first: white and its shade; the red of her patches and its shade; pink (her muzzle, her udder);
// horn; her hooves; an eye.
const ROLES = ['white', 'shade', 'red', 'redDark', 'pink', 'horn', 'hoof', 'eye'] as const;
type Role = (typeof ROLES)[number];
export const COW_COLORS = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
const C = COW_COLORS;
// Her coats (model/spells/chickens.ts COW_COATS: one hers by chance), each the same roles in other colours: red and
// white; black and white; dun all over, her patches a darker brown; black all over.
const REST = [0xe6a59c, 0xe8dcc0, 0x3a3028, 0x14100e]; // (her muzzle and udder, her horns, her hooves, her eyes: the same on each)
export const COW_PALETTES: number[][] = [
  [0xf2ece0, 0xcfc6b4, 0x8a4326, 0x6a3018, ...REST],
  [0xf2ece0, 0xcfc6b4, 0x2e2a28, 0x1a1715, ...REST],
  [0xb08a5e, 0x8e6c46, 0x7a5434, 0x5e3e24, ...REST],
  [0x34302e, 0x242120, 0x2a2624, 0x1a1716, ...REST],
];
export const COW_PALETTE = COW_PALETTES[0];

export const COW_BODY: [number, number, number] = [10, 12, 26]; // (her tail hung behind her: the two rows at z 0 and 1)
export const COW_HEAD: [number, number, number] = [8, 11, 12];
export const COW_LEG: [number, number, number] = [2, 9, 4];
export const COW_LEG_HEIGHT = 9; // voxels her hips and shoulders are off the ground
// Where each part's own (0, 0, 0) is from where it hangs, in voxels: her body from the middle of it at her hips'
// height, her head from the base of her neck, a leg from its hip.
export const COW_BODY_PIVOT: [number, number, number] = [5, 3, 14];
export const COW_HEAD_PIVOT: [number, number, number] = [4, 0, 2];
export const COW_LEG_PIVOT: [number, number, number] = [1, 9, 2];
// Where her parts sit, in voxels from the middle of her on the ground: each leg's hip (across, along), the base of her neck.
export const COW_LEGS: ReadonlyArray<[x: number, z: number]> = [[-4, -8], [4, -8], [-4, 8], [4, 8]]; // hind left, hind right, fore left, fore right
export const COW_NECK: [number, number, number] = [0, COW_LEG_HEIGHT + 2, 11]; // (in her breast, low)

// Her body, slice by slice from her rump (z 2) to her breast (z 25): each the rows it fills, bottom to top. A square
// rump, her hips a row over her back; a belly hung low along her middle; her brisket lower still between her
// forelegs; a breast cut back.
const BARREL: ReadonlyArray<[bottom: number, top: number]> = [
  [3, 10], [2, 11], [2, 11], [2, 11], [2, 11], [2, 10], [2, 10], // rump, hips
  [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], [1, 10], // her belly, her back
  [1, 11], [1, 11], [0, 11], [0, 11], [0, 11], // withers, brisket
  [1, 10], [2, 10], [3, 9], // breast
];
// Her patches: over her shoulders and withers; her rump; a spot on her near flank.
const patched = (x: number, y: number, z: number): boolean => (z >= 17 && y >= 5) || (z <= 7 && y >= 6 && !(z >= 6 && y <= 7)) || (x <= 3 && z >= 10 && z <= 13 && y >= 6 && y <= 9);

// Square across: only her top and bottom rows a voxel in each side; her ends a voxel in too.
export function buildCowBody(): VoxelGrid {
  const grid = createGrid(COW_BODY);
  const w = COW_BODY[0];
  for (const [i, [bottom, top]] of BARREL.entries()) {
    const z = i + 2;
    const end = i === 0 || i === BARREL.length - 1;
    for (let y = bottom; y <= top; y++) {
      // (Under her hips' height: only what's between her legs, so no leg's ever inside her.)
      const inset = Math.max(y < COW_BODY_PIVOT[1] ? 2 : 0, y === bottom || y === top ? 1 : 0) + (end ? 1 : 0);
      for (let x = inset; x < w - inset; x++) setColor(grid, x, y, z, patched(x, y, z) ? (y === top ? C.red : x === inset || x === w - inset - 1 ? C.redDark : C.red) : y <= bottom + 1 ? C.shade : C.white);
    }
  }
  // Her udder: under her, between her hind legs, a teat at each corner.
  for (let z = 5; z <= 8; z++) for (let x = 3; x <= 6; x++) setColor(grid, x, 1, z, C.pink);
  for (const z of [5, 8]) for (const x of [3, 6]) setColor(grid, x, 0, z, C.pink);
  // Her tail: thin, from the top of her rump down behind her, to a tuft.
  for (const x of [4, 5]) setColor(grid, x, 10, 1, C.shade);
  for (let y = 3; y <= 9; y++) setColor(grid, 4, y, 0, C.shade);
  for (let y = 0; y <= 2; y++) for (const x of [4, 5]) setColor(grid, x, y, 0, C.redDark);
  return grid;
}

// Her head on its neck. The neck: short, forward, a dewlap hung under it. The head: broad and deep, a white face
// between red cheeks; a wide muzzle, pink, its nostrils dark; an eye each side; horns out from her poll and up; an
// ear under each, behind.
export function buildCowHead(): VoxelGrid {
  const grid = createGrid(COW_HEAD);
  // (Where her neck goes into her breast: none of it, so nothing of the two's ever in the same place.)
  const body = buildCowBody();
  const inBody = (x: number, y: number, z: number) => colorAt(body, x + COW_NECK[0] - COW_HEAD_PIVOT[0] + COW_BODY_PIVOT[0], y + COW_NECK[1] - COW_LEG_HEIGHT - COW_HEAD_PIVOT[1] + COW_BODY_PIVOT[1], z + COW_NECK[2] - COW_HEAD_PIVOT[2] + COW_BODY_PIVOT[2]) !== 0;
  for (let z = 0; z <= 4; z++) {
    for (let y = 1; y <= 7; y++) for (let x = 2; x <= 5; x++) if (!inBody(x, y, z)) setColor(grid, x, y, z, y === 7 ? C.red : x === 2 || x === 5 ? C.redDark : C.red);
    for (const x of [3, 4]) if (z >= 1 && !inBody(x, 0, z)) setColor(grid, x, 0, z, C.shade); // her dewlap
  }
  for (let z = 5; z <= 9; z++) {
    for (let y = 2; y <= 8; y++) {
      for (let x = 1; x <= 6; x++) {
        if ((y === 2 || y === 8) && (x === 1 || x === 6)) continue; // (rounded)
        const face = (x === 3 || x === 4) && (y === 8 || z === 9);
        setColor(grid, x, y, z, face ? C.white : y === 2 ? C.redDark : C.red);
      }
    }
  }
  // Her muzzle: wide, pink before; her nostrils.
  for (let z = 10; z <= 11; z++) for (let y = 2; y <= 5; y++) for (let x = 2; x <= 5; x++) setColor(grid, x, y, z, z === 11 || y === 2 ? C.pink : y === 5 && (x === 3 || x === 4) ? C.white : C.pink);
  for (const x of [2, 5]) setColor(grid, x, 4, 11, C.hoof);
  for (const x of [1, 6]) setColor(grid, x, 6, 8, C.eye);
  // Horns: out, then up. Ears: under them, behind.
  for (const x of [0, 7]) {
    setColor(grid, x, 8, 6, C.horn);
    for (const y of [9, 10]) setColor(grid, x, y, 6, C.horn);
    for (const z of [5, 6]) setColor(grid, x, 6, z, C.redDark);
  }
  return grid;
}

// A leg, row by row up from its hoof: how far along it reaches (from, to). Short and thick. A foreleg: straight. A
// hind leg: its hock a voxel behind.
const FORE: ReadonlyArray<[number, number]> = [[1, 3], [1, 2], [1, 3], [1, 2], [1, 2], [1, 3], [0, 3], [0, 3], [0, 3]];
const HIND: ReadonlyArray<[number, number]> = [[1, 3], [1, 2], [0, 2], [1, 2], [1, 2], [0, 2], [0, 2], [0, 3], [0, 3]];
// White, shaded at the knee; a dark hoof.
export function buildCowLeg(hind = false): VoxelGrid {
  const grid = createGrid(COW_LEG);
  for (const [y, [from, to]] of (hind ? HIND : FORE).entries()) {
    for (let z = from; z <= to; z++) for (let x = 0; x < 2; x++) setColor(grid, x, y, z, y === 0 ? C.hoof : y === 5 || y === 1 ? C.shade : C.white);
  }
  return grid;
}
