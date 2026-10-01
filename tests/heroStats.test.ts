import { describe, expect, it } from 'vitest';
import { WEARY_TIME } from '../src/model/hero/blessing';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_STATS } from '../src/model/constants';
import { MAX_ENERGY, tiredPace, gainXp, maxHpAt, recover, xpAgainst, xpToNext } from '../src/model/hero/heroStats';
import { spawnOf } from '../src/model/map/grid';
import { FRAME, fresh, nearest, slay, eachSeed } from './support/testWorld';
import type { Enemy } from '../src/model/types';

// One enemy right beside the hero, the only one in the world.
function alone(model: GameModel, enemy: Enemy): Enemy {
  model.enemies.splice(0, model.enemies.length, enemy);
  enemy.x = enemy.homeX = model.hero.x + 0.5; // (living here: not led off from home)
  enemy.z = enemy.homeZ = model.hero.z;
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

  it('climbs steadily, each level longer than the last: paced for level 10 after about three hours', () => {
    expect([1, 2, 3, 4, 5, 9].map(xpToNext)).toEqual([171, 448, 781, 1170, 1615, 3955]);
    for (let level = 2; level < 30; level++) expect(xpToNext(level + 1) - xpToNext(level)).toBeGreaterThanOrEqual(xpToNext(level) - xpToNext(level - 1));
  });

  it('never heals by itself (hardcore), not even in bed', () => {
    const { hero } = fresh();
    hero.hp = 4;
    for (let t = 0; t < 60; t += FRAME) recover(hero, FRAME);
    for (let t = 0; t < 60; t += FRAME) recover(hero, FRAME, true);
    expect(hero.hp).toBe(4);
  });

  it('spends energy through the day awake, and sleeps it back in bed, never past full', () => {
    const { hero } = fresh();
    expect(hero.energy).toBe(MAX_ENERGY);
    for (let t = 0; t < 12 * 60; t += 1) recover(hero, 1); // half the day, 12 hours (a game minute a second)
    expect(hero.energy).toBeCloseTo(MAX_ENERGY / 2, 0);
    for (let t = 0; t < 10; t += 1) recover(hero, 1, true); // 10 seconds' sleep: 2 a second
    expect(hero.energy).toBeCloseTo(MAX_ENERGY / 2 + 20, 0);
    for (let t = 0; t < 60; t += 1) recover(hero, 1, true);
    expect(hero.energy).toBe(MAX_ENERGY);
    for (let t = 0; t < 25 * 60; t += 1) recover(hero, 1); // past a whole day awake
    expect(hero.energy).toBe(0); // never below empty
  });

  it('keeps their energy sat down, neither spent nor won back', () => {
    const { hero } = fresh();
    hero.energy = 60;
    for (let t = 0; t < 60; t += 1) recover(hero, 1, false, true);
    expect(hero.energy).toBe(60);
  });

  it('tired under a quarter of their energy, walks slower', () => {
    const { hero } = fresh();
    expect(tiredPace(hero)).toBe(1);
    hero.energy = MAX_ENERGY / 4 - 1;
    expect(tiredPace(hero)).toBeLessThan(1);
  });

  it("out of energy, collapses and wakes lying before the nearest inn's hearth, some energy back, and Weary a while", () => {
    eachSeed((model) => {
      model.hero.energy = 0.0001;
      model.update(0, 0, FRAME);
      expect(model.inside?.entrance.type).toBe('inn');
      expect(model.inside?.seated?.seat.lying).toBe(true);
      const hearth = model.inside!.furniture.find((f) => f.kind === 'hearth')!;
      expect(Math.abs(model.hero.z - hearth.z)).toBeLessThan(1.5); // before it
      expect(model.hero.energy).toBeGreaterThan(0);
      expect(model.hero.blessings?.find((b) => b.kind === 'weary')?.left).toBeGreaterThan(WEARY_TIME - 1);
    });
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

  it('out of health, the hero loses a quarter of their coins and wakes at spawn (before any inn), healed but Weary a while', () => {
    eachSeed((model) => {
      alone(model, nearest(model, 'wolf'));
      const spawn = spawnOf(model.size);
      model.hero.money = 1000;
      model.hero.hp = ENEMY_STATS.wolf.damage; // one bite left
      for (let t = 0; t < 3 && model.hero.hp !== maxHpAt(1); t += FRAME) model.update(0, 0, FRAME);
      expect(model.hero.hp).toBe(maxHpAt(1));
      expect(model.hero.money).toBe(750);
      expect(model.hero.blessings?.find((b) => b.kind === 'weary')?.left).toBe(WEARY_TIME);
      expect(Math.hypot(model.hero.x - spawn.x, model.hero.z - spawn.z)).toBeLessThan(1);
    });
  });

  it('out of health, the hero wakes in the last inn they entered', () => {
    eachSeed((model) => {
      const inn = model.entrances.find((e) => e.type === 'inn')!;
      model.teleport(inn.x, inn.z);
      model.useDoor(); // in...
      model.useDoor(); // ...and out again
      expect(model.lastInn).toBe(inn);
      alone(model, nearest(model, 'wolf'));
      model.hero.hp = ENEMY_STATS.wolf.damage;
      for (let t = 0; t < 3 && model.hero.hp !== maxHpAt(1); t += FRAME) model.update(0, 0, FRAME);
      expect(model.inside?.entrance).toBe(inn);
    });
  });

  it('a kill is worth experience', () => {
    const model = fresh();
    model.godMode = true;
    const wolf = alone(model, nearest(model, 'wolf'));
    slay(model, wolf);
    expect(wolf.state).toBe('dead');
    expect(model.hero.xp).toBe(ENEMY_STATS.wolf.xp);
  });

  it('gives less experience for weaker foes: full at the same level, more above, a little down to 4 below, a token 1 once trivial (5 below)', () => {
    expect(xpAgainst(20, 5, 5)).toBe(20);
    expect(xpAgainst(20, 6, 5)).toBe(23);
    expect(xpAgainst(20, 9, 5)).toBe(26);
    expect(xpAgainst(20, 4, 5)).toBe(15);
    expect(xpAgainst(20, 3, 5)).toBe(11);
    expect(xpAgainst(20, 2, 5)).toBe(7); // three below: still something
    expect(xpAgainst(20, 1, 5)).toBe(4);
    expect(xpAgainst(20, 0, 5)).toBe(1); // five below: a token
    expect(xpAgainst(10, 1, 9)).toBe(1); // a level 1 wolf, to a level 9 hero
  });
});
