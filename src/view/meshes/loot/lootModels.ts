// Every loot item's voxel model: junk, ingredients, provisions, a cook's meals, quest items, bags, potions, tools and charms written down.

import type { LootId } from '../../../model/loot/loot';
import { JUNK_MODELS } from './junkVoxels';
import { INGREDIENT_MODELS } from './ingredientVoxels';
import type { LootModel } from './lootModel';
import { PROVISION_MODELS } from './provisionVoxels';
import { MEAL_MODELS } from './mealVoxels';
import { QUEST_MODELS } from './questItemVoxels';
import { BAG_MODELS } from './bagVoxels';
import { POTION_MODELS } from './potionVoxels';
import { TOOL_MODELS } from './toolVoxels';
import { SCROLL_MODELS } from './scrollVoxels';

export const LOOT_MODELS: Record<LootId, LootModel> = { ...JUNK_MODELS, ...INGREDIENT_MODELS, ...PROVISION_MODELS, ...MEAL_MODELS, ...QUEST_MODELS, ...BAG_MODELS, ...POTION_MODELS, ...TOOL_MODELS, ...SCROLL_MODELS };
