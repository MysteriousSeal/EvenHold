// Every loot item's voxel model: junk and provisions.

import type { LootId } from '../../../model/loot/loot';
import { JUNK_MODELS } from './junkVoxels';
import type { LootModel } from './lootModel';
import { PROVISION_MODELS } from './provisionVoxels';

export const LOOT_MODELS: Record<LootId, LootModel> = { ...JUNK_MODELS, ...PROVISION_MODELS };
