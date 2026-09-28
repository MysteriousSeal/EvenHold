// A humanoid as one still voxel model (standing, facing +Z), dressed like
// the rig, for icons and portraits: every part, shell and held item placed
// at its joint (bodyVoxels.ts JOINTS), rounded to whole voxels. Drop the
// body (look = null) to show just what's worn, as it sits on someone.

import { EQUIP_SLOTS, isHeldSlot, type Equipment, type ItemId } from '../../../model/human/equipment';
import type { BodyLook } from '../../../model/human/humanoid';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';
import { HAND, HELD_BY, JOINTS, JOINT_NAMES, PART_PIVOT, bodyPalette, buildBodyPart } from './bodyVoxels';
import { ITEM_MODELS, wornGrid } from './gear/itemModels';

// Figure room: the joints' layout shifted so everything lands at >= 0,
// with space for shells, shields, and poles held in the middle (a spear
// or a staff reaches 12 voxels behind the hand and 20 ahead of it).
const SIZE: [number, number, number] = [15, 22, 36];
const SHIFT: [number, number, number] = [6.5, 1, 14];

export interface Figure {
  grid: VoxelGrid;
  palette: number[];
}

export function humanFigure(look: BodyLook | null, equipment: Equipment): Figure {
  const grid = createGrid(SIZE);
  const palette: number[] = [];
  const bases = new Map<number[], number>(); // where each palette starts in the figure's, added once
  // Copies `part` in with its colors (after the ones already used), placing
  // its voxel `pivot` at figure point `at`.
  const place = (part: VoxelGrid, colors: number[], at: number[], pivot: number[]) => {
    let base = bases.get(colors);
    if (base === undefined) {
      base = palette.length;
      if (base + colors.length > 255) throw new Error('figure has too many colors');
      bases.set(colors, base);
      palette.push(...colors);
    }
    const [ox, oy, oz] = [0, 1, 2].map((a) => Math.round(at[a] + SHIFT[a] - pivot[a]));
    const [sx, sy, sz] = part.size;
    if (ox < 0 || oy < 0 || oz < 0 || ox + sx > SIZE[0] || oy + sy > SIZE[1] || oz + sz > SIZE[2]) throw new Error('figure too small for this part');
    for (let z = 0; z < sz; z++) {
      for (let y = 0; y < sy; y++) {
        for (let x = 0; x < sx; x++) {
          const c = colorAt(part, x, y, z);
          if (c) setColor(grid, x + ox, y + oy, z + oz, base + c);
        }
      }
    }
  };

  if (look) {
    const colors = bodyPalette(look);
    for (const joint of JOINT_NAMES) {
      const { part, at } = JOINTS[joint];
      place(buildBodyPart(part, look), colors, at, PART_PIVOT[part]);
    }
  }
  for (const slot of EQUIP_SLOTS) {
    const item: ItemId | undefined = equipment[slot];
    if (!item) continue;
    const model = ITEM_MODELS[item];
    if (isHeldSlot(slot)) {
      if (!model.held) continue;
      const arm = JOINTS[HELD_BY[slot]].at;
      place(model.held.build(), model.palette, [arm[0] + HAND[0], arm[1] + HAND[1], arm[2] + HAND[2]], model.held.grip);
      continue;
    }
    for (const joint of JOINT_NAMES) {
      const { part, side, at } = JOINTS[joint];
      const shell = wornGrid(item, part, side);
      if (shell) place(shell, model.palette, at, PART_PIVOT[part].map((p) => p + 1));
    }
  }
  return { grid, palette };
}
