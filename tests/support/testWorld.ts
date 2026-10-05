// Small worlds for tests. World generation cost grows with the map's area,
// and the production map will keep growing, so tests never generate it:
// they build complete worlds (terrain, lakes, villages, trails, trees) at a
// fixed small size instead, so the suite's run time stays flat however big
// the real map gets. Worlds are cached per seed within a test file.

import { GameModel } from '../../src/model/GameModel';
import { ATTACK_DURATION } from '../../src/model/constants';
import type { MapSize } from '../../src/model/map/grid';
import type { Enemy, EnemyKind, Surface } from '../../src/model/types';

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

// Runs `check` in a fresh world of every test seed, saying which seed when it fails.
// The hero put two tiles from `wolf`, on whichever side has a clear view of it (trees and houses about it), still.
export function inSightOf(model: GameModel, wolf: Enemy, away = 2): void {
  const director = (model as unknown as { director: { inView(a: { x: number; z: number }, b: { x: number; z: number }): boolean } }).director;
  for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    model.teleport(Math.round(wolf.x) + dx * away, Math.round(wolf.z) + dz * away);
    if (model.isOpenTile(Math.round(model.hero.x), Math.round(model.hero.z)) && director.inView(model.hero, wolf)) return;
  }
}

// No travellers on the roads (a test of the foes and the hero alone: none to go after instead).
export const noTravellers = (model: GameModel): GameModel => (model.travellers.list.splice(0), model);

export function eachSeed(check: (model: GameModel, seed: number) => void): void {
  for (const seed of TEST_SEEDS) {
    try {
      check(new GameModel(seed, TEST_MAP_SIZE), seed);
    } catch (error) {
      if (error instanceof Error) error.message = `seed ${seed}: ${error.message}`;
      throw error;
    }
  }
}

// A model's tiles as whole maps ([x][z]), for tests that sweep the world as it was made (small worlds only: the
// game reads tiles where they are, model/map/tiles.ts).
const mapsMade = new WeakMap<GameModel, { heightMap: number[][]; lakeMap: boolean[][]; surfaceMap: Surface[][] }>();
export function mapsOf(model: GameModel): { heightMap: number[][]; lakeMap: boolean[][]; surfaceMap: Surface[][] } {
  let maps = mapsMade.get(model);
  if (!maps) {
    const { width, depth } = model.size;
    const grid = <T>(at: (x: number, z: number) => T) => Array.from({ length: width }, (_, x) => Array.from({ length: depth }, (_, z) => at(x, z)));
    maps = { heightMap: grid((x, z) => model.tiles.height(x, z)), lakeMap: grid((x, z) => model.tiles.lake(x, z)), surfaceMap: grid((x, z) => model.tiles.surface(x, z)) };
    mapsMade.set(model, maps);
  }
  return maps;
}
