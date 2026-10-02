// Armor is worn, never painted on the body. Each piece is its own voxel
// shell, one voxel out from the body part it covers, meshed on its own and
// hung on the part's joint, so it moves with the body. Each is fitted to the
// build that wears it (male or female, bodyVoxels.ts).
//
// Two rules keep pieces from ever sharing a voxel (which would flicker
// where their faces meet):
// - Each armor slot owns a band of rows on each part (SLOT_BANDS): the
//   torso slot the chest and the sleeves, the legs slot the hips and thighs,
//   the feet slot the ankles and toes, and so on.
// - Limbs leave the side facing the body open, so the shells of two legs,
//   or of an arm and the chest, never overlap.

import type { ArmorSlot } from '../../../../model/human/equipment';
import type { Build } from '../../../../model/human/humanoid';
import type { VoxelGrid } from '../../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../../voxel/voxelShapes';
import { buildBodyPart, type BodyPart, type Side } from '../bodyVoxels';

// Pieces are designed on the body as it once was, coarser (LEGACY: its part
// sizes): their painters and bands speak in its voxels. Each shell is
// built around today's finer body, and each of its voxels mapped back to
// that body's to ask what color it is, so every piece fits unchanged.
const LEGACY: Record<BodyPart, [number, number, number]> = { leg: [3, 5, 4], torso: [7, 6, 4], arm: [2, 6, 2], head: [7, 7, 7] };
// A coordinate along a part `size` voxels long, in a legacy part `old` long
// (the layers just outside it stay just outside).
const legacy = (v: number, size: number, old: number) => (v < 0 ? -1 : v >= size ? old : Math.min(old - 1, Math.floor((v * old) / size)));

// Rows (inclusive, in the legacy part's voxels, where -1 is the layer under
// the part and its height the layer over it) each slot may cover on each part.
export const SLOT_BANDS: Record<ArmorSlot, Partial<Record<BodyPart, [number, number]>>> = {
  head: { head: [0, 7] }, // all of it, crown included; nothing under the chin
  shoulders: { arm: [5, 6] }, // the top of each arm; the sleeves yield it (bandFor)
  torso: { torso: [2, 5], arm: [2, 6] }, // chest and waist; sleeves and shoulders
  hands: { arm: [-1, 1] }, // the hand, the fist's underside included
  legs: { torso: [0, 1], leg: [2, 4] }, // hips; knees to thighs
  feet: { leg: [0, 1] }, // ankles and feet, not the sole
};

// The rows a slot covers on a part, given whether shoulders are worn: they
// take the top of each arm (rows 5-6) from the torso's sleeves, which then
// stop at row 4. Without shoulders, sleeves keep their own caps.
export function bandFor(slot: ArmorSlot, part: BodyPart, shouldered: boolean): [number, number] | undefined {
  const band = SLOT_BANDS[slot][part];
  return band && slot === 'torso' && part === 'arm' && shouldered ? [band[0], 4] : band;
}

// One shell voxel, in the part's own voxel coordinates (so the shell's
// outer layers are -1 and the part's size), and which way it faces.
export interface ShellCell {
  x: number;
  y: number;
  z: number;
  front: boolean; // in front of the part (+Z)
  back: boolean;
  flank: boolean; // beside it, left or right
  top: boolean; // over it
  center: boolean; // in the part's middle column (on the torso: under the chin, the buckle's place)
}

// Picks a shell voxel's color (a palette index + 1), or 0 to leave it open.
export type Painter = (cell: ShellCell) => number;

// A piece's palette from named colors, with each name's index + 1.
export function namedPalette<T extends Record<string, number>>(entries: T): { palette: number[]; c: Record<keyof T, number> } {
  const names = Object.keys(entries) as Array<keyof T>;
  const c = Object.fromEntries(names.map((name, i) => [name, i + 1])) as Record<keyof T, number>;
  return { palette: names.map((name) => entries[name]), c };
}

const shapes = new Map<string, VoxelGrid>();
function bodyShape(part: BodyPart, build: Build): VoxelGrid {
  let shape = shapes.get(`${build}:${part}`);
  if (!shape) {
    shape = buildBodyPart(part, { build, hairStyle: 'short', beard: false }); // every look of a build has its shape
    shapes.set(`${build}:${part}`, shape);
  }
  return shape;
}

// The shell around `part` within the `band` rows, painted by `paint`: every
// empty voxel touching the part (by a face, an edge or a corner). On a limb
// (`side` left or right), the side facing the body stays open. The grid is
// one voxel bigger than the part on every side: part voxel (x, y, z) is
// grid voxel (x + 1, y + 1, z + 1).
export function buildShell(part: BodyPart, band: [number, number], side: Side, paint: Painter, build: Build = 'male'): VoxelGrid {
  const body = bodyShape(part, build);
  const [sx, sy, sz] = body.size;
  const grid = createGrid([sx + 2, sy + 2, sz + 2]);
  const inner = side === 'right' ? sx : side === 'left' ? -1 : null; // the right side is -X, so it faces the body at +X
  const touches = (x: number, y: number, z: number) => {
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (colorAt(body, x + dx, y + dy, z + dz)) return true;
    return false;
  };
  const [ox, oy, oz] = LEGACY[part];
  for (let z = -1; z <= sz; z++) {
    for (let y = -1; y <= sy; y++) {
      const ly = legacy(y, sy, oy);
      if (ly < band[0] || ly > band[1]) continue;
      for (let x = -1; x <= sx; x++) {
        if (x === inner || colorAt(body, x, y, z) || !touches(x, y, z)) continue;
        const lx = legacy(x, sx, ox);
        const color = paint({ x: lx, y: ly, z: legacy(z, sz, oz), front: z >= sz, back: z < 0, flank: x < 0 || x >= sx, top: y >= sy, center: x * 2 === sx - 1 });
        if (color) setColor(grid, x + 1, y + 1, z + 1, color);
      }
    }
  }
  return grid;
}

// What's worn on the head is sculpted, not a painted skin: at the head's own
// voxels (an 11-voxel cube, 0..10; the face at z 10, eyes on rows 4-6, the
// brows on row 8, the mouth on row 2), out to HEAD_PAD layers round it, so a
// piece stands out in relief (rims, ridges, a nose guard, a brim, folds).
// Never under the chin (row 0 and up): the shoulders are there.
export const HEAD_PAD = 3;
export interface HeadCell {
  x: number; // head voxels: 0..10 over the head, below 0 and past 10 round it
  y: number;
  z: number;
  d: number; // layers out from the head (1: against it, up to HEAD_PAD)
  front: boolean; // past the face (+Z)
  back: boolean;
  flank: boolean; // past a side
  top: boolean; // over the crown
}
export type HeadPainter = (cell: HeadCell) => number;

// The grid a head piece paints: the head's cube with HEAD_PAD round it (head voxel (x, y, z) at grid (x + HEAD_PAD, ...)).
export function buildHeadgear(paint: HeadPainter, build: Build = 'male'): VoxelGrid {
  const [sx, sy, sz] = bodyShape('head', build).size;
  const P = HEAD_PAD;
  const grid = createGrid([sx + 2 * P, sy + 2 * P, sz + 2 * P]);
  const out = (v: number, size: number) => (v < 0 ? -v : v >= size ? v - size + 1 : 0);
  for (let z = -P; z < sz + P; z++) {
    for (let y = 0; y < sy + P; y++) {
      for (let x = -P; x < sx + P; x++) {
        const d = Math.max(out(x, sx), out(y, sy), out(z, sz));
        if (d === 0) continue; // (the head)
        const color = paint({ x, y, z, d, front: z >= sz, back: z < 0, flank: x < 0 || x >= sx, top: y >= sy });
        if (color) setColor(grid, x + P, y + P, z + P, color);
      }
    }
  }
  return grid;
}

// How far a part's worn grid reaches past it, each way (its pivot that much further in): a head piece's, HEAD_PAD; a shell's, 1.
export const wornPad = (part: BodyPart): number => (part === 'head' ? HEAD_PAD : 1);

// A color marking the body inside a shell grid (see withBody).
export const BODY_FILL = 255;

// A copy of `shell` with the body part filled in as BODY_FILL. Meshed with
// BODY_FILL left out, the body counts as solid but isn't drawn, so the shell
// gets no faces against the skin (they'd never be seen) and is shaded
// where it meets the body.
export function withBody(shell: VoxelGrid, part: BodyPart, build: Build = 'male'): VoxelGrid {
  const body = bodyShape(part, build);
  const [sx, sy, sz] = body.size;
  const p = wornPad(part);
  const grid = { size: shell.size, cells: shell.cells.slice() };
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) if (colorAt(body, x, y, z)) setColor(grid, x + p, y + p, z + p, BODY_FILL);
  return grid;
}
