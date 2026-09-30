// Worlds kept in the browser (controller/storage/worldCache.ts): packed and unpacked,
// they're the same world to the last tile and tree; and kept under the code's fingerprint.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { worldVersion } from '../vite.config';
import { WORLD_VERSION, keepWorld, loadWorld, packWorld, unpackWorld } from '../src/controller/storage/worldCache';
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

  it('is kept under a fingerprint of the code that makes worlds, the built game\'s the same as while developing', () => {
    expect(WORLD_VERSION).toMatch(/^[0-9a-f]+$/);
    expect(worldVersion()).toBe(WORLD_VERSION); // (vite.config.ts works it out for the built game: the same files, the same way)
    expect(packWorld(generateWorld(1, TEST_MAP_SIZE)).version).toBe(WORLD_VERSION);
  });

  it('is simply not there where the browser keeps nothing (no IndexedDB)', async () => {
    expect(await loadWorld(1, TEST_MAP_SIZE)).toBeNull();
  });
});

describe('worlds kept in the browser', () => {
  // A stand-in for the browser's IndexedDB, fresh for each test.
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    vi.useFakeTimers({ toFake: ['Date'] }); // (the date only: the stand-in keeps its own timers going)
  });
  afterEach(() => vi.useRealTimers());
  const at = (ms: number) => vi.setSystemTime(ms);
  const small = (seed: number) => generateWorld(seed, TEST_MAP_SIZE);

  it('come back the very world kept, and none for a seed never kept', async () => {
    const world = small(1);
    await keepWorld(1, TEST_MAP_SIZE, world);
    expect(worldPrint((await loadWorld(1, TEST_MAP_SIZE))!)).toBe(worldPrint(world));
    expect(await loadWorld(2, TEST_MAP_SIZE)).toBeNull();
    expect(await loadWorld(1, { width: 64, depth: 64 })).toBeNull(); // (another size: another world)
  });

  it('are not used once the code that makes worlds has changed', async () => {
    await keepWorld(1, TEST_MAP_SIZE, small(1));
    const db = await new Promise<IDBDatabase>((resolve) => (indexedDB.open('evenhold', 2).onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)));
    await new Promise((resolve) => (db.transaction('kept', 'readwrite').objectStore('kept').put({ version: 'older', at: 1 }, `1:${TEST_MAP_SIZE.width}x${TEST_MAP_SIZE.depth}`).onsuccess = resolve));
    db.close();
    expect(await loadWorld(1, TEST_MAP_SIZE)).toBeNull();
  });

  it('are the last three played only, the least lately played dropped (playing one counts)', async () => {
    const worlds = [1, 2, 3, 4].map(small);
    at(1000);
    await keepWorld(1, TEST_MAP_SIZE, worlds[0]);
    at(2000);
    await keepWorld(2, TEST_MAP_SIZE, worlds[1]);
    at(3000);
    await keepWorld(3, TEST_MAP_SIZE, worlds[2]);
    at(4000);
    expect(await loadWorld(1, TEST_MAP_SIZE)).not.toBeNull(); // world 1 played again: now the latest
    at(5000);
    await keepWorld(4, TEST_MAP_SIZE, worlds[3]);
    expect(await loadWorld(2, TEST_MAP_SIZE)).toBeNull(); // the least lately played, dropped
    for (const seed of [1, 3, 4]) expect(await loadWorld(seed, TEST_MAP_SIZE), `world ${seed}`).not.toBeNull();
  });

  it('kept before the notes were (the first way of keeping them) are dropped, to be made again', async () => {
    const old = await new Promise<IDBDatabase>((resolve) => {
      const request = indexedDB.open('evenhold', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('worlds');
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise((resolve) => (old.transaction('worlds', 'readwrite').objectStore('worlds').put({ packed: packWorld(small(1)), at: 1 }, `1:${TEST_MAP_SIZE.width}x${TEST_MAP_SIZE.depth}`).onsuccess = resolve));
    old.close();
    expect(await loadWorld(1, TEST_MAP_SIZE)).toBeNull();
    const db = await new Promise<IDBDatabase>((resolve) => (indexedDB.open('evenhold', 2).onsuccess = (e) => resolve((e.target as IDBOpenDBRequest).result)));
    const left = await new Promise<number>((resolve) => {
      const r = db.transaction('worlds').objectStore('worlds').count();
      r.onsuccess = () => resolve(r.result);
    });
    db.close();
    expect(left).toBe(0);
  });
});
