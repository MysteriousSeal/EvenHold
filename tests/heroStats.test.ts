import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { ATTACK_DURATION, ENEMY_STATS } from '../src/model/constants';
import { gainXp, maxHpAt, recover, xpToNext } from '../src/model/heroStats';
import { spawnOf } from '../src/model/grid';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import type { Enemy } from '../src/model/types';

const FRAME = 1 / 60;
const fresh = () => new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
const nearest = (model: GameModel, kind: 'wolf' | 'bandit') =>
  model.enemies.filter((e) => e.kind === kind).reduce((a, b) => (Math.hypot(a.x - model.hero.x, a.z - model.hero.z) < Math.hypot(b.x - model.hero.x, b.z - model.hero.z) ? a : b));

// One enemy right beside the hero, the only one in the world.
function alone(model: GameModel, enemy: Enemy): Enemy {
  model.enemies.splice(0, model.enemies.length, enemy);
  enemy.x = model.hero.x + 0.5;
  enemy.z = model.hero.z;
  enemy.state = 'chase';
  return enemy;
}

describe('hero stats', () => {
  it('starts at level 1 with full health and levels up along a rising curve, healing fully', () => {
    const { hero } = fresh();
    expect([hero.level, hero.xp, hero.hp]).toEqual([1, 0, maxHpAt(1)]);
    hero.hp = 3;
    expect(gainXp(hero, xpToNext(1) + xpToNext(2) + 5)).toBe(2);
    expect([hero.level, hero.xp, hero.hp]).toEqual([3, 5, maxHpAt(3)]);
    expect(xpToNext(3)).toBeGreaterThan(xpToNext(2));
    expect(maxHpAt(3)).toBeGreaterThan(maxHpAt(1));
  });

  it('heals only once out of the fight for a while, never past full', () => {
    const { hero } = fresh();
    hero.hp = 4;
    hero.sinceHurt = 0;
    for (let t = 0; t < 4; t += FRAME) recover(hero, FRAME);
    expect(hero.hp).toBe(4);
    for (let t = 0; t < 30; t += FRAME) recover(hero, FRAME);
    expect(hero.hp).toBe(maxHpAt(1));
  });
});

describe('enemies hurt the hero', () => {
  it("a bandit's blow takes its damage off, unless invulnerable or out of reach", () => {
    const model = fresh();
    alone(model, nearest(model, 'bandit'));
    for (let t = 0; t < ENEMY_STATS.bandit.swing + FRAME && model.hero.hp === maxHpAt(1); t += FRAME) model.update(0, 0, FRAME);
    expect(model.hero.hp).toBe(maxHpAt(1) - ENEMY_STATS.bandit.damage);
    expect(model.hero.hurtFor).toBeGreaterThan(0);

    const safe = fresh();
    safe.godMode = true;
    alone(safe, nearest(safe, 'bandit'));
    for (let t = 0; t < 3; t += FRAME) safe.update(0, 0, FRAME);
    expect(safe.hero.hp).toBe(maxHpAt(1));
  });

  it('out of health, the hero wakes at spawn, healed', () => {
    const model = fresh();
    alone(model, nearest(model, 'wolf'));
    const spawn = spawnOf(model.size);
    model.hero.hp = ENEMY_STATS.wolf.damage; // one bite left
    for (let t = 0; t < 3 && model.hero.hp !== maxHpAt(1); t += FRAME) model.update(0, 0, FRAME);
    expect(model.hero.hp).toBe(maxHpAt(1));
    expect(Math.hypot(model.hero.x - spawn.x, model.hero.z - spawn.z)).toBeLessThan(1);
  });

  it('a kill is worth experience', () => {
    const model = fresh();
    model.godMode = true;
    const wolf = alone(model, nearest(model, 'wolf'));
    model.update(1, 0, 1e-6); // face +X, toward it
    for (let blow = 0; blow < wolf.maxHp && wolf.state !== 'dead'; blow++) {
      wolf.x = model.hero.x + 0.6;
      wolf.z = model.hero.z;
      model.startAttack();
      for (let t = 0; t < ATTACK_DURATION + FRAME; t += FRAME) model.update(0, 0, FRAME);
    }
    expect(wolf.state).toBe('dead');
    expect(model.hero.xp).toBe(ENEMY_STATS.wolf.xp);
  });
});
