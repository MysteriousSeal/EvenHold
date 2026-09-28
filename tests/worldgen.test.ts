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
      expect(world.heightMap[house.x][house.z]).toBe(house.groundTier);
      houseCells.add(key);
    }
  });
});

describe('villages', () => {
  it.each(worlds)('seed %i: every door opens onto the square', (_, world) => {
    for (const house of world.houses) {
      // Local -Z (the door side) rotated into world space.
      const frontX = house.x + Math.round(-Math.sin(house.rotationY));
      const frontZ = house.z + Math.round(-Math.cos(house.rotationY));
      expect(world.surfaceMap[frontX][frontZ]).not.toBe('natural');
    }
  });

  it.each(worlds)('seed %i: houses never touch, not even diagonally', (_, world) => {
    for (const a of world.houses) {
      for (const b of world.houses) {
        if (a !== b) expect(Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z))).toBeGreaterThan(1);
      }
    }
  });

  it.each(worlds)('seed %i: each well stands at its village center, ringed by square tiles', (_, world) => {
    expect(world.villages.length).toBeGreaterThan(0);
    for (const village of world.villages) {
      for (const [dx, dz] of NEIGHBORS_4) {
        expect(world.surfaceMap[village.x + dx][village.z + dz]).toBe('plaza');
      }
      expect(world.trees.some((t) => t.x === village.x && t.z === village.z)).toBe(false);
    }
  });

  it.each(worlds)('seed %i: paths avoid water, and trees avoid paths and squares', (_, world) => {
    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let z = 0; z < MAP_DEPTH; z++) {
        if (world.surfaceMap[x][z] !== 'natural') expect(world.lakeMap[x][z]).toBe(false);
      }
    }
    for (const tree of world.trees) expect(world.surfaceMap[tree.x][tree.z]).toBe('natural');
  });

  it.each(worlds)('seed %i: a trail leads from spawn to a village square', (_, world) => {
    const seen = new Set<string>();
    const stack: Array<[number, number]> = [[SPAWN_X, SPAWN_Z]];
    let reachedSquare = false;
    while (stack.length && !reachedSquare) {
      const [x, z] = stack.pop()!;
      if (seen.has(cellKey(x, z)) || world.surfaceMap[x][z] === 'natural') continue;
      seen.add(cellKey(x, z));
      reachedSquare = world.surfaceMap[x][z] === 'plaza';
      for (const [dx, dz] of NEIGHBORS_4) if (inBounds(x + dx, z + dz)) stack.push([x + dx, z + dz]);
    }
    expect(reachedSquare).toBe(true);
  });
});

describe('bushes', () => {
  it.each(worlds)('seed %i: only on open grass, never near spawn, and never blocking a trail', (_, world) => {
    expect(world.bushes.length).toBeGreaterThan(20);
    const taken = new Set([...world.houses, ...world.trees, ...world.villages].map((o) => cellKey(o.x, o.z)));
    const seen = new Set<string>();
    for (const bush of world.bushes) {
      const key = cellKey(bush.x, bush.z);
      expect(world.lakeMap[bush.x][bush.z]).toBe(false);
      expect(world.surfaceMap[bush.x][bush.z]).toBe('natural'); // so never on a trail or square
      expect(taken.has(key)).toBe(false);
      expect(seen.has(key)).toBe(false);
      expect(Math.max(Math.abs(bush.x - SPAWN_X), Math.abs(bush.z - SPAWN_Z))).toBeGreaterThan(1);
      expect(world.heightMap[bush.x][bush.z]).toBe(bush.groundTier);
      seen.add(key);
    }
  });
});

describe('trees', () => {
  it('pines dominate high ground, oaks the lowlands', () => {
    const all = worlds.flatMap(([, world]) => world.trees);
    const high = all.filter((t) => t.groundTier >= 3);
    const low = all.filter((t) => t.groundTier < 3);
    const pineShare = (ts: typeof all) => ts.filter((t) => t.kind === 'pine').length / ts.length;
    expect(pineShare(high)).toBeGreaterThan(0.6);
    expect(pineShare(low)).toBeLessThan(0.3);
  });

  it.each(worlds)('seed %i: trees are rotated in quarter turns only', (_, world) => {
    for (const tree of world.trees) expect([0, 1, 2, 3]).toContain(tree.quarterTurns);
  });
});
