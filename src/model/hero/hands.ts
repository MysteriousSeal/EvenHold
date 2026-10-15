// What the hero does with their hands, outdoors (GameModel's, by these): the loot nearest them in reach, picked up into
// the bag (the bag full: left where it lies, told so; a quest's thing, counted for it); a thing dropped from the bag
// on the ground just ahead of them (nothing's dropped indoors but down a dungeon, nor in the furniture yard); what's worn taken off and
// dropped so, straight from them (a full bag no bar); and the coins near them, scooped into their purse as they pass.

import type { EquipSlot } from '../human/equipment';
import type { GroundLoot } from '../loot/loot';
import type { Ground } from '../loot/ground';
import type { GameEvent, Hero } from '../types';
import { addToBag, takeFromBag, type BagItem } from './bag';
import { bagRoom, canCarry } from './bagSlots';
import { bagStacks, takeFromSlot } from './bagStacks';
import { fitToMost } from './attributes';

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

const GATHER = 2.5; // tiles round the hero the like of what's picked up is gathered with it (a felled tree's logs, at once)

// Picks up the loot in reach into the hero's bag; returns what it was, or null.
export const pickUp = (m: Hands): BagItem | null => gather(m)?.item ?? null;

// Picks up the loot in reach and every other of the same lying near (the nearest first), as many as the bag takes;
// returns what and how many, or null (nothing in reach; the bag full for even the one: left where it lies, told so).
export function gather(m: Hands): { item: BagItem; count: number } | null {
  const loot = lootInReach(m);
  if (!loot) return null;
  if (!canCarry(m.hero, loot.item)) return (m.report({ kind: 'poor', text: 'Your bag is full' }), null);
  const { hero } = m;
  const d = (other: GroundLoot) => Math.hypot(other.x - hero.x, other.z - hero.z);
  const alike = m.groundHere.loot.filter((other) => other !== loot && other.item === loot.item && d(other) <= GATHER).sort((a, b) => d(a) - d(b));
  let count = 0;
  for (const one of [loot, ...alike]) {
    if (!canCarry(hero, one.item)) break; // (the bag full: the rest left where they lie)
    m.groundHere.take(one);
    addToBag(hero.bag, one.item);
    m.quests.onPickUp(one.item);
    count++;
  }
  return { item: loot.item, count };
}

// Takes one `item` out of the hero's bag and puts it on the ground just in front of them; returns whether they had
// one. `slot`: the bag's slot it's from (one off that very stack, if it's one of several).
export function dropFromBag(m: Hands, item: BagItem, slot?: number): boolean {
  if ((m.inside && !m.dungeon) || m.yard) return false; // nothing's dropped indoors (a dungeon's floor aside: kept, dungeons/dungeonFloors.ts), or in the furniture yard
  const room = bagRoom(m.hero);
  if (slot !== undefined && bagStacks(m.hero.bag, m.hero.bagOrder, m.hero.bagCounts, room).layout[slot] !== item) return false; // (that slot holds something else: nothing taken, to be lost)
  if (!(slot === undefined ? takeFromBag(m.hero.bag, item) : takeFromSlot(m.hero, slot, room) === item)) return false;
  return dropAhead(m, item);
}

// Takes off what's worn in `slot` and puts it straight on the ground in front of the hero (never through the bag: a
// full one no bar); nothing dropped indoors (but down a dungeon) or in the furniture yard, where it stays worn.
export function dropEquipped(m: Hands, slot: EquipSlot): boolean {
  const item = m.hero.equipment[slot];
  if (!item || (m.inside && !m.dungeon) || m.yard) return false;
  delete m.hero.equipment[slot];
  fitToMost(m.hero); // (less Stamina, less Endurance)
  return dropAhead(m, item);
}

// On the ground just ahead of the hero.
function dropAhead(m: Hands, item: BagItem): true {
  m.dropLoot(item, m.hero.x + Math.sin(m.hero.facing) * DROP_AHEAD, m.hero.z + Math.cos(m.hero.facing) * DROP_AHEAD);
  return true;
}

// Coins near the hero go into their purse (no need to stop for them).
export function scoopCoins(m: Hands): void {
  const amount = m.groundHere.scoop(m.hero.x, m.hero.z);
  m.hero.money += amount;
  if (amount > 0) m.report({ kind: 'coins', amount });
}
