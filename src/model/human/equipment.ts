// What a humanoid wears and holds. Every humanoid has the same naked body;
// armor is never part of it, but an item worn in a slot: five armor slots
// down the body, plus one item held in each hand. A slot holds one item at
// a time, so wearing an item replaces whatever was in its slot.
//
// The items themselves are in the catalog (items/); how each one looks is
// the view's business (view/meshes/human/gear/).

import { hashUnit } from '../../util/random';
import { ITEMS, ITEM_IDS, type ItemId, type Wearer } from './items';

export { ITEMS, ITEM_IDS, type ItemId, type Wearer };

export const ARMOR_SLOTS = ['head', 'torso', 'hands', 'legs', 'feet'] as const;
export const HELD_SLOTS = ['mainHand', 'offHand'] as const;
export type ArmorSlot = (typeof ARMOR_SLOTS)[number];
export type HeldSlot = (typeof HELD_SLOTS)[number];
export type EquipSlot = ArmorSlot | HeldSlot;
export const EQUIP_SLOTS: readonly EquipSlot[] = [...ARMOR_SLOTS, ...HELD_SLOTS];

export function isHeldSlot(slot: EquipSlot): slot is HeldSlot {
  return slot === 'mainHand' || slot === 'offHand';
}

export const SLOT_NAMES: Record<EquipSlot, string> = {
  head: 'Head',
  torso: 'Torso',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  mainHand: 'Main hand',
  offHand: 'Off hand',
};

// Which item is in each slot; an empty slot is simply missing.
export type Equipment = Partial<Record<EquipSlot, ItemId>>;

export const STARTER_SET: readonly ItemId[] = ['leatherCap', 'gambeson', 'woolHose', 'leatherBoots', 'armingSword', 'plankShield'];
export const BANDIT_OUTFIT: readonly ItemId[] = ['maskedHood', 'leatherVest', 'ridingGloves', 'beltedTrousers', 'blackBoots', 'shortSword'];

// How often each kind of wearer leaves a slot empty, as a weight against the
// items it wears there (ItemEntry.wornBy). Slots not listed are always filled.
export const EMPTY_SLOT_WEIGHT: Record<Wearer, Partial<Record<EquipSlot, number>>> = {
  bandit: { head: 2, hands: 3, offHand: 9 },
};

type Options = Array<[ItemId | null, number]>;
const gearCache = new Map<Wearer, Record<EquipSlot, Options>>();

// What a kind of wearer may have in each slot, with weights (null: empty),
// gathered from the catalog.
export function gearOf(wearer: Wearer): Record<EquipSlot, Options> {
  let gear = gearCache.get(wearer);
  if (!gear) {
    gear = Object.fromEntries(EQUIP_SLOTS.map((slot) => [slot, [] as Options])) as Record<EquipSlot, Options>;
    for (const item of ITEM_IDS) {
      const weight = ITEMS[item].wornBy?.[wearer];
      if (weight) gear[ITEMS[item].slot].push([item, weight]);
    }
    for (const slot of EQUIP_SLOTS) {
      const empty = EMPTY_SLOT_WEIGHT[wearer][slot];
      if (empty) gear[slot].push([null, empty]);
    }
    gearCache.set(wearer, gear);
  }
  return gear;
}

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

// An outfit for a kind of wearer, one weighted pick per slot, from a place
// (e.g. where someone spawned): the same spot always gives the same outfit.
export function pickOutfit(wearer: Wearer, x: number, z: number): Equipment {
  const gear = gearOf(wearer);
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
