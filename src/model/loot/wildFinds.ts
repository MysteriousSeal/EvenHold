// Small finds off the road, there to be picked up (as any loot on the ground: loot/ground.ts), each once for good:
// a cache under some cairns and at the foot of some standing stones (an old coin, a charm, a locket), an offering
// left on some ruins' altars, and by some boulders, willows and dead trees a rare herb of that country (the dearest
// that grows there: loot/herbs.ts). Which, and what, by the seed and the tile, so the same for everyone on a seed.

import { hashUnit } from '../../util/random';
import type { LootId } from './loot';
import { HERBS, HERB_ITEMS, HERB_IDS, type HerbId } from './herbs';
import { BIOMES, type Biome } from '../scenery/biomes';
import type { Scenery, SceneryKind } from '../scenery/scenery';
import type { Ruin } from '../ruins/ruins';

export interface WildFind {
  key: string; // its tile's, for good (`find:x,z`)
  item: LootId;
  x: number;
  z: number;
}

// Of each kind, the share that has one (sparse: a few to a region, met every few minutes' roaming).
const CHANCE: Partial<Record<SceneryKind, number>> = { cairn: 0.1, menhir: 0.03, boulder: 0.008, willow: 0.015, snag: 0.01 };
const ALTAR_CHANCE = 0.5;
const CACHE: readonly LootId[] = ['oldSilver', 'boneCharm', 'fadedLocket', 'rustyBuckle', 'oldArrowhead', 'frostTorc'];
const OFFERING: readonly LootId[] = ['graveCandle', 'fadedLocket', 'oldSilver', 'boneCharm'];
const HERB_BY = (['boulder', 'willow', 'snag'] as const satisfies readonly SceneryKind[]) as readonly SceneryKind[];
// The dearest herb of each country.
const RARE_HERB = Object.fromEntries(
  BIOMES.map((b) => [b, HERB_IDS.filter((id) => HERBS[id].in.includes(b)).sort((a, c) => HERB_ITEMS[c].value - HERB_ITEMS[a].value)[0]]),
) as Record<Biome, HerbId | undefined>;

const SALT = 9301;
const pick = <T>(list: readonly T[], x: number, z: number, seed: number) => list[Math.floor(hashUnit(x, z, seed + SALT + 1) * list.length) % list.length];

export function wildFinds(seed: number, scenery: readonly Scenery[], ruins: readonly Ruin[], countryAt: (x: number, z: number) => Biome): WildFind[] {
  const finds: WildFind[] = [];
  const at = (item: LootId | undefined, x: number, z: number) => item && finds.push({ key: `find:${x},${z}`, item, x, z });
  for (const s of scenery) {
    const chance = CHANCE[s.kind];
    if (!chance || hashUnit(s.x, s.z, seed + SALT) >= chance) continue;
    const [x, z] = [s.x + (s.w - 1) / 2, s.z + (s.d - 1) / 2]; // (its middle, under it: each a small one, reached from beside it)
    at(HERB_BY.includes(s.kind) ? RARE_HERB[countryAt(s.x, s.z)] : pick(CACHE, s.x, s.z, seed), x, z);
  }
  for (const ruin of ruins) {
    const altar = ruin.pieces.find((p) => p.kind === 'altar');
    if (!altar || hashUnit(altar.x, altar.z, seed + SALT + 2) >= ALTAR_CHANCE) continue;
    const [mx, mz] = [ruin.x + (ruin.w - 1) / 2, ruin.z + (ruin.d - 1) / 2];
    const d = Math.hypot(mx - altar.x, mz - altar.z) || 1;
    at(pick(OFFERING, altar.x, altar.z, seed), altar.x + ((mx - altar.x) / d) * 0.8, altar.z + ((mz - altar.z) / d) * 0.8); // (before it, toward the ruin's middle)
  }
  return finds;
}
