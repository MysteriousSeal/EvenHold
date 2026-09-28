// Armor is worn, never painted on the body. Each piece is its own voxel
// shell, one voxel out from the body part it covers, meshed on its own and
// hung on the part's joint, so it moves with the body. The same shell fits
// every humanoid, since they all share one body shape.
//
// Two rules keep pieces from ever sharing a voxel (which would flicker
// where their faces meet):
// - Each armor slot owns a band of rows on each part (SLOT_BANDS): the
//   torso slot the chest and the sleeves, the legs slot the hips and thighs,
//   the feet slot the ankles and toes, and so on.
// - Limbs leave the side facing the body open, so the shells of two legs,
//   or of an arm and the chest, never overlap.

import type { ArmorSlot } from '../../../../model/human/equipment';
import { HERO_LOOK } from '../../../../model/human/humanoid';
import type { VoxelGrid } from '../../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../../voxel/voxelShapes';
import { buildBodyPart, type BodyPart, type Side } from '../bodyVoxels';

// Rows (inclusive, in the part's own voxels, where -1 is the layer under the
// part and its height the layer over it) each slot may cover on each part.
export const SLOT_BANDS: Record<ArmorSlot, Partial<Record<BodyPart, [number, number]>>> = {
  head: { head: [0, 7] }, // all of it, crown included; nothing under the chin
  torso: { torso: [2, 5], arm: [2, 6] }, // chest and waist; sleeves and shoulders
  hands: { arm: [-1, 1] }, // the hand, the fist's underside included
  legs: { torso: [0, 1], leg: [2, 4] }, // hips; knees to thighs
  feet: { leg: [0, 1] }, // ankles and feet, not the sole
};

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
}

// Picks a shell voxel's color (a palette index + 1), or 0 to leave it open.
export type Painter = (cell: ShellCell) => number;

// A piece's palette from named colors, with each name's index + 1.
export function namedPalette<T extends Record<string, number>>(entries: T): { palette: number[]; c: Record<keyof T, number> } {
  const names = Object.keys(entries) as Array<keyof T>;
  const c = Object.fromEntries(names.map((name, i) => [name, i + 1])) as Record<keyof T, number>;
  return { palette: names.map((name) => entries[name]), c };
}

const shapes = new Map<BodyPart, VoxelGrid>();
function bodyShape(part: BodyPart): VoxelGrid {
  let shape = shapes.get(part);
  if (!shape) {
    shape = buildBodyPart(part, HERO_LOOK); // every look has the same shape
    shapes.set(part, shape);
  }
  return shape;
}

// The shell around `part` within the `band` rows, painted by `paint`: every
// empty voxel touching the part (by a face, an edge or a corner). On a limb
// (`side` left or right), the side facing the body stays open. The grid is
// one voxel bigger than the part on every side: part voxel (x, y, z) is
// grid voxel (x + 1, y + 1, z + 1).
export function buildShell(part: BodyPart, band: [number, number], side: Side, paint: Painter): VoxelGrid {
  const body = bodyShape(part);
  const [sx, sy, sz] = body.size;
  const grid = createGrid([sx + 2, sy + 2, sz + 2]);
  const inner = side === 'right' ? sx : side === 'left' ? -1 : null; // the right side is -X, so it faces the body at +X
  const touches = (x: number, y: number, z: number) => {
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (colorAt(body, x + dx, y + dy, z + dz)) return true;
    return false;
  };
  for (let z = -1; z <= sz; z++) {
    for (let y = Math.max(-1, band[0]); y <= Math.min(sy, band[1]); y++) {
      for (let x = -1; x <= sx; x++) {
        if (x === inner || colorAt(body, x, y, z) || !touches(x, y, z)) continue;
        const color = paint({ x, y, z, front: z >= sz, back: z < 0, flank: x < 0 || x >= sx, top: y >= sy });
        if (color) setColor(grid, x + 1, y + 1, z + 1, color);
      }
    }
  }
  return grid;
}

// A color marking the body inside a shell grid (see withBody).
export const BODY_FILL = 255;

// A copy of `shell` with the body part filled in as BODY_FILL. Meshed with
// BODY_FILL left out, the body counts as solid but isn't drawn, so the shell
// gets no faces against the skin (they'd never be seen) and is shaded
// where it meets the body.
export function withBody(shell: VoxelGrid, part: BodyPart): VoxelGrid {
  const body = bodyShape(part);
  const [sx, sy, sz] = body.size;
  const grid = { size: shell.size, cells: shell.cells.slice() };
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) if (colorAt(body, x, y, z)) setColor(grid, x + 1, y + 1, z + 1, BODY_FILL);
  return grid;
}
