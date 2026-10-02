// Every world is made exactly as before, to the last tile and tree: the
// fingerprints (support/worldPrint.ts) of the test worlds, and of a full-size
// one (where things turn up that small maps miss), as they were. A change here
// means every world (and every save's) changes: meant, it's these to update;
// meant to speed things up only, it's a bug.
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/model/worldgen/world';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { worldPrint } from './support/worldPrint';

const TEST_WORLDS = ['e2f132c9', '6c8b99aa', 'f1a7123c', 'c03299f1', '5ff1ae82', '7ac14a33', 'c3eb81d6', 'a0b79b59']; // (since the roads between the villages)

describe('worlds made as ever', () => {
  it.each(TEST_SEEDS.map((seed, i) => [seed, TEST_WORLDS[i]]))('seed %i (test size)', (seed, print) => {
    expect(worldPrint(generateWorld(seed, TEST_MAP_SIZE))).toBe(print);
  });

  it('a full-size world', () => {
    expect(worldPrint(generateWorld(1275139863))).toBe('26f5c181');
  }, 60_000);
});
