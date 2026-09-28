// Single entry point for world generation. Order matters: every step after
// createNoise2D draws from the same rng stream, so reordering steps changes
// what a given seed produces.

import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from '../../util/random';
import { LAKE_THRESHOLD_MIN, LAKE_THRESHOLD_MAX, SPAWN_X, SPAWN_Z } from '../constants';
import { cellKey } from '../grid';
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

export function generateWorld(seed: number): World {
  const rng = mulberry32(seed);
  const noise2D = createNoise2D(rng);

  // How lake-prone this particular world is — some seeds are dotted with
  // lakes, others are nearly dry.
  const lakeThreshold = LAKE_THRESHOLD_MIN + rng() * (LAKE_THRESHOLD_MAX - LAKE_THRESHOLD_MIN);

  const heightMap = generateHeightMap(noise2D);
  smoothHeightMap(heightMap);

  const lakeMap = generateLakeMap(heightMap, noise2D, lakeThreshold, SPAWN_X, SPAWN_Z);
  const surfaceMap: Surface[][] = heightMap.map((row) => row.map((): Surface => 'natural'));

  const { villages, houses } = generateVillages(heightMap, lakeMap, surfaceMap, rng, SPAWN_X, SPAWN_Z);
  const solid = solidCells(houses, villages);
  const spawnTrail = generateSpawnTrail({ heightMap, lakeMap, surfaceMap, solidCells: solid }, villages, SPAWN_X, SPAWN_Z);
  const trees = generateTrees(heightMap, lakeMap, surfaceMap, solid, rng, createForestDensity(seed), SPAWN_X, SPAWN_Z);
  const meadowDensity = createMeadowDensity(seed);
  const bushes = generateBushes(heightMap, lakeMap, surfaceMap, solid, trees, meadowDensity, SPAWN_X, SPAWN_Z);

  return { heightMap, lakeMap, surfaceMap, trails: spawnTrail ? [spawnTrail] : [], villages, houses, trees, bushes };
}
