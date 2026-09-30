import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { VILLAGE_OUTER_RADIUS } from '../src/model/constants';
import { NEIGHBORS_4 } from '../src/model/map/grid';
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

describe('more dev cheats', () => {
  it('summons a wolf just ahead, and slays only foes nearby', async () => {
    const { spawnEnemyNear, slayNearby } = await import('../src/model/cheats');
    const model = fresh();
    const before = model.enemies.length;
    spawnEnemyNear(model, 'wolf');
    const wolf = model.enemies[model.enemies.length - 1];
    expect(model.enemies.length).toBe(before + 1);
    expect(Math.hypot(wolf.x - model.hero.x, wolf.z - model.hero.z)).toBeLessThan(5);
    const slain = slayNearby(model, 15);
    expect(slain).toBeGreaterThan(0);
    expect(model.enemies.filter((e) => e.state !== 'dead' && Math.hypot(e.x - model.hero.x, e.z - model.hero.z) <= 15)).toEqual([]);
  });

  it('tours the camps, nearest first, each once, landing on open ground at the gate', async () => {
    const { nextCamp } = await import('../src/model/cheats');
    const model = TEST_SEEDS.map((s) => fresh(s)).find((m) => m.camps.length > 1)!;
    const seen = new Set<(typeof model.camps)[number]>();
    for (let i = 0; i < model.camps.length; i++) {
      const tile = nextCamp(model, model.hero, seen)!;
      expect(model.isOpenTile(tile.x, tile.z)).toBe(true);
      expect(model.camps.some((c) => Math.hypot(c.way.x - tile.x, c.way.z - tile.z) <= 2)).toBe(true);
    }
    expect(seen.size).toBe(model.camps.length); // each once
    nextCamp(model, model.hero, seen);
    expect(seen.size).toBe(1); // then round again
  });

  it('noclip walks through anything; frozen foes stay put', () => {
    const model = fresh();
    const house = model.houses[0];
    model.teleport(house.x - 1, house.z);
    model.noclip = true;
    for (let i = 0; i < 30; i++) model.update(1, 0, 1 / 60);
    expect(model.hero.x).toBeGreaterThan(house.x - 0.5); // into the house tile

    model.noclip = false;
    model.enemiesFrozen = true;
    const enemy = model.enemies[0];
    model.teleport(Math.round(enemy.x) - 2, Math.round(enemy.z));
    const { x, z } = enemy;
    for (let i = 0; i < 60; i++) model.update(0, 0, 1 / 60);
    expect([enemy.x, enemy.z]).toEqual([x, z]);
  });
});
