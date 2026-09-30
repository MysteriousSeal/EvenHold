// Putting gear on and taking it off: between the hero's bag and what they
// wear, a slot at a time.

import { ITEMS, wear, type EquipSlot, type ItemId } from '../human/equipment';
import type { Hero } from '../types';
import { addToBag, takeFromBag } from './bag';
import { fitToMost } from './attributes';

// Takes off what's worn in `slot`, into the bag; returns whether there was something.
export function takeOff(hero: Hero, slot: EquipSlot): boolean {
  const item = hero.equipment[slot];
  if (!item) return false;
  delete hero.equipment[slot];
  addToBag(hero.bag, item);
  fitToMost(hero); // (less Stamina, less Endurance)
  return true;
}

// Wears `item` from the bag, putting what was in its slot back in the bag;
// returns whether the bag had one.
export function putOn(hero: Hero, item: ItemId): boolean {
  if (!takeFromBag(hero.bag, item)) return false;
  takeOff(hero, ITEMS[item].slot);
  wear(hero.equipment, item);
  fitToMost(hero); // (less Stamina, less Endurance)
  return true;
}
