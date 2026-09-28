import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { VILLAGE_OUTER_RADIUS } from '../src/model/constants';
import { NEIGHBORS_4 } from '../src/model/grid';
import { nearestLakeShore, nextVillage, spawnTile, villageEntrance } from '../src/model/cheats';
import type { Village } from '../src/model/types';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// Teleports move the hero, so each test gets its own world.
const fresh = (seed = TEST_SEEDS[0]) => new GameModel(seed, TEST_MAP_SIZE);

describe('dev cheats', () => {
  it('tours every village nearest-first, then starts over', () => {
    const model = fresh();
    const visited = new Set<Village>();
    const tour: Village[] = [];
    for (let i = 0; i < model.villages.length; i++) {
      const village = nextVillage(model, model.hero, visited)!;
      tour.push(village);
      const entrance = villageEntrance(model, village, model.hero);
      model.teleport(entrance.x, entrance.z);
    }
    expect(new Set(tour).size).toBe(model.villages.length);
    const first = nextVillage(model, model.hero, visited);
    expect(first).not.toBeNull();
    expect(visited.size).toBe(1); // the tour restarted
  });

  it.each(TEST_SEEDS)('seed %i: every village entrance is open ground just outside its square', (seed) => {
    const model = fresh(seed);
    for (const village of model.villages) {
      const entrance = villageEntrance(model, village, model.hero);
      const ring = Math.max(Math.abs(entrance.x - village.x), Math.abs(entrance.z - village.z));
      expect(model.isOpenTile(entrance.x, entrance.z)).toBe(true);
      expect(ring).toBeGreaterThan(VILLAGE_OUTER_RADIUS);
      expect(ring).toBeLessThanOrEqual(VILLAGE_OUTER_RADIUS + 3);
    }
  });

  it('arrives on the trail where it reaches the square', () => {
    const model = fresh();
    const route = model.trails[0];
    const [endX, endZ] = route[route.length - 1];
    const village = model.villages.reduce((a, b) => (Math.hypot(a.x - endX, a.z - endZ) < Math.hypot(b.x - endX, b.z - endZ) ? a : b));
    const entrance = villageEntrance(model, village, model.hero);
    expect(model.surfaceMap[entrance.x][entrance.z]).toBe('path');
  });

  it('finds the nearest lake shore: open ground next to water', () => {
    const seed = TEST_SEEDS.find((s) => fresh(s).lakeMap.flat().some(Boolean))!;
    const model = fresh(seed);
    const shore = nearestLakeShore(model, model.hero)!;
    expect(model.isOpenTile(shore.x, shore.z)).toBe(true);
    expect(NEIGHBORS_4.some(([dx, dz]) => model.lakeMap[shore.x + dx]?.[shore.z + dz])).toBe(true);
  });

  it('teleports onto the ground and back to spawn', () => {
    const model = fresh();
    const village = model.villages[0];
    const entrance = villageEntrance(model, village, model.hero);
    model.teleport(entrance.x, entrance.z);
    expect(model.hero.y).toBeCloseTo(model.getGroundY(entrance.x, entrance.z), 10);
    const spawn = spawnTile(model);
    model.teleport(spawn.x, spawn.z);
    expect([model.hero.x, model.hero.z]).toEqual([spawn.x, spawn.z]);
  });

  it('speeds the hero up', () => {
    const walk = (multiplier: number) => {
      const model = fresh();
      model.speedMultiplier = multiplier;
      const start = model.hero.z;
      model.update(0, 1, 1 / 60);
      return Math.abs(model.hero.z - start);
    };
    expect(walk(3)).toBeCloseTo(walk(1) * 3, 5);
  });
});
