// The first morning (npcs/npcRoutine.ts: wakeVillagers): a new game begins at 8:00 with the village already about its
// day, folk out on the square and in the fields, not all at home only now stepping out of their doors; the clock
// where it was, and those out standing somewhere free (or on a doorstep).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { wakeVillagers } from '../src/model/npcs/npcRoutine';
import { START_MINUTES } from '../src/model/clock';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

describe('the first morning', () => {
  it('has the villagers near the hero out and about from the start, on every test seed', () => {
    for (const seed of TEST_SEEDS) {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const folk = model.folk.filter((n) => n.role === 'villager');
      expect(folk.filter((n) => !n.where), `seed ${seed}, unwoken`).toHaveLength(0); // (as it was: every one at home)
      wakeVillagers(model.folk, model);
      const out = folk.filter((n) => !n.where);
      expect(out.length / folk.length, `seed ${seed}: ${out.length} of ${folk.length} out`).toBeGreaterThanOrEqual(0.5);
      expect(model.minutes).toBe(START_MINUTES);
      for (const n of out.filter((v) => !v.seat && !model.entrances.some((e) => e.x === v.x && e.z === v.z))) expect(model.isBlocked(n.x, n.z, 0.2), `seed ${seed}: ${n.name} at ${n.x},${n.z}`).toBe(false);
      for (let k = 0; k < 50; k++) model.update(0, 0, 0.1); // (and their day goes on from there)
    }
  });
});
