// Single entry point for world generation. Order matters: every step after
// createNoise2D draws from the same rng stream, so reordering steps changes
// what a given seed produces.

import { createNoise2D } from 'simplex-noise';
import { mulberry32 } from '../../util/random';
import { LAKE_THRESHOLD_MIN, LAKE_THRESHOLD_MAX, SPAWN_X, SPAWN_Z } from '../constants';
import { cellKey } from '../grid';
import type { World } from '../types';
import { generateHeightMap, smoothHeightMap } from './terrain';
import { generateLakeMap } from './lakes';
import { generateVillages } from './villages';
import { generateTrees } from './trees';

export function generateWorld(seed: number): World {
  const rng = mulberry32(seed);
  const noise2D = createNoise2D(rng);

  // How lake-prone this particular world is — some seeds are dotted with
  // lakes, others are nearly dry.
  const lakeThreshold = LAKE_THRESHOLD_MIN + rng() * (LAKE_THRESHOLD_MAX - LAKE_THRESHOLD_MIN);

  const heightMap = generateHeightMap(noise2D);
  smoothHeightMap(heightMap);

  const lakeMap = generateLakeMap(heightMap, noise2D, lakeThreshold, SPAWN_X, SPAWN_Z);
  const houses = generateVillages(heightMap, lakeMap, rng, SPAWN_X, SPAWN_Z);
  const houseCells = new Set(houses.map((house) => cellKey(house.x, house.z)));
  const trees = generateTrees(heightMap, lakeMap, houseCells, rng, SPAWN_X, SPAWN_Z);

  return { heightMap, lakeMap, houses, trees };
}
