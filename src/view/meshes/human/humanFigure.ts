// A humanoid as one still voxel model (standing, facing +Z), dressed like
// the rig, for icons and portraits: every part, shell and held item placed
// at its joint (bodyVoxels.ts BODIES), rounded to whole voxels. Drop the
// body (look = null) to show just what's worn, as it sits on someone.

import { EQUIP_SLOTS, hairShowsUnder, isHeldSlot, isJewelrySlot, type Equipment, type ItemId } from '../../../model/human/equipment';
import { hairUnder } from './hairUnderHelm';
import type { BodyLook, Build } from '../../../model/human/humanoid';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';
import { BODIES, HAIR_PIECE_PIVOT, HELD_BY, HELD_VOXEL_SIZE, HUMAN_VOXEL_SIZE, JOINTS, JOINT_NAMES, bodyPalette, buildBodyPart, buildHairPiece, type Joint } from './bodyVoxels';
import { ITEM_MODELS, wornGrid } from './gear/itemModels';
import { wornPad } from './gear/armorShell';

// Figure room: the joints' layout shifted so everything lands at >= 0,
// with space for shells, shields, and poles held in the middle (a spear
// or a staff reaches 12 voxels behind the hand and 20 ahead of it).
const SIZE: [number, number, number] = [24, 34, 56];
const SHIFT: [number, number, number] = [11, 2, 21];
// What's held is modelled in coarser voxels (bodyVoxels.ts HELD_VOXEL_SIZE):
// scaled up to the figure's, blocky, so it keeps its size beside the body.
const HELD_SCALE = HELD_VOXEL_SIZE / HUMAN_VOXEL_SIZE;
function scaled(grid: VoxelGrid, by: number): VoxelGrid {
  const [sx, sy, sz] = grid.size;
  const out = createGrid([Math.ceil(sx * by), Math.ceil(sy * by), Math.ceil(sz * by)]);
  const [ox, oy, oz] = out.size;
  for (let z = 0; z < oz; z++) {
    for (let y = 0; y < oy; y++) {
      for (let x = 0; x < ox; x++) {
        const c = colorAt(grid, Math.floor(x / by), Math.floor(y / by), Math.floor(z / by));
        if (c) setColor(out, x, y, z, c);
      }
    }
  }
  return out;
}

export interface Figure {
  grid: VoxelGrid;
  palette: number[];
}

// `only`: draw just these body parts (and what's worn on them). `build`:
// whose body what's worn is fitted to (the look's, when there's one).
export function humanFigure(look: BodyLook | null, equipment: Equipment, only: readonly Joint[] = JOINT_NAMES, build: Build = look?.build ?? 'male'): Figure {
  const { joints, pivot, hand } = BODIES[build];
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
    for (const joint of only) {
      const { part, at } = joints[joint];
      place(buildBodyPart(part, look), colors, at, pivot[part]);
    }
    // Up past the head: all of it bare-headed; under a piece open behind, what hangs below its rim; else none.
    const worn = equipment.head;
    const headgear = worn && hairShowsUnder(worn) ? wornGrid(worn, 'head', JOINTS.head.side, false, build) : null;
    const hair = !worn ? buildHairPiece(look.hairStyle) : headgear ? hairUnder(look.hairStyle, headgear) : null;
    if (hair && only.includes('head')) place(hair, colors, joints.head.at, HAIR_PIECE_PIVOT);
  }
  const shouldered = !!equipment.shoulders;
  for (const slot of EQUIP_SLOTS) {
    const item: ItemId | undefined = equipment[slot];
    if (!item || isJewelrySlot(slot)) continue; // jewelry doesn't show on the body
    const model = ITEM_MODELS[item];
    if (isHeldSlot(slot)) {
      if (!model.held) continue;
      const arm = joints[HELD_BY[slot]].at;
      const scale = model.held.fine ? 1 : HELD_SCALE; // (a fine one already in the body's voxels)
      place(scaled(model.held.build(), scale), model.palette, [arm[0] + hand[0], arm[1] + hand[1], arm[2] + hand[2]], model.held.grip.map((g) => g * scale));
      continue;
    }
    for (const joint of only) {
      const { part, side, at } = joints[joint];
      const shell = wornGrid(item, part, side, shouldered, build);
      if (shell) place(shell, model.palette, at, pivot[part].map((p) => p + wornPad(part)));
    }
  }
  return { grid, palette };
}

// The head only (a portrait): the figure above the neck, as worn,
// leaving out what's held (a tall shield would cover the face). Icons are
// seen from the +X+Z corner, where a figure's own +Z front reads as facing
// left; facing right, it's turned a quarter so its front is +X.
export function humanBust(look: BodyLook, equipment: Equipment, facing: 'left' | 'right' = 'right'): Figure {
  const figure = humanFigure(look, { ...equipment, mainHand: undefined, offHand: undefined });
  const [sx, sy, sz] = figure.grid.size;
  const chest = JOINTS.head.at[1] + SHIFT[1]; // everything below the head goes
  for (let z = 0; z < sz; z++) for (let y = 0; y < Math.min(chest, sy); y++) for (let x = 0; x < sx; x++) figure.grid.cells[x + sx * (y + sy * z)] = 0;
  if (facing === 'left') return figure;
  const turned = createGrid([sz, sy, sx]);
  for (let z = 0; z < sz; z++) {
    for (let y = chest; y < sy; y++) {
      for (let x = 0; x < sx; x++) {
        const c = colorAt(figure.grid, x, y, z);
        if (c) setColor(turned, z, y, sx - 1 - x, c); // front (+Z) to +X
      }
    }
  }
  return { grid: turned, palette: figure.palette };
}
