// Every item's look, by id, and the voxel grids each one is made of.

import { ITEMS, type ArmorSlot, type ItemId } from '../../../../model/equipment';
import type { VoxelGrid } from '../../voxel/greedyMesh';
import type { BodyPart, Side } from '../bodyVoxels';
import { SLOT_BANDS, buildShell } from './armorShell';
import { BANDIT_MODELS } from './banditOutfit';
import { BANDIT_WEAPON_MODELS } from './banditWeapons';
import type { ItemModel } from './itemModel';
import { STARTER_MODELS } from './starterSet';

export const ITEM_MODELS: Record<ItemId, ItemModel> = { ...STARTER_MODELS, ...BANDIT_MODELS, ...BANDIT_WEAPON_MODELS };

// The shell a worn item puts on one body part (on the given side), or null
// if it doesn't cover that part.
export function wornGrid(item: ItemId, part: BodyPart, side: Side): VoxelGrid | null {
  const paint = ITEM_MODELS[item].worn?.[part];
  const band = SLOT_BANDS[ITEMS[item].slot as ArmorSlot]?.[part];
  return paint && band ? buildShell(part, band, side, paint) : null;
}
