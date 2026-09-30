// Small worlds for tests. World generation cost grows with the map's area,
// and the production map will keep growing, so tests never generate it:
// they build complete worlds (terrain, lakes, villages, trails, trees) at a
// fixed small size instead, so the suite's run time stays flat however big
// the real map gets. Worlds are cached per seed within a test file.

import { GameModel } from '../../src/model/GameModel';
import { ATTACK_DURATION } from '../../src/model/constants';
import type { MapSize } from '../../src/model/grid';
import type { Enemy, EnemyKind } from '../../src/model/types';

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

export const FRAME = 1 / 60;

// A world of its own (not the cache's) to play in: the first test seed's.
export const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);

// The enemy of `kind` nearest the hero.
export const nearest = (model: GameModel, kind: EnemyKind = 'wolf'): Enemy =>
  model.enemies.filter((e) => e.kind === kind).reduce((a, b) => (Math.hypot(a.x - model.hero.x, a.z - model.hero.z) < Math.hypot(b.x - model.hero.x, b.z - model.hero.z) ? a : b));

// Strikes `enemy` down, the hero facing +X, holding it right in front of them before each blow.
export function slay(model: GameModel, enemy: Enemy): void {
  model.update(1, 0, 1e-6); // face +X
  for (let blow = 0; blow < enemy.maxHp && enemy.state !== 'dead'; blow++) {
    enemy.x = model.hero.x + 0.6;
    enemy.z = model.hero.z;
    model.startAttack();
    for (let t = 0; t < ATTACK_DURATION + FRAME; t += FRAME) model.update(0, 0, FRAME);
  }
}
