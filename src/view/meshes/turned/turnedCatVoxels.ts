// A cat in voxels, at 0.016 (as the cats that live about the villages are: wildlife/catVoxels.ts, whose look this
// takes after): whoever's been turned into one. It faces +Z. Read from the game's camera by its shape and its
// coat: a long slim body on four straight legs; a big round head carried high and before it, an ear at each corner
// of it; its tail stood straight up behind, the tip of it bent back. Close to (its turning: view/cinema/): a pale
// muzzle and a pink nose, an eye each side of it, whiskers either side of that, its ears pink inside, pale paws;
// and its coat's markings (`marked`). A body (its tail with it: `isCatTail`, a part of its own in its rig, in two
// lengths), a head and four legs, each its own part. An odd number of voxels wide throughout, so its nose and its
// tail are in the middle of it. Grid-aligned voxels only.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import type { Quadruped } from './quadruped';

export const TURNED_CAT_VOXEL_SIZE = 0.016;

// The palette, said first: its coat; its markings; the pale of its muzzle, chest and paws; pink (its nose, the
// inside of its ears); an eye; its whiskers.
const ROLES = ['coat', 'mark', 'belly', 'pink', 'eye', 'whisker'] as const;
type Role = (typeof ROLES)[number];
export const TURNED_CAT_COLORS = Object.fromEntries(ROLES.map((role, i) => [role, i + 1])) as Record<Role, number>;
const C = TURNED_CAT_COLORS;
// Its coats, each the same roles in other colours: a grey tabby, striped dark; black, a white bib, chin and tail
// tip its markings; ginger, striped darker; white, smudged grey between its ears, on its back and its tail.
const PINK = 0xd8898a;
export const TURNED_CAT_PALETTES: number[][] = [
  [0x8c8679, 0x4a463f, 0xd2ccbe, PINK, 0xd8c040, 0xf2eee4],
  [0x2c2a2a, 0xf0ece4, 0x3c3838, PINK, 0xa8d048, 0xd6d0c4],
  [0xd8843a, 0xa4561f, 0xf2d6a8, PINK, 0x8cba34, 0xfaf4e6],
  [0xf0ece4, 0x8e8a84, 0xfaf8f4, PINK, 0x6ab0d8, 0xd8d2c6],
];
type Coat = 'striped' | 'bibbed' | 'smudged';
const COATS: Coat[] = ['striped', 'bibbed', 'striped', 'smudged'];

export const CAT_TAIL = 2; // the rows of its body's grid behind its rump: its tail's
export const TURNED_CAT_BODY: [number, number, number] = [3, 6, CAT_TAIL + 8];
export const TURNED_CAT_HEAD: [number, number, number] = [5, 5, 4];
export const TURNED_CAT_LEG: [number, number, number] = [1, 3, 2];
export const TURNED_CAT_LEG_HEIGHT = 3; // voxels its hips and shoulders are off the ground
// Where each part's own (0, 0, 0) is from where it hangs, in voxels.
export const TURNED_CAT_BODY_PIVOT: [number, number, number] = [1.5, 0, CAT_TAIL + 4];
export const TURNED_CAT_HEAD_PIVOT: [number, number, number] = [2.5, 0, 0];
export const TURNED_CAT_LEG_PIVOT: [number, number, number] = [0.5, 3, 1];
// Where its parts sit, in voxels from the middle of its body on the ground: each leg's hip (across, along), the back of its head.
export const TURNED_CAT_LEGS: ReadonlyArray<[x: number, z: number]> = [[-1, -2], [1, -2], [-1, 3], [1, 3]]; // hind left, hind right, fore left, fore right
export const TURNED_CAT_NECK: [number, number, number] = [0, TURNED_CAT_LEG_HEIGHT + 2, 4];

// Its tail, in its body's grid: straight up behind its rump, the tip bent back (row, then how far behind).
const TAIL: ReadonlyArray<[y: number, z: number]> = [[2, 1], [3, 1], [4, 1], [5, 1], [5, 0]];

// Where its coat's marked. Striped: bands over its back and down its flanks, rings on its tail, two bars on its
// brow. Bibbed: its chest, its chin, the tip of its tail. Smudged: a cap between its ears, a patch on its back, the
// upper half of its tail.
function marked(coat: Coat, part: 'body' | 'head', x: number, y: number, z: number): boolean {
  const tail = part === 'body' && z < CAT_TAIL;
  if (coat === 'striped') return part === 'head' ? y === 3 && (x === 1 || x === 3) && z <= 1 : tail ? y === 3 || (y === 5 && z === 1) : y >= 1 && (z - CAT_TAIL) % 2 === 1 && z < CAT_TAIL + 7;
  if (coat === 'bibbed') return part === 'head' ? z === 3 && y === 0 : tail ? z === 0 : z === CAT_TAIL + 7 && (y === 0 || x === 1) && y <= 1;
  return part === 'head' ? y === 3 && x >= 1 && x <= 3 && z <= 1 : tail ? y >= 4 : y === 2 && x <= 1 && z >= CAT_TAIL + 3 && z <= CAT_TAIL + 5;
}

// Its body: slim, its rump rounded off above; pale under it and up its chest. Its tail, behind.
export function buildTurnedCatBody(coat = 0): VoxelGrid {
  const grid = createGrid(TURNED_CAT_BODY);
  const kind = COATS[coat] ?? COATS[0];
  const front = CAT_TAIL + 7;
  for (let z = CAT_TAIL; z <= front; z++) {
    for (let y = 0; y <= 2; y++) {
      for (let x = 0; x < 3; x++) {
        if (z === CAT_TAIL && y === 2 && x !== 1) continue; // (rounded)
        setColor(grid, x, y, z, marked(kind, 'body', x, y, z) ? C.mark : (y === 0 && x === 1) || (z === front && y === 0) ? C.belly : C.coat);
      }
    }
  }
  for (const [y, z] of TAIL) setColor(grid, 1, y, z, marked(kind, 'body', 1, y, z) ? C.mark : C.coat);
  return grid;
}
// Its tail, of its body's voxels, and the upper half of that.
export const isCatTail = (_x: number, _y: number, z: number): boolean => z < CAT_TAIL;
export const isCatTailEnd = (_x: number, y: number, _z: number): boolean => y >= 4;
// Where its tail turns, in its body's voxels: at its rump; and half way up it.
export const CAT_TAIL_JOINT: [number, number, number] = [1.5, 2.5, CAT_TAIL];
export const CAT_TAIL_END_JOINT: [number, number, number] = [1.5, 4, 1.5];

// Its head: five wide, four high, three deep, its lower corners cut; a pale muzzle out before it, the nose on that;
// an eye each side of it, above; an ear at each top corner, pink before; its whiskers, a pale voxel either side of its muzzle.
export function buildTurnedCatHead(coat = 0): VoxelGrid {
  const grid = createGrid(TURNED_CAT_HEAD);
  const kind = COATS[coat] ?? COATS[0];
  const hue = (x: number, y: number, z: number, color: number) => (marked(kind, 'head', x, y, z) ? C.mark : color);
  for (let z = 0; z <= 2; z++) {
    for (let y = 0; y <= 3; y++) for (let x = 0; x <= 4; x++) if (!(y === 0 && (x === 0 || x === 4))) setColor(grid, x, y, z, hue(x, y, z, C.coat));
  }
  for (let x = 1; x <= 3; x++) for (const y of [0, 1]) setColor(grid, x, y, 3, hue(x, y, 3, C.belly));
  setColor(grid, 2, 1, 3, C.pink);
  for (const x of [1, 3]) setColor(grid, x, 2, 2, C.eye);
  for (const x of [0, 4]) {
    setColor(grid, x, 4, 1, C.coat);
    setColor(grid, x, 4, 2, C.pink);
  }
  for (const x of [0, 4]) setColor(grid, x, 1, 3, C.whisker);
  return grid;
}

// A leg: straight, two voxels deep; a pale paw.
export function buildTurnedCatLeg(): VoxelGrid {
  const grid = createGrid(TURNED_CAT_LEG);
  for (let y = 0; y <= 2; y++) for (const z of [0, 1]) setColor(grid, 0, y, z, y === 0 ? C.belly : C.coat);
  return grid;
}

// A cat in one of its coats (tabby, black, ginger, white), said once (quadruped.ts): for its rig, its turning, its icon.
export const turnedCatShape = (coat = 0): Quadruped => ({ voxel: TURNED_CAT_VOXEL_SIZE, palette: TURNED_CAT_PALETTES[coat] ?? TURNED_CAT_PALETTES[0], legHeight: TURNED_CAT_LEG_HEIGHT, legs: TURNED_CAT_LEGS, neck: TURNED_CAT_NECK, pivots: { body: TURNED_CAT_BODY_PIVOT, head: TURNED_CAT_HEAD_PIVOT, leg: TURNED_CAT_LEG_PIVOT }, body: () => buildTurnedCatBody(coat), head: () => buildTurnedCatHead(coat), leg: buildTurnedCatLeg });
