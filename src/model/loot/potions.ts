// Potions: health (red) and energy (blue), each in three sizes, drunk at once
// (standing, mid-fight, unlike food: provisions.ts) for a share of the hero's
// most, then POTION_COOLDOWN seconds before another, any (hero/bag.ts
// drinkPotion). Sold by pedlars and the villages' herbalists; nothing drops
// them.

import type { LootEntry } from './lootEntry';

export interface Potion extends LootEntry {
  heal?: number; // health back, as a share of their most (0..1)
  energy?: number; // energy back, likewise
  about: string;
}

export const POTIONS = {
  minorHealthPotion: { name: 'Minor health potion', value: 20, heal: 0.25, droppedBy: {}, about: 'A small flask of something red and bitter.' },
  lesserHealthPotion: { name: 'Lesser health potion', value: 50, heal: 0.45, droppedBy: {}, about: 'Red as a robin, warm going down.' },
  greaterHealthPotion: { name: 'Greater health potion', value: 120, heal: 0.7, droppedBy: {}, about: 'It glows a little, and so will you.' },
  minorEnergyPotion: { name: 'Minor energy potion', value: 20, energy: 0.25, droppedBy: {}, about: 'Blue, fizzing, and strong enough.' },
  lesserEnergyPotion: { name: 'Lesser energy potion', value: 50, energy: 0.45, droppedBy: {}, about: 'Like a night\'s sleep in a mouthful.' },
  greaterEnergyPotion: { name: 'Greater energy potion', value: 120, energy: 0.7, droppedBy: {}, about: 'The herbalist won\'t say what\'s in it.' },
} satisfies Record<string, Potion>;

export type PotionId = keyof typeof POTIONS;
export const POTION_IDS = Object.keys(POTIONS) as PotionId[];
export const isPotion = (item: string): item is PotionId => item in POTIONS;

export const POTION_COOLDOWN = 30; // seconds after one before another, any

// What one costs (its value), or fetches sold back (half).
export const potionPrice = (id: PotionId, selling: boolean): number => (selling ? Math.floor(POTIONS[id].value / 2) : POTIONS[id].value);

// What one gives back, said short: "Restores 25% health at once".
export const potionText = (id: PotionId): string => {
  const { heal, energy } = POTIONS[id] as Potion;
  return `Restores ${Math.round((heal ?? energy ?? 0) * 100)}% ${heal ? 'health' : 'energy'} at once`;
};
