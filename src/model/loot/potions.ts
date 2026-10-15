// Potions: health (red) and energy (blue), each in three sizes, drunk at once
// (standing, mid-fight, unlike food: provisions.ts) for a share of the hero's
// most, then POTION_COOLDOWN seconds before another, any (hero/bag.ts
// drinkPotion). A lesser or a greater health potion gives part at once and the
// rest over the seconds after (`mend`): one a fight, it carries them through
// it, healing as the blows come, where a big heal at once would spill over the
// top. Sold by pedlars and the villages' herbalists; nothing drops them.

import type { LootEntry } from './lootEntry';

export interface Potion extends LootEntry {
  heal?: number; // health back at once, as a share of their most (0..1)
  mend?: number; // and more over the `mendFor` seconds after, likewise (hero.draught: blows don't stop it)
  mendFor?: number;
  energy?: number; // energy back, likewise
  about: string;
}

export const POTIONS = {
  minorHealthPotion: { name: 'Minor health potion', value: 20, heal: 0.25, droppedBy: {}, about: 'A small flask of something red and bitter.' },
  lesserHealthPotion: { name: 'Lesser health potion', value: 50, heal: 0.2, mend: 0.3, mendFor: 6, droppedBy: {}, about: 'Red as a robin, warm going down.' },
  greaterHealthPotion: { name: 'Greater health potion', value: 120, heal: 0.25, mend: 0.6, mendFor: 10, droppedBy: {}, about: 'It glows a little, and so will you.' },
  minorEnergyPotion: { name: 'Minor energy potion', value: 11, energy: 0.25, droppedBy: {}, about: 'Blue, fizzing, and strong enough.' },
  lesserEnergyPotion: { name: 'Lesser energy potion', value: 20, energy: 0.45, droppedBy: {}, about: 'Like a night\'s sleep in a mouthful.' },
  greaterEnergyPotion: { name: 'Greater energy potion', value: 31, energy: 0.7, droppedBy: {}, about: 'The herbalist won\'t say what\'s in it.' },
} satisfies Record<string, Potion>; // (health, a copper a share point the lesser, 1.4 the greater, against food's half: paid for drunk standing, mid-fight; energy's cheaper than health: about 0.44 copper a share point, half again an ale's, 0.3, for a flask on the road)

export type PotionId = keyof typeof POTIONS;
export const POTION_IDS = Object.keys(POTIONS) as PotionId[];
export const isPotion = (item: string): item is PotionId => item in POTIONS;

export const POTION_COOLDOWN = 30; // seconds after one before another, any

// What one costs (its value), or fetches sold back (half).
export const potionPrice = (id: PotionId, selling: boolean): number => (selling ? Math.floor(POTIONS[id].value / 2) : POTIONS[id].value);

// What one gives back, said short: "Restores 25% health at once" (", and 60% more over 10 s").
export const potionText = (id: PotionId): string => {
  const { heal, energy, mend, mendFor } = POTIONS[id] as Potion;
  const more = mend ? `, and ${Math.round(mend * 100)}% more over ${mendFor} s` : '';
  return `Restores ${Math.round((heal ?? energy ?? 0) * 100)}% ${heal ? 'health' : 'energy'} at once${more}`;
};
