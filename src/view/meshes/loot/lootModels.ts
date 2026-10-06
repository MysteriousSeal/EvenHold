// Every loot item's voxel model: junk, ingredients, provisions, quest items and bags.

import type { LootId } from '../../../model/loot/loot';
import { JUNK_MODELS } from './junkVoxels';
import { INGREDIENT_MODELS } from './ingredientVoxels';
import type { LootModel } from './lootModel';
import { PROVISION_MODELS } from './provisionVoxels';
import { QUEST_MODELS } from './questItemVoxels';
import { BAG_MODELS } from './bagVoxels';
import { POTION_MODELS } from './potionVoxels';
import { MATERIAL_MODELS } from './materialVoxels';

export const LOOT_MODELS: Record<LootId, LootModel> = { ...JUNK_MODELS, ...INGREDIENT_MODELS, ...PROVISION_MODELS, ...QUEST_MODELS, ...BAG_MODELS, ...POTION_MODELS, ...MATERIAL_MODELS };
