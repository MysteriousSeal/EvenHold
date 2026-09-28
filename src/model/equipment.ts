// What a humanoid wears and holds. Every humanoid has the same naked body;
// armor is never part of it, but an item worn in a slot: five armor slots
// down the body, plus one item held in each hand. A slot holds one item at
// a time, so wearing an item replaces whatever was in its slot.
//
// The model only knows items by id and slot; how each one looks is the
// view's business (view/meshes/human/armor/).

import { hashUnit } from '../util/random';

export const ARMOR_SLOTS = ['head', 'torso', 'hands', 'legs', 'feet'] as const;
export const HELD_SLOTS = ['mainHand', 'offHand'] as const;
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];
export type HeldSlot = (typeof HELD_SLOTS)[number];
export type EquipSlot = ArmorSlot | HeldSlot;
export const EQUIP_SLOTS: readonly EquipSlot[] = [...ARMOR_SLOTS, ...HELD_SLOTS];

export const SLOT_NAMES: Record<EquipSlot, string> = {
  head: 'Head',
  torso: 'Torso',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  mainHand: 'Main hand',
  offHand: 'Off hand',
};

interface ItemInfo {
  name: string;
  slot: EquipSlot;
}

export const ITEMS = {
  // The hero's starter set: padded linen, leather and wool.
  leatherCap: { name: 'Leather cap', slot: 'head' },
  gambeson: { name: 'Gambeson', slot: 'torso' },
  woolHose: { name: 'Wool hose', slot: 'legs' },
  leatherBoots: { name: 'Leather boots', slot: 'feet' },
  armingSword: { name: 'Arming sword', slot: 'mainHand' },
  plankShield: { name: 'Plank shield', slot: 'offHand' },
  // Bandit gear: each bandit wears a mix of it (BANDIT_GEAR).
  banditHood: { name: 'Hood and mask', slot: 'head' },
  redBandana: { name: 'Red bandana', slot: 'head' },
  ironCap: { name: 'Nasal cap', slot: 'head' },
  banditVest: { name: 'Leather vest', slot: 'torso' },
  patchedTunic: { name: 'Patched tunic', slot: 'torso' },
  furJerkin: { name: 'Fur-collared jerkin', slot: 'torso' },
  banditGloves: { name: 'Riding gloves', slot: 'hands' },
  banditTrousers: { name: 'Belted trousers', slot: 'legs' },
  ropeTrousers: { name: 'Rope-belted trousers', slot: 'legs' },
  banditBoots: { name: 'Black boots', slot: 'feet' },
  footWraps: { name: 'Foot wraps', slot: 'feet' },
  shortSword: { name: 'Short sword', slot: 'mainHand' },
  hatchet: { name: 'Hatchet', slot: 'mainHand' },
  club: { name: 'Knotted club', slot: 'mainHand' },
  dagger: { name: 'Dagger', slot: 'mainHand' },
  buckler: { name: 'Buckler', slot: 'offHand' },
} as const satisfies Record<string, ItemInfo>;

export type ItemId = keyof typeof ITEMS;
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];

// Which item is in each slot; an empty slot is simply missing.
export type Equipment = Partial<Record<EquipSlot, ItemId>>;

export const STARTER_SET: readonly ItemId[] = ['leatherCap', 'gambeson', 'woolHose', 'leatherBoots', 'armingSword', 'plankShield'];
export const BANDIT_OUTFIT: readonly ItemId[] = ['banditHood', 'banditVest', 'banditGloves', 'banditTrousers', 'banditBoots', 'shortSword'];

// What a bandit may have in each slot, with weights (null: nothing there).
// Every bandit is dressed from this by pickOutfit, so no two gangs match.
export const BANDIT_GEAR: Record<EquipSlot, Array<[ItemId | null, number]>> = {
  head: [['banditHood', 3], ['redBandana', 2], ['ironCap', 2], [null, 2]],
  torso: [['banditVest', 3], ['patchedTunic', 2], ['furJerkin', 2]],
  hands: [['banditGloves', 1], [null, 1]],
  legs: [['banditTrousers', 1], ['ropeTrousers', 1]],
  feet: [['banditBoots', 2], ['footWraps', 1]],
  mainHand: [['shortSword', 3], ['hatchet', 2], ['club', 2], ['dagger', 2]],
  offHand: [['buckler', 1], [null, 3]],
};

export function slotOf(item: ItemId): EquipSlot {
  return ITEMS[item].slot;
}

export function isWorn(equipment: Equipment, item: ItemId): boolean {
  return equipment[slotOf(item)] === item;
}

// Puts the item in its slot, replacing what was there.
export function wear(equipment: Equipment, item: ItemId): void {
  equipment[slotOf(item)] = item;
}

// Takes the item off, if it's the one worn in its slot.
export function takeOff(equipment: Equipment, item: ItemId): void {
  if (isWorn(equipment, item)) delete equipment[slotOf(item)];
}

// An outfit drawn from `gear`, one weighted pick per slot, from a place
// (e.g. where someone spawned): the same spot always gives the same outfit.
export function pickOutfit(gear: Record<EquipSlot, Array<[ItemId | null, number]>>, x: number, z: number): Equipment {
  const equipment: Equipment = {};
  EQUIP_SLOTS.forEach((slot, i) => {
    const options = gear[slot];
    let roll = hashUnit(x, z, 60 + i) * options.reduce((sum, [, weight]) => sum + weight, 0);
    for (const [item, weight] of options) {
      roll -= weight;
      if (roll >= 0) continue;
      if (item) equipment[slot] = item;
      break;
    }
  });
  return equipment;
}

// Equipment wearing every item of a set.
export function outfit(items: readonly ItemId[]): Equipment {
  const equipment: Equipment = {};
  for (const item of items) wear(equipment, item);
  return equipment;
}
