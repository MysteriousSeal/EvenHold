// A bandit camp's chief (its elite): one to each camp, a bandit as any but
// bigger, heavier-hitting and in the best of their gear (a horned helm, a fur
// mantle, a brigandine, a mace), a level over the camp's. He stands before the
// banner, by the fire. Named for his camp when it's his ("Redhand" of
// "Redhand's Lair"), else a name of his own, from the same outlaws' names.
// While he lives the camp's chest stays locked (campChest.ts: he has its key).

import type { Equipment } from '../human/equipment';
import { pickAt } from '../../util/random';
import { zoneLevel } from '../enemies/enemyLevels';
import { CAMP_NAMES, campName } from './campNames';
import { turn, type Camp } from './camps';

export const CHIEF_OUTFIT: Equipment = {
  head: 'hornedHelm',
  shoulders: 'furMantle',
  torso: 'brigandine',
  hands: 'ridingGloves',
  legs: 'leatherBreeches',
  feet: 'blackBoots',
  neck: 'wolfToothNecklace',
  mainHand: 'mace',
};

// An owner's name for a man ("Redhand's" → "Redhand", "the Butcher's" → "The Butcher"); null for a band ("the Brothers'").
const asChief = (owner: string): string | null => {
  if (owner.endsWith("s'") && owner.startsWith('the ')) return null;
  const name = owner.replace(/'s$|'$/, '');
  return name.charAt(0).toUpperCase() + name.slice(1);
};

export function chiefName(camp: { x: number; z: number }, seed: number): string {
  const owner = CAMP_NAMES.owners.find((o) => campName(camp, seed).startsWith(`${o} `));
  const own = owner && asChief(owner);
  if (own) return own;
  const men = CAMP_NAMES.owners.map(asChief).filter((n): n is string => n !== null);
  return pickAt(camp.x, camp.z, seed * 151)(men, 1);
}

// His level: the camp's ground's (its bandits that or one either side), and one over.
export const chiefLevel = (spawn: { x: number; z: number }, camp: { x: number; z: number }): number => zoneLevel(spawn, camp) + 1;

// Where he stands: before the banner, between it and the fire (if that's free), else the first of `free`.
export function chiefSpot(camp: Camp, free: ReadonlyArray<[number, number]>): [number, number] | null {
  const [dx, dz] = turn(0, -1, camp.quarterTurns);
  const front = free.find(([x, z]) => x === camp.x + dx && z === camp.z + dz);
  return front ?? free[0] ?? null;
}
