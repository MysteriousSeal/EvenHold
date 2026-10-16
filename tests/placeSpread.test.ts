// The places in the wilds, in proportion: the bandit camps a third of what they were, and more crypts (their ruins), caves
// and standing-stone rings in their room, so the rare finds aren't lost among the palisades.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';

describe('the places in the wilds', () => {
  it('are not all bandit camps: a few camps to each crypt or cave, several ruins and caves to a region, the same every time', () => {
    for (const seed of [7, 42]) {
      const model = new GameModel(seed, { width: 1024, depth: 1024 }); // (four regions' worth)
      const [camps, dungeons] = [model.camps.length, model.crypts.length + model.caves.length];
      expect(model.ruins.length, `seed ${seed}`).toBeGreaterThanOrEqual(8);
      expect(model.caves.length, `seed ${seed}`).toBeGreaterThanOrEqual(6);
      expect(camps, `seed ${seed}`).toBeLessThanOrEqual(dungeons * 8);
      expect(camps, `seed ${seed}`).toBeGreaterThan(dungeons); // (still the commonest)
      const again = new GameModel(seed, { width: 1024, depth: 1024 });
      expect([again.camps.length, again.ruins.length, again.caves.length]).toEqual([camps, model.ruins.length, model.caves.length]);
    }
  }, 300_000);
});
