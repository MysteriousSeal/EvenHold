// Invariants that have each broken at least once during development.

import { describe, it, expect } from 'vitest';
import { generateWorld } from '../src/model/worldgen/world';
import { MAP_WIDTH, MAP_DEPTH, WATER_LEVEL, MIN_LAKE_SIZE, SPAWN_X, SPAWN_Z } from '../src/model/constants';
import { NEIGHBORS_4, inBounds, cellKey } from '../src/model/grid';
import type { World } from '../src/model/types';

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const worlds: Array<[number, World]> = SEEDS.map((seed) => [seed, generateWorld(seed)]);

function lowGroundBasins(heightMap: number[][]): Array<Array<[number, number]>> {
  const visited = heightMap.map((row) => row.map(() => false));
  const basins: Array<Array<[number, number]>> = [];
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      if (heightMap[x][z] > WATER_LEVEL || visited[x][z]) continue;
      const basin: Array<[number, number]> = [];
      const stack: Array<[number, number]> = [[x, z]];
      visited[x][z] = true;
      while (stack.length) {
        const [cx, cz] = stack.pop()!;
        basin.push([cx, cz]);
        for (const [dx, dz] of NEIGHBORS_4) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (inBounds(nx, nz) && heightMap[nx][nz] <= WATER_LEVEL && !visited[nx][nz]) {
            visited[nx][nz] = true;
            stack.push([nx, nz]);
          }
        }
      }
      basins.push(basin);
    }
  }
  return basins;
}

describe('world generation', () => {
  it('is deterministic for a given seed', () => {
    expect(generateWorld(42)).toEqual(generateWorld(42));
  });

  it.each(worlds)('seed %i: no adjacent tiles differ by more than one tier (no pits or spikes)', (_, world) => {
    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let z = 0; z < MAP_DEPTH; z++) {
        for (const [dx, dz] of NEIGHBORS_4) {
          if (!inBounds(x + dx, z + dz)) continue;
          expect(Math.abs(world.heightMap[x][z] - world.heightMap[x + dx][z + dz])).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it.each(worlds)('seed %i: every basin is fully flooded or fully dry, and lakes meet the minimum size', (_, world) => {
    for (const basin of lowGroundBasins(world.heightMap)) {
      const wet = basin.filter(([x, z]) => world.lakeMap[x][z]).length;
      expect([0, basin.length]).toContain(wet);
      if (wet > 0) expect(wet).toBeGreaterThanOrEqual(MIN_LAKE_SIZE);
    }
  });

  it.each(worlds)('seed %i: spawn is dry and unobstructed', (_, world) => {
    expect(world.lakeMap[SPAWN_X][SPAWN_Z]).toBe(false);
    expect(world.houses.some((h) => h.x === SPAWN_X && h.z === SPAWN_Z)).toBe(false);
    expect(world.trees.some((t) => t.x === SPAWN_X && t.z === SPAWN_Z)).toBe(false);
  });

  it.each(worlds)('seed %i: has villages, and houses never sit on water, trees, or each other', (_, world) => {
    expect(world.houses.length).toBeGreaterThan(0);

    const treeCells = new Set(world.trees.map((t) => cellKey(t.x, t.z)));
    const houseCells = new Set<string>();
    for (const house of world.houses) {
      const key = cellKey(house.x, house.z);
      expect(world.lakeMap[house.x][house.z]).toBe(false);
      expect(treeCells.has(key)).toBe(false);
      expect(houseCells.has(key)).toBe(false);
      expect(world.heightMap[house.x][house.z]).toBe(house.groundHeight);
      houseCells.add(key);
    }
  });
});
