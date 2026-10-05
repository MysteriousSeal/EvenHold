// Every world is made exactly as before, to the last tile and tree: the
// fingerprints (support/worldPrint.ts) of the test worlds, and of a full-size
// one (where things turn up that small maps miss), as they were. A change here
// means every world (and every save's) changes: meant, it's these to update;
// meant to speed things up only, it's a bug. The full-size world, slow to
// make, made once: kept and unpacked (controller/storage/worldCache.ts) it's
// the same world too, a tile a byte.
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/model/worldgen/world';
import { packWorld, unpackWorld } from '../src/controller/storage/worldCache';
import type { World } from '../src/model/types';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { worldPrint } from './support/worldPrint';

const TEST_WORLDS = ['550ae547', 'e0eb7ac4', '9ced4f62', '528cf80d', '2ac14425', '25051238', '47d032de', '219a5e78']; // (since six tree shapes a kind, not three: each tree's shape of six)

describe('worlds made as ever', () => {
  it.each(TEST_SEEDS.map((seed, i) => [seed, TEST_WORLDS[i]]))('seed %i (test size)', (seed, print) => {
    expect(worldPrint(generateWorld(seed, TEST_MAP_SIZE))).toBe(print);
  });

  const FULL = '4b1ecf76';
  let full: World | null = null;
  const fullWorld = () => (full ??= generateWorld(1275139863));

  it('a full-size world', () => {
    expect(worldPrint(fullWorld())).toBe(FULL);
  }, 60_000);

  it('a full-size world, kept and unpacked: the same, a tile a byte', () => {
    const packed = packWorld(fullWorld());
    expect(packed.tiles.byteLength).toBe(fullWorld().size.width * fullWorld().size.depth);
    expect(worldPrint(unpackWorld(packed))).toBe(FULL);
  }, 60_000);
});
