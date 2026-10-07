// A save's foes put back where they were (save.ts restore): the hurt and the wandered as they stood; but one the save
// has farther from home than any leash lets a foe go is another world's foe of that number (the world since made
// afresh, its camps elsewhere), and is left as the seed makes it. (Such bandits, set down far off, walked home past
// their leash: never noticing the hero, healed whole at every blow.)
import { describe, expect, it } from 'vitest';
import { FOE_AT_MOST_FROM_HOME } from '../src/model/constants';
import { parseSave, restore, snapshot } from '../src/model/save';
import { fresh } from './support/testWorld';

describe('foes from a save', () => {
  it('stand where the save had them when that is near their home, and as the seed makes them when it is far', () => {
    const model = fresh();
    const [near, far] = model.enemies.filter((e) => e.kind === 'bandit');
    const data = snapshot(model);
    data.enemies.changed = [
      { id: near.id, x: near.homeX + 3, z: near.homeZ, hp: 1 },
      { id: far.id, x: far.homeX + FOE_AT_MOST_FROM_HOME + 20, z: far.homeZ, hp: 1 },
    ];
    const again = fresh();
    restore(again, parseSave(JSON.stringify(data), again.seed)!);
    const nearAgain = again.enemies.find((e) => e.id === near.id)!;
    const farAgain = again.enemies.find((e) => e.id === far.id)!;
    expect([nearAgain.x, nearAgain.hp]).toEqual([near.homeX + 3, 1]);
    expect(Math.hypot(farAgain.x - far.homeX, farAgain.z - far.homeZ)).toBeLessThan(FOE_AT_MOST_FROM_HOME); // (as made: at or about its home)
    expect(farAgain.hp).toBe(farAgain.maxHp);
  });
});
