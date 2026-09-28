// Single entry point for world generation. Order matters: every step after
// createNoise2D draws from the same rng stream, so reordering steps changes
// what a given seed produces.

import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from '../../util/random';
import { LAKE_THRESHOLD_MIN, LAKE_THRESHOLD_MAX } from '../constants';
import { DEFAULT_MAP_SIZE, cellKey, spawnOf, type MapSize } from '../grid';
import type { Bush, House, Surface, Village, World } from '../types';
import { generateHeightMap, smoothHeightMap } from './terrain';
import { generateLakeMap } from './lakes';
import { generateVillages } from './villages';
import { generateSpawnTrail } from './trails';
import { createForestDensity, generateTrees } from './trees';
import { generateBushes } from './bushes';
import { createMeadowDensity } from './meadows';

// Tiles nothing can walk through or grow on: houses, village wells, bushes.
export function solidCells(houses: House[], villages: Village[], bushes: Bush[] = []): Set<string> {
  return new Set([
    ...houses.map((h) => cellKey(h.x, h.z)),
    ...villages.map((v) => cellKey(v.x, v.z)),
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

  const { villages, houses } = generateVillages(heightMap, lakeMap, surfaceMap, rng, spawn.x, spawn.z);
  const solid = solidCells(houses, villages);
  const spawnTrail = generateSpawnTrail({ heightMap, lakeMap, surfaceMap, solidCells: solid }, villages, spawn.x, spawn.z);
  const trees = generateTrees(heightMap, lakeMap, surfaceMap, solid, rng, createForestDensity(seed), spawn.x, spawn.z);
  const meadowDensity = createMeadowDensity(seed);
  const bushes = generateBushes(heightMap, lakeMap, surfaceMap, solid, trees, meadowDensity, spawn.x, spawn.z);

  return { size, heightMap, lakeMap, surfaceMap, trails: spawnTrail ? [spawnTrail] : [], villages, houses, trees, bushes };
}
