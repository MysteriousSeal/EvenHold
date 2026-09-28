// Every item's look, by id (one file per slot in items/, like the catalog
// in model/human/items/), and the voxel grids each one is made of.

import { ITEMS, type ArmorSlot, type ItemId } from '../../../../model/human/equipment';
import type { Build } from '../../../../model/human/humanoid';
import type { VoxelGrid } from '../../voxel/greedyMesh';
import type { BodyPart, Side } from '../bodyVoxels';
import { bandFor, buildShell } from './armorShell';
import type { ItemModel } from './itemModel';
import { FEET_MODELS } from './items/feet';
import { HANDS_MODELS } from './items/hands';
import { HEAD_MODELS } from './items/head';
import { JEWELRY_MODELS } from './items/jewelry';
import { SHOULDERS_MODELS } from './items/shoulders';
import { LEGS_MODELS } from './items/legs';
import { MAIN_HAND_MODELS } from './items/mainHand';
import { OFF_HAND_MODELS } from './items/offHand';
import { TORSO_MODELS } from './items/torso';

export const ITEM_MODELS: Record<ItemId, ItemModel> = {
  ...HEAD_MODELS,
  ...SHOULDERS_MODELS,
  ...JEWELRY_MODELS,
  ...TORSO_MODELS,
  ...HANDS_MODELS,
  ...LEGS_MODELS,
  ...FEET_MODELS,
  ...MAIN_HAND_MODELS,
  ...OFF_HAND_MODELS,
};

// The shell a worn item puts on one body part (on the given side), or null
// if it doesn't cover that part, fitted to the wearer's build. `shouldered`:
// shoulders are worn too (sleeves then leave the top of the arms to them).
export function wornGrid(item: ItemId, part: BodyPart, side: Side, shouldered = false, build: Build = 'male'): VoxelGrid | null {
  const paint = ITEM_MODELS[item].worn?.[part];
  const slot = ITEMS[item].slot as ArmorSlot;
  const band = paint ? bandFor(slot, part, shouldered) : undefined;
  return paint && band ? buildShell(part, band, side, paint, build) : null;
}
