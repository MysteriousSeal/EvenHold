// Smithing's page of the skill's window (skillWindow.ts): the recipe book (recipeBook.ts) with smithing's recipes
// (model/skills/smithing.ts), an ingot or a fitting told as a material, a pick as a miner's tool; made only at a
// smithy's anvil (said so, picked, when away from one).

import type { GameModel } from '../../model/GameModel';
import { SMITH_GROUPS, SMITH_RECIPES, SMITH_RECIPE_IDS, smithRise, type SmithRecipeId } from '../../model/skills/smithing';
import type { Craft } from './recipeBook';

export const SMITHING: Craft = {
  skill: 'smithing',
  name: 'Smithing',
  recipes: SMITH_RECIPES,
  ids: SMITH_RECIPE_IDS,
  groups: SMITH_GROUPS,
  crafter: (model) => model.smithing,
  rise: (id, level) => smithRise(id as SmithRecipeId, level),
  kind: (id) => (SMITH_RECIPES[id as SmithRecipeId].group === 'Tools' ? 'Tool · a miner’s: the best carried is used' : 'Crafting material'),
  notHere: (model: GameModel) => (model.smithing.anvilInReach ? '' : 'Stand at a smithy’s anvil to work metal.'),
  verb: 'Forge',
  empty: 'Nothing you can forge with what’s in your bag. Salvage iron scrap, dig ore, or untick the filter to see every recipe.',
};
