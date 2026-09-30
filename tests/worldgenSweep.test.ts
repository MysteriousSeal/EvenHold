// The world as each test seed makes it, checked all over: heights, water,
// what covers the ground, trees and bushes, houses and buildings, fields,
// trails and villages; and the same world every time from the same seed.
import { describe, expect, it } from 'vitest';
import { MAX_TIER, VILLAGE_OUTER_RADIUS, WATER_LEVEL } from '../src/model/constants';
import { generateWorld } from '../src/model/worldgen/world';
import { fenceEdges } from '../src/model/worldgen/fields';
import { inBounds } from '../src/model/map/grid';
import { TEST_MAP_SIZE, TEST_SEEDS, testModel } from './support/testWorld';

const tiles = (size: { width: number; depth: number }) => Array.from({ length: size.width * size.depth }, (_, i) => [Math.floor(i / size.depth), i % size.depth] as const);

describe.each(TEST_SEEDS.map((s) => [s]))('seed %i', (seed) => {
  const world = testModel(seed);
  const { size, heightMap, lakeMap, surfaceMap } = world;
  const dry = (x: number, z: number) => inBounds(size, x, z) && !lakeMap[x][z];

  it('has whole heights, from the lowest tier to the highest', () => {
    for (const [x, z] of tiles(size)) expect(Number.isInteger(heightMap[x][z]) && heightMap[x][z] >= 0 && heightMap[x][z] <= MAX_TIER).toBe(true);
    expect(new Set(heightMap.flat()).size).toBeGreaterThan(1); // not flat
  });

  it('has water only on low ground, and some of it', () => {
    let wet = 0;
    for (const [x, z] of tiles(size)) {
      if (!lakeMap[x][z]) continue;
      wet++;
      expect(heightMap[x][z]).toBeLessThanOrEqual(WATER_LEVEL);
    }
    expect(wet).toBeGreaterThan(0);
  });

  it('paves and farms only dry ground', () => {
    for (const [x, z] of tiles(size)) if (surfaceMap[x][z] !== 'natural') expect(lakeMap[x][z]).toBe(false);
  });

  it('grows trees on dry, wild ground, one to a tile, at the ground\'s height', () => {
    const seen = new Set<string>();
    for (const tree of world.trees) {
      expect(dry(tree.x, tree.z)).toBe(true);
      expect(surfaceMap[tree.x][tree.z]).toBe('natural');
      expect(tree.groundTier).toBe(heightMap[tree.x][tree.z]);
      expect(seen.has(`${tree.x},${tree.z}`)).toBe(false);
      seen.add(`${tree.x},${tree.z}`);
    }
    expect(world.trees.length).toBeGreaterThan(20);
  });

  it('puts bushes on dry, wild ground, never under a tree nor two to a tile', () => {
    const trees = new Set(world.trees.map((t) => `${t.x},${t.z}`));
    const seen = new Set<string>();
    for (const bush of world.bushes) {
      const key = `${bush.x},${bush.z}`;
      expect(dry(bush.x, bush.z)).toBe(true);
      expect(surfaceMap[bush.x][bush.z]).toBe('natural');
      expect(trees.has(key)).toBe(false);
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('builds houses, the inn and the smithy on dry ground, none on another', () => {
    const taken = new Set<string>();
    const claim = (x: number, z: number) => {
      const key = `${x},${z}`;
      expect(taken.has(key)).toBe(false);
      taken.add(key);
      expect(dry(x, z)).toBe(true);
    };
    for (const house of world.houses) claim(house.x, house.z);
    for (const building of world.buildings) for (const [x, z] of building.tiles) claim(x, z);
    expect(world.buildings.filter((b) => b.kind === 'inn')).toHaveLength(world.villages.length);
  });

  it('lays each field out on the map, farmed, apart from the others, gated on its edge', () => {
    const farmed = new Set<string>();
    for (const field of world.fields) {
      for (let x = field.x0; x < field.x0 + field.width; x++) {
        for (let z = field.z0; z < field.z0 + field.depth; z++) {
          expect(surfaceMap[x][z]).toBe('field');
          expect(farmed.has(`${x},${z}`)).toBe(false);
          farmed.add(`${x},${z}`);
        }
      }
      const [gx, gz] = field.gate;
      const onEdge = gx === field.x0 || gx === field.x0 + field.width - 1 || gz === field.z0 || gz === field.z0 + field.depth - 1;
      expect(onEdge).toBe(true);
      expect(fenceEdges(field).some((e) => e.x === gx && e.z === gz)).toBe(false); // no fence at its gate
    }
  });

  it('runs every trail tile by tile, on dry, paved ground, to a village', () => {
    expect(world.trails.length).toBeGreaterThan(0);
    for (const trail of world.trails) {
      for (let i = 1; i < trail.length; i++) {
        const [[ax, az], [bx, bz]] = [trail[i - 1], trail[i]];
        expect(Math.max(Math.abs(ax - bx), Math.abs(az - bz))).toBe(1);
      }
      for (const [x, z] of trail) {
        expect(dry(x, z)).toBe(true);
        expect(['path', 'plaza']).toContain(surfaceMap[x][z]);
      }
      const [ex, ez] = trail[trail.length - 1];
      expect(Math.min(...world.villages.map((v) => Math.max(Math.abs(v.x - ex), Math.abs(v.z - ez))))).toBeLessThanOrEqual(VILLAGE_OUTER_RADIUS + 1);
    }
  });

  it('keeps its villages apart, each with its square paved and houses round it', () => {
    for (const [i, a] of world.villages.entries()) {
      expect(surfaceMap[a.x + 1][a.z]).toBe('plaza');
      expect(world.houses.some((h) => Math.hypot(h.x - a.x, h.z - a.z) < 12)).toBe(true);
      for (const b of world.villages.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(10);
    }
  });

  it('is the same world every time from the same seed', () => {
    const [a, b] = [generateWorld(seed, TEST_MAP_SIZE), generateWorld(seed, TEST_MAP_SIZE)];
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a.heightMap)).toBe(JSON.stringify(heightMap));
  });
});
