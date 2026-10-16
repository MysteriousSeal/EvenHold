// A wanderer never steps out past the farthest spot it picks round home (enemies.ts strays): a shove apart or a sidestep
// can't creep it out bit by bit; back toward home, and any step while chasing, always allowed.
import { describe, expect, it } from 'vitest';
import { makeEnemy, strays } from '../src/model/enemies/enemies';
import { ENEMY_STATS } from '../src/model/constants';

describe('a wanderer\'s leash', () => {
  it('refuses a step out past its reach, never one back in nor one while chasing', () => {
    const foe = makeEnemy(1, 'skeleton', 10, 10);
    const reach = ENEMY_STATS.skeleton.wander * Math.SQRT2;
    expect(strays(foe, 0.2, 0)).toBe(false); // (well inside)
    Object.assign(foe, { x: 10 + reach - 0.01 });
    expect(strays(foe, 0.05, 0)).toBe(true); // (out past it)
    expect(strays(foe, 0, 0.05)).toBe(false); // (along it: hardly further out, still within)
    Object.assign(foe, { x: 10 + reach + 0.5 });
    expect(strays(foe, -0.05, 0)).toBe(false); // (beyond it already, after a chase: home again)
    expect(strays({ ...foe, state: 'chase' }, 0.05, 0)).toBe(false);
  });
});
