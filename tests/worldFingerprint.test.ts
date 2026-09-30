// Every world is made exactly as before, to the last tile and tree: the
// fingerprints (support/worldPrint.ts) of the test worlds, and of a full-size
// one (where things turn up that small maps miss), as they were. A change here
// means every world (and every save's) changes: meant, it's these to update;
// meant to speed things up only, it's a bug.
import { describe, expect, it } from 'vitest';
import { generateWorld } from '../src/model/worldgen/world';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { worldPrint } from './support/worldPrint';

const TEST_WORLDS = ['6aae06ba', 'da240a90', 'a54bf2fe', '4230077', 'bdef728', 'fc3ad22', '73900249', '83cefa43'];

describe('worlds made as ever', () => {
  it.each(TEST_SEEDS.map((seed, i) => [seed, TEST_WORLDS[i]]))('seed %i (test size)', (seed, print) => {
    expect(worldPrint(generateWorld(seed, TEST_MAP_SIZE))).toBe(print);
  });

  it('a full-size world', () => {
    expect(worldPrint(generateWorld(1275139863))).toBe('b4f77169');
  }, 60_000);
});
