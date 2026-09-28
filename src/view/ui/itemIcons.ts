// Icons for things the hero carries, rendered from their own voxel models
// (voxelIcon.ts): gear as it sits when worn or held, loot as it lies.

import { ITEMS, type ItemId } from '../../model/human/equipment';
import type { LootId } from '../../model/loot/loot';
import { LOOT } from '../../model/loot/loot';
import type { BagItem } from '../../model/bag';
import { humanFigure } from '../meshes/human/humanFigure';
import { JUNK_MODELS } from '../meshes/loot/junkVoxels';
import type { MenuIcon } from './menu';
import { voxelIcon } from './voxelIcon';

export const gearIcon = (item: ItemId): MenuIcon => (size) =>
  voxelIcon(`item:${item}`, () => humanFigure(null, { [ITEMS[item].slot]: item }), size);

export const lootIcon = (item: LootId): MenuIcon => (size) =>
  voxelIcon(`loot:${item}`, () => ({ grid: JUNK_MODELS[item].build(), palette: JUNK_MODELS[item].palette }), size);

export const isLoot = (item: BagItem): item is LootId => item in LOOT;

export const bagIcon = (item: BagItem): MenuIcon => (isLoot(item) ? lootIcon(item) : gearIcon(item as ItemId));
