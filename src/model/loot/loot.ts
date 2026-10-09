// Loot: things enemies drop when they die, lying on the ground until the
// hero picks them up (with E, when close) into their bag (bag.ts). For now only
// junk (junk.ts), which is only good for selling, and ingredients
// (ingredients.ts), raw food to cook one day, and bags (bags.ts), fitted for more room. Provisions (provisions.ts),
// food and drink from the inn, and potions (potions.ts) are loot too, so they go in the bag the same way.
//
// Each item says which families of enemies drop it (droppedBy); a kill
// drops something about half the time, rolled from the enemy's id so the
// same fight always gives the same loot.

import { TOOL_ITEMS, isTool, type ToolId } from './tools';
import { hashUnit } from '../../util/random';
import { INGREDIENTS, isIngredient, type IngredientId } from './ingredients';
import { JUNK_ITEMS } from './junk';
import { BAG_ITEMS, isBagItem, type BagId } from './bags';
import { PROVISIONS, isProvision, type ProvisionId } from './provisions';
import { POTIONS, isPotion, type PotionId } from './potions';
import { QUEST_ITEMS, isQuestItem, type QuestItemId } from '../quests/questItems';
import type { BagItem } from '../hero/bag';
import type { LootEntry, LootSource } from './lootEntry';

export type LootQuality = 'junk' | 'ingredient' | 'common' | 'quest' | 'bag' | 'potion' | 'tool';

export type { LootEntry, LootSource } from './lootEntry';

export type LootId = keyof typeof JUNK_ITEMS | IngredientId | ProvisionId | QuestItemId | BagId | PotionId | ToolId;
export const LOOT: Record<LootId, LootEntry> = { ...JUNK_ITEMS, ...INGREDIENTS, ...PROVISIONS, ...QUEST_ITEMS, ...BAG_ITEMS, ...POTIONS, ...TOOL_ITEMS };
export const LOOT_IDS = Object.keys(LOOT) as LootId[];
export const LOOT_QUALITY: Record<LootId, LootQuality> = Object.fromEntries(LOOT_IDS.map((id) => [id, isProvision(id) ? 'common' : isPotion(id) ? 'potion' : isQuestItem(id) ? 'quest' : isBagItem(id) ? 'bag' : isTool(id) ? 'tool' : isIngredient(id) ? 'ingredient' : 'junk'])) as Record<LootId, LootQuality>;

export const DROP_CHANCE = 0.5;
export const PICKUP_RANGE = 0.9; // how close the hero must be to pick something up

// Something lying on the ground: loot, or gear put down.
export interface GroundLoot {
  id: number;
  item: BagItem;
  x: number;
  y: number;
  z: number;
}

// What a slain enemy of `source`'s family drops, or null: decided by its id.
export function rollDrop(source: LootSource, enemyId: number, chance = DROP_CHANCE): LootId | null {
  if (hashUnit(enemyId, 0, 71) >= chance) return null;
  const options = LOOT_IDS.flatMap((id): Array<[LootId, number]> => {
    const weight = LOOT[id].droppedBy[source];
    return weight ? [[id, weight]] : [];
  });
  let roll = hashUnit(enemyId, 0, 72) * options.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, weight] of options) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return null;
}
