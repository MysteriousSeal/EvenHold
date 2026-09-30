// Single entry point for world generation. Order matters: every step after
// createNoise2D draws from the same rng stream, so reordering steps changes
// what a given seed produces.

import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from '../../util/random';
import { LAKE_THRESHOLD_MIN, LAKE_THRESHOLD_MAX } from '../constants';
import { DEFAULT_MAP_SIZE, cellKey, spawnOf, type MapSize } from '../grid';
import type { Bush, Surface, World } from '../types';
import { generateHeightMap, smoothHeightMap } from './terrain';
import { generateLakeMap } from './lakes';
import { generateVillages } from './villages';
import { generateSpawnTrail } from './trails';
import { createForestDensity, generateTrees } from './trees';
import { generateBushes } from './bushes';
import { generateFields } from './fields';
import { createMeadowDensity } from './meadows';
import { placeRuins } from '../ruins/ruins';
import { placeCamps } from '../camps/camps';

// Tiles nothing can walk through or grow on: houses, the inn and smithy,
// village wells, and (when given) bushes.
export function solidCells(world: Pick<World, 'houses' | 'buildings' | 'villages'>, bushes: Bush[] = []): Set<string> {
  return new Set([
    ...world.houses.map((h) => cellKey(h.x, h.z)),
    ...world.buildings.flatMap((b) => b.tiles.map(([x, z]) => cellKey(x, z))),
    ...world.villages.map((v) => cellKey(v.x, v.z)),
    ...bushes.map((b) => cellKey(b.x, b.z)),
  ]);
}

export function generateWorld(seed: number, size: MapSize = DEFAULT_MAP_SIZE): World {
  const spawn = spawnOf(size);
  const rng = mulberry32(seed);
  const noise2D = createNoise2D(rng);

  // How lake-prone this particular world is — some seeds are dotted with
  // lakes, others are nearly dry.
  const lakeThreshold = LAKE_THRESHOLD_MIN + rng() * (LAKE_THRESHOLD_MAX - LAKE_THRESHOLD_MIN);

  const heightMap = generateHeightMap(noise2D, size);
  smoothHeightMap(heightMap);

  const lakeMap = generateLakeMap(heightMap, noise2D, lakeThreshold, spawn.x, spawn.z);
  const surfaceMap: Surface[][] = heightMap.map((row) => row.map((): Surface => 'natural'));

  const { villages, houses, buildings } = generateVillages(heightMap, lakeMap, surfaceMap, rng, spawn.x, spawn.z);
  const solid = solidCells({ houses, buildings, villages });
  const spawnTrail = generateSpawnTrail({ heightMap, lakeMap, surfaceMap, solidCells: solid }, villages, spawn.x, spawn.z);
  const fields = generateFields(heightMap, lakeMap, surfaceMap, solid, villages);
  // Ruins in the wilds, and the bandits' camps; the trees and bushes that
  // would stand on them (or right up to their walls) cleared away after
  // (grown as ever, so the rest of the world's the same).
  const cleared = new Set<string>();
  const isOpenTile = (x: number, z: number) => !lakeMap[x][z] && !solid.has(cellKey(x, z)) && !cleared.has(cellKey(x, z)); // (dry, clear of buildings and of what's placed before)
  const ruins = placeRuins({ seed, size, heightMap, surfaceMap, villages, isOpenTile });
  const clear = (x0: number, z0: number, x1: number, z1: number) => {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) cleared.add(cellKey(x, z));
  };
  for (const r of ruins) clear(r.x - 1, r.z - 1, r.x + r.w, r.z + r.d);
  // The bandits' camps likewise (clear of the ruins).
  const forest = createForestDensity(seed);
  const camps = placeCamps({ seed, size, heightMap, surfaceMap, villages, forest, isOpenTile });
  for (const c of camps) clear(c.x - 3, c.z - 3, c.x + 3, c.z + 3);
  const grown = generateTrees(heightMap, lakeMap, surfaceMap, solid, rng, forest, spawn.x, spawn.z);
  const trees = grown.filter((t) => !cleared.has(cellKey(Math.round(t.x), Math.round(t.z))));
  const meadowDensity = createMeadowDensity(seed);
  const bushes = generateBushes(heightMap, lakeMap, surfaceMap, solid, grown, meadowDensity, spawn.x, spawn.z).filter((b) => !cleared.has(cellKey(b.x, b.z)));

  return { size, heightMap, lakeMap, surfaceMap, trails: spawnTrail ? [spawnTrail] : [], villages, houses, buildings, fields, ruins, camps, trees, bushes };
}
