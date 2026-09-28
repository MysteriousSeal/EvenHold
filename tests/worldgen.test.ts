// Invariants that have each broken at least once during development. Run on
// small test worlds (see support/testWorld.ts); each check gathers every
// offending tile and asserts once, so failures list what's wrong and the
// suite doesn't pay for an assertion per tile.

import { describe, it, expect } from 'vitest';
import { generateWorld } from '../src/model/worldgen/world';
import { WATER_LEVEL, MIN_LAKE_SIZE } from '../src/model/constants';
import { NEIGHBORS_4, inBounds, cellKey, spawnOf } from '../src/model/grid';
import type { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE, TEST_SEEDS, testModel } from './support/testWorld';

const worlds: Array<[number, GameModel]> = TEST_SEEDS.map((seed) => [seed, testModel(seed)]);
const spawn = spawnOf(TEST_MAP_SIZE);

function tiles(world: GameModel): Array<[number, number]> {
  const all: Array<[number, number]> = [];
  for (let x = 0; x < world.size.width; x++) for (let z = 0; z < world.size.depth; z++) all.push([x, z]);
  return all;
}

function lowGroundBasins(world: GameModel): Array<Array<[number, number]>> {
  const { heightMap, size } = world;
  const visited = heightMap.map((row) => row.map(() => false));
  const basins: Array<Array<[number, number]>> = [];
  for (const [x, z] of tiles(world)) {
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
        if (inBounds(size, nx, nz) && heightMap[nx][nz] <= WATER_LEVEL && !visited[nx][nz]) {
          visited[nx][nz] = true;
          stack.push([nx, nz]);
        }
      }
    }
    basins.push(basin);
  }
  return basins;
}

describe('world generation', () => {
  it('is deterministic for a given seed', () => {
    expect(generateWorld(42, TEST_MAP_SIZE)).toEqual(generateWorld(42, TEST_MAP_SIZE));
  });

  it('scales the village count with the map area', () => {
    const small = generateWorld(1, { width: 64, depth: 64 }).villages.length;
    const larger = generateWorld(1, { width: 128, depth: 128 }).villages.length;
    expect(larger).toBeGreaterThan(small);
  });

  it.each(worlds)('seed %i: no adjacent tiles differ by more than one tier (no pits or spikes)', (_, world) => {
    const cliffs = tiles(world).filter(([x, z]) =>
      NEIGHBORS_4.some(
        ([dx, dz]) => inBounds(world.size, x + dx, z + dz) && Math.abs(world.heightMap[x][z] - world.heightMap[x + dx][z + dz]) > 1,
      ),
    );
    expect(cliffs).toEqual([]);
  });

  it.each(worlds)('seed %i: every basin is fully flooded or fully dry, and lakes meet the minimum size', (_, world) => {
    const bad = lowGroundBasins(world).filter((basin) => {
      const wet = basin.filter(([x, z]) => world.lakeMap[x][z]).length;
      return (wet !== 0 && wet !== basin.length) || (wet > 0 && wet < MIN_LAKE_SIZE);
    });
    expect(bad.map((basin) => basin[0])).toEqual([]);
  });

  it.each(worlds)('seed %i: spawn is dry and unobstructed', (_, world) => {
    expect(world.lakeMap[spawn.x][spawn.z]).toBe(false);
    expect(world.houses.some((h) => h.x === spawn.x && h.z === spawn.z)).toBe(false);
    expect(world.trees.some((t) => t.x === spawn.x && t.z === spawn.z)).toBe(false);
  });

  it.each(worlds)('seed %i: has villages, and houses never sit on water, trees, or each other', (_, world) => {
    expect(world.houses.length).toBeGreaterThan(0);
    const treeCells = new Set(world.trees.map((t) => cellKey(t.x, t.z)));
    const houseCells = new Set<string>();
    const bad = world.houses.filter((house) => {
      const key = cellKey(house.x, house.z);
      const wrong =
        world.lakeMap[house.x][house.z] || treeCells.has(key) || houseCells.has(key) || world.heightMap[house.x][house.z] !== house.groundTier;
      houseCells.add(key);
      return wrong;
    });
    expect(bad).toEqual([]);
  });
});

describe('villages', () => {
  it.each(worlds)('seed %i: every door opens onto the square', (_, world) => {
    // Local -Z (the door side) rotated into world space.
    const bad = world.houses.filter((house) => {
      const frontX = house.x + Math.round(-Math.sin(house.rotationY));
      const frontZ = house.z + Math.round(-Math.cos(house.rotationY));
      return world.surfaceMap[frontX][frontZ] === 'natural';
    });
    expect(bad).toEqual([]);
  });

  it.each(worlds)('seed %i: houses never touch, not even diagonally', (_, world) => {
    const touching = world.houses.filter((a) =>
      world.houses.some((b) => a !== b && Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z)) <= 1),
    );
    expect(touching).toEqual([]);
  });

  it.each(worlds)('seed %i: each well stands at its village center, ringed by square tiles', (_, world) => {
    expect(world.villages.length).toBeGreaterThan(0);
    const bad = world.villages.filter(
      (village) =>
        NEIGHBORS_4.some(([dx, dz]) => world.surfaceMap[village.x + dx][village.z + dz] !== 'plaza') ||
        world.trees.some((t) => t.x === village.x && t.z === village.z),
    );
    expect(bad).toEqual([]);
  });

  it.each(worlds)('seed %i: paths avoid water, and trees avoid paths and squares', (_, world) => {
    expect(tiles(world).filter(([x, z]) => world.surfaceMap[x][z] !== 'natural' && world.lakeMap[x][z])).toEqual([]);
    expect(world.trees.filter((tree) => world.surfaceMap[tree.x][tree.z] !== 'natural')).toEqual([]);
  });

  it.each(worlds)('seed %i: a trail leads from spawn to a village square', (_, world) => {
    const seen = new Set<string>();
    const stack: Array<[number, number]> = [[spawn.x, spawn.z]];
    let reachedSquare = false;
    while (stack.length && !reachedSquare) {
      const [x, z] = stack.pop()!;
      if (seen.has(cellKey(x, z)) || world.surfaceMap[x][z] === 'natural') continue;
      seen.add(cellKey(x, z));
      reachedSquare = world.surfaceMap[x][z] === 'plaza';
      for (const [dx, dz] of NEIGHBORS_4) if (inBounds(world.size, x + dx, z + dz)) stack.push([x + dx, z + dz]);
    }
    expect(reachedSquare).toBe(true);
  });
});

describe('bushes', () => {
  it.each(worlds)('seed %i: only on open grass, never near spawn, and never blocking a trail', (_, world) => {
    expect(world.bushes.length).toBeGreaterThan(20);
    const taken = new Set([...world.houses, ...world.trees, ...world.villages].map((o) => cellKey(o.x, o.z)));
    const seen = new Set<string>();
    const bad = world.bushes.filter((bush) => {
      const key = cellKey(bush.x, bush.z);
      const wrong =
        world.lakeMap[bush.x][bush.z] ||
        world.surfaceMap[bush.x][bush.z] !== 'natural' || // so never on a trail or square
        taken.has(key) ||
        seen.has(key) ||
        Math.max(Math.abs(bush.x - spawn.x), Math.abs(bush.z - spawn.z)) <= 1 ||
        world.heightMap[bush.x][bush.z] !== bush.groundTier;
      seen.add(key);
      return wrong;
    });
    expect(bad).toEqual([]);
  });
});

describe('trees', () => {
  it('pines dominate high ground, oaks and birches the lowlands', () => {
    const all = worlds.flatMap(([, world]) => world.trees);
    const high = all.filter((t) => t.groundTier >= 3);
    const low = all.filter((t) => t.groundTier < 3);
    const share = (ts: typeof all, kind: string) => ts.filter((t) => t.kind === kind).length / ts.length;
    expect(share(high, 'pine')).toBeGreaterThan(0.6);
    expect(share(low, 'pine')).toBeLessThan(0.3);
    expect(share(low, 'birch')).toBeGreaterThan(0.1);
  });

  it('grows forests: some patches are far denser than open country', () => {
    // Tree share per 8x8 block, across the test worlds.
    const densities = worlds.flatMap(([, world]) => {
      const counts = new Map<string, number>();
      for (const t of world.trees) {
        const key = cellKey(Math.floor(t.x / 8), Math.floor(t.z / 8));
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts.values()].map((n) => n / 64);
    });
    expect(Math.max(...densities)).toBeGreaterThan(0.3);
    expect(Math.min(...densities)).toBeLessThan(0.1);
  });

  it.each(worlds)('seed %i: trees are rotated in quarter turns only', (_, world) => {
    expect(world.trees.filter((tree) => ![0, 1, 2, 3].includes(tree.quarterTurns))).toEqual([]);
  });
});
