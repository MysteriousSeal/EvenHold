// What the hero does with their hands, outdoors (GameModel's, by these): the loot nearest them in reach, picked up into
// the bag (the bag full: left where it lies, told so; a quest's thing, counted for it); a thing dropped from the bag
// on the ground just ahead of them (nothing's dropped indoors, nor in the furniture yard); what's worn taken off and
// dropped so; and the coins near them, scooped into their purse as they pass.

import type { EquipSlot } from '../human/equipment';
import type { GroundLoot } from '../loot/loot';
import type { Ground } from '../loot/ground';
import type { GameEvent, Hero } from '../types';
import { addToBag, takeFromBag, type BagItem } from './bag';
import { bagRoom, canCarry } from './bagSlots';
import { takeFromSlot } from './bagStacks';
import { takeOff } from './wearing';

const DROP_AHEAD = 0.45; // how far in front of the hero things dropped from the bag land

export interface Hands {
  readonly hero: Hero;
  readonly inside: unknown | null;
  readonly yard: unknown | null;
  readonly dungeon: unknown | null;
  readonly groundHere: Ground;
  readonly quests: { onPickUp(item: BagItem): void };
  dropLoot(item: BagItem, x: number, z: number): void;
  report(event: GameEvent): void;
}

// The loot nearest the hero within reach to pick up (outdoors, or down a dungeon), or null.
export const lootInReach = (m: Hands): GroundLoot | null => ((m.inside && !m.dungeon) || m.yard ? null : m.groundHere.nearest(m.hero.x, m.hero.z));

// Picks up the loot in reach into the hero's bag; returns what it was, or null.
export function pickUp(m: Hands): BagItem | null {
  const loot = lootInReach(m);
  if (!loot) return null;
  if (!canCarry(m.hero, loot.item)) return (m.report({ kind: 'poor', text: 'Your bag is full' }), null); // (left where it lies)
  m.groundHere.take(loot);
  addToBag(m.hero.bag, loot.item);
  m.quests.onPickUp(loot.item);
  return loot.item;
}

// Takes one `item` out of the hero's bag and puts it on the ground just in front of them; returns whether they had
// one. `slot`: the bag's slot it's from (one off that very stack, if it's one of several).
export function dropFromBag(m: Hands, item: BagItem, slot?: number): boolean {
  if (m.inside || m.yard) return false; // nothing's dropped indoors, or in the furniture yard
  if (!(slot === undefined ? takeFromBag(m.hero.bag, item) : takeFromSlot(m.hero, slot, bagRoom(m.hero)) === item)) return false;
  m.dropLoot(item, m.hero.x + Math.sin(m.hero.facing) * DROP_AHEAD, m.hero.z + Math.cos(m.hero.facing) * DROP_AHEAD);
  return true;
}

// Takes off what's worn in `slot` and puts it on the ground in front of the hero.
export function dropEquipped(m: Hands, slot: EquipSlot): boolean {
  const item = m.hero.equipment[slot];
  return !!item && takeOff(m.hero, slot) && dropFromBag(m, item);
}

// Coins near the hero go into their purse (no need to stop for them).
export function scoopCoins(m: Hands): void {
  const amount = m.groundHere.scoop(m.hero.x, m.hero.z);
  m.hero.money += amount;
  if (amount > 0) m.report({ kind: 'coins', amount });
}
