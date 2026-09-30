// Worlds kept in the browser (controller/worldCache.ts): packed and unpacked,
// they're the same world to the last tile and tree; and kept under the code's fingerprint.
import { describe, expect, it } from 'vitest';
import { WORLD_VERSION, loadWorld, packWorld, unpackWorld } from '../src/controller/worldCache';
import { generateWorld } from '../src/model/worldgen/world';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { worldPrint } from './support/worldPrint';

describe('a kept world', () => {
  it.each(TEST_SEEDS.map((s) => [s]))('seed %i: unpacks to the very world packed', (seed) => {
    const world = generateWorld(seed, TEST_MAP_SIZE);
    const packed = packWorld(world);
    expect(packed.tiles.length).toBe(TEST_MAP_SIZE.width * TEST_MAP_SIZE.depth);
    expect(worldPrint(unpackWorld(packed))).toBe(worldPrint(world));
  });

  it('unpacks a full-size world the same, a tile a byte', () => {
    const world = generateWorld(1275139863);
    const packed = packWorld(world);
    expect(packed.tiles.byteLength).toBe(world.size.width * world.size.depth);
    expect(worldPrint(unpackWorld(packed))).toBe(worldPrint(world));
  }, 60_000);

  it('makes the same game as a world made afresh', () => {
    const seed = TEST_SEEDS[2];
    const [made, kept] = [new GameModel(seed, TEST_MAP_SIZE), new GameModel(seed, TEST_MAP_SIZE, unpackWorld(packWorld(generateWorld(seed, TEST_MAP_SIZE))))];
    expect(kept.enemies.map((e) => [e.id, e.x, e.z])).toEqual(made.enemies.map((e) => [e.id, e.x, e.z]));
    expect(kept.npcs.map((n) => n.name)).toEqual(made.npcs.map((n) => n.name));
    expect(kept.wildlife.length).toBe(made.wildlife.length);
  });

  it('is kept under a fingerprint of the code that makes worlds', () => {
    expect(WORLD_VERSION).toMatch(/^[0-9a-f]+$/);
    expect(packWorld(generateWorld(1, TEST_MAP_SIZE)).version).toBe(WORLD_VERSION);
  });

  it('is simply not there where the browser keeps nothing (no IndexedDB)', async () => {
    expect(await loadWorld(1, TEST_MAP_SIZE)).toBeNull();
  });
});
