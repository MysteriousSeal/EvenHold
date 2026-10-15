// Which houses are hedge-witches' (npcs.ts marks them as it spawns the witches): one in about a village in three,
// the house of it farthest from its middle (at the edge of things, where she'd be), theirs alone: furnished as her
// cottage inside (witchLayout.ts), her own crooked cottage outside (view/meshes/building/witchHouse.ts).

import type { Entrance } from '../interiors/interiors';
import type { Village } from '../types';
import { hashUnit } from '../../util/random';

export const WITCH_SHARE = 1 / 3; // of villages with a hedge-witch
const FEWEST = 4; // houses a village has, at the least, to spare her one

const homes = new WeakSet<Entrance>();
export const markWitchHome = (entrance: Entrance): void => void homes.add(entrance);
export const isWitchHome = (entrance: Entrance): boolean => homes.has(entrance);

// Whether `village` has a hedge-witch, by where it stands (the same for everyone on the seed).
export const hasWitch = (seed: number, village: Village): boolean => hashUnit(Math.round(village.x), Math.round(village.z), (seed % 1_000_003) + 6151) < WITCH_SHARE;

// Her house in `village`, if it has her: of `houses` (its own, the herbalist's left out), the farthest from its
// middle; none, a village too small to spare one.
export function witchHomeIn(seed: number, village: Village, houses: readonly Entrance[]): Entrance | null {
  if (!hasWitch(seed, village) || houses.length < FEWEST) return null;
  let far: Entrance | null = null;
  let farD = -1;
  for (const h of houses) {
    const d = (h.x - village.x) ** 2 + (h.z - village.z) ** 2;
    if (d > farD) [far, farD] = [h, d];
  }
  return far;
}
