// Every loot item's voxel model: junk, ingredients, provisions and quest items.

import type { LootId } from '../../../model/loot/loot';
import { JUNK_MODELS } from './junkVoxels';
import { INGREDIENT_MODELS } from './ingredientVoxels';
import type { LootModel } from './lootModel';
import { PROVISION_MODELS } from './provisionVoxels';
import { QUEST_MODELS } from './questItemVoxels';

export const LOOT_MODELS: Record<LootId, LootModel> = { ...JUNK_MODELS, ...INGREDIENT_MODELS, ...PROVISION_MODELS, ...QUEST_MODELS };
