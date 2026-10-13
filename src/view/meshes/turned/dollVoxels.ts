// A rag doll in voxels (what someone turned into one is, in the world: a thing lying on the ground to be picked
// up, drawn as loot is, loot/lootModel.ts: 0.045 voxels, larger than life). One doll, nobody's in particular. It
// lies on its back, its head toward +Z, its face up (+Y): read from the game's camera by a big round head of yellow
// wool with a bunch tied either side, a red smock, two pale arms flung out, two short striped legs, one kicked
// aside. Close up (its icon): two dark button eyes, a stitched red mouth under them, a blush on each cheek, a seam
// sewn down its front, a green patch at its hem, thread where each arm is sewn on. Grid-aligned voxels only; what's
// round of it (a stuffed head, a stuffed belly) from stepped corners.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { LOOT_VOXEL_SIZE, model, type LootModel } from '../loot/lootModel';

export const DOLL_VOXEL_SIZE = LOOT_VOXEL_SIZE;
export const DOLL_GRID: [number, number, number] = [7, 3, 10]; // across, up off the ground, along it from its feet

// The palette, said first: linen and its shade (its face, its hands); a blush; its smock and that's shade, a patch
// on it; wool and its shade; a button; thread; its mouth's red; its stockings' cream and their stripe; a shoe.
const ROLES = ['linen', 'linenShade', 'blush', 'smock', 'smockDark', 'patch', 'wool', 'woolDark', 'button', 'thread', 'mouth', 'stocking', 'stripe', 'shoe'] as const;
const C = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<(typeof ROLES)[number], number>;
export const DOLL_PALETTE: number[] = [0xead8b8, 0xcdb590, 0xe6a48e, 0xb5483a, 0x8a3029, 0x5f8f6a, 0xe0a93a, 0xb47f26, 0x2a2630, 0x5a3e2c, 0x9c2a22, 0xf1e8d6, 0xb5483a, 0x4a3222];

export const DOLL_MODEL: LootModel = model(DOLL_PALETTE, DOLL_GRID, (g) => {
  // Its legs: short, stuffed, in striped stockings; a shoe on each, the right kicked out aside.
  for (const [x, aside] of [[1, 0], [4, 1]]) {
    fillBox(g, x, 0, 1, x + 1, 1, 1, (at) => ((at - x) % 2 ? C.stripe : C.stocking));
    fillBox(g, x + aside, 0, 0, x + 1 + aside, 1, 0, C.shoe);
  }
  // Its body: a smock over a stuffed belly, rounder down its middle; its hem darker.
  fillBox(g, 1, 0, 2, 5, 1, 5, (_x, _y, z) => (z === 2 ? C.smockDark : C.smock));
  fillBox(g, 2, 2, 2, 4, 2, 5, (_x, _y, z) => (z === 2 ? C.smockDark : C.smock));
  for (const z of [3, 5]) setColor(g, 3, 2, z, C.thread); // the seam down its front, stitch by stitch
  setColor(g, 4, 2, 2, C.patch); // a patch, at the hem
  setColor(g, 5, 1, 2, C.patch);
  // Its arms: flung out either side, lower than its belly; thread at each shoulder, a bare linen hand at each end.
  for (const x of [0, 6]) fillBox(g, x, 0, 3, x, 1, 5, (_x, y, z) => (z === 3 ? C.linen : y === 1 && z === 5 ? C.thread : C.smockDark));
  // Its head: big, stuffed, its edges in shade.
  fillBox(g, 1, 0, 6, 5, 2, 9, (x, y) => (y < 2 && (x === 1 || x === 5) ? C.linenShade : C.linen));
  // Its hair, of wool: over the crown, a fringe across the brow in strands, a bunch tied either side.
  fillBox(g, 1, 0, 9, 5, 2, 9, (x) => (x % 2 ? C.wool : C.woolDark));
  fillBox(g, 1, 2, 8, 5, 2, 8, (x) => (x % 2 ? C.woolDark : C.wool));
  for (const x of [0, 6]) fillBox(g, x, 0, 7, x, 1, 8, (_x, y, z) => (z === 7 && y === 1 ? C.woolDark : C.wool));
  // Its face: two buttons for eyes; a blush either side; a mouth stitched in red.
  for (const x of [2, 4]) setColor(g, x, 2, 7, C.button);
  for (const x of [1, 5]) setColor(g, x, 2, 6, C.blush);
  fillBox(g, 2, 2, 6, 4, 2, 6, (x) => (x === 3 ? C.mouth : C.linen));
  setColor(g, 3, 2, 6, C.mouth);
});

// The doll, lying: a grid of DOLL_GRID in DOLL_PALETTE (0 where there's nothing of it).
export const buildDoll = (): VoxelGrid => DOLL_MODEL.build();
