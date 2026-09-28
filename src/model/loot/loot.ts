// Loot: things enemies drop when they die, lying on the ground until the
// hero picks them up (with E, when close) into their bag. For now only
// junk (junk.ts), which is only good for selling.
//
// Each item says which families of enemies drop it (droppedBy); a kill
// drops something about half the time, rolled from the enemy's id so the
// same fight always gives the same loot.

import { hashUnit } from '../../util/random';
import { JUNK_ITEMS } from './junk';

// Who drops what: families of enemies (ENEMY_STATS[kind].family).
export type LootSource = 'beast' | 'humanoid';
export type LootQuality = 'junk';

export interface LootEntry {
  name: string;
  value: number; // copper pieces when sold
  droppedBy: Partial<Record<LootSource, number>>; // weights among what that family drops
}

export type LootId = keyof typeof JUNK_ITEMS;
export const LOOT: Record<LootId, LootEntry> = JUNK_ITEMS;
export const LOOT_IDS = Object.keys(LOOT) as LootId[];
export const LOOT_QUALITY: Record<LootId, LootQuality> = Object.fromEntries(LOOT_IDS.map((id) => [id, 'junk'])) as Record<LootId, LootQuality>;

export const DROP_CHANCE = 0.5;
export const PICKUP_RANGE = 0.9; // how close the hero must be to pick something up

// An item lying on the ground.
export interface GroundLoot {
  id: number;
  item: LootId;
  x: number;
  y: number;
  z: number;
}

// What a slain enemy of `source`'s family drops, or null: decided by its id.
export function rollDrop(source: LootSource, enemyId: number): LootId | null {
  if (hashUnit(enemyId, 0, 71) >= DROP_CHANCE) return null;
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

// The hero's bag: how many of each item they carry.
export type Bag = Partial<Record<LootId, number>>;

export function addToBag(bag: Bag, item: LootId): void {
  bag[item] = (bag[item] ?? 0) + 1;
}
