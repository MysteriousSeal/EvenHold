// A crypt's stairs open onto floor straight ahead (cryptLayout.ts): the hero, come down, faces the way on, not a wall
// a step off; over three hundred crypts.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/util/random';
import { planCrypt } from '../src/model/crypts/cryptLayout';
import { isFloor } from '../src/model/dungeons/floorPlan';

const AHEAD = 5; // tiles of floor straight on from the foot of the stairs, at the least

describe("a crypt's stairs", () => {
  it(`open onto at least ${AHEAD} tiles of floor straight ahead (300 crypts)`, () => {
    const rng = mulberry32(5150);
    const walled: string[] = [];
    for (let i = 0; i < 300; i++) {
      const [seed, ruin] = [Math.floor(rng() * 2 ** 31), { x: Math.floor(rng() * 16384), z: Math.floor(rng() * 16384) }];
      const plan = planCrypt(seed, ruin);
      for (let k = 1; k <= AHEAD; k++) if (!isFloor(plan, plan.door, plan.depth - k)) (walled.push(`seed ${seed} ruin ${ruin.x},${ruin.z}: rock ${k} ahead`), (k = AHEAD));
    }
    expect(walled).toEqual([]);
  });
});
