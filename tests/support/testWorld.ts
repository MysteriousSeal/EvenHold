// Small worlds for tests. World generation cost grows with the map's area,
// and the production map will keep growing, so tests never generate it:
// they build complete worlds (terrain, lakes, villages, trails, trees) at a
// fixed small size instead, so the suite's run time stays flat however big
// the real map gets. Worlds are cached per seed within a test file.

import { GameModel } from '../../src/model/GameModel';
import type { MapSize } from '../../src/model/grid';

export const TEST_MAP_SIZE: MapSize = { width: 96, depth: 96 };

// Seeds whose test-sized worlds have everything the invariants look at:
// villages with a trail from spawn, lakes, forests and bushes.
export const TEST_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

const models = new Map<number, GameModel>();

export function testModel(seed: number): GameModel {
  let model = models.get(seed);
  if (!model) {
    model = new GameModel(seed, TEST_MAP_SIZE);
    models.set(seed, model);
  }
  return model;
}
