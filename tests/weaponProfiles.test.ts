// Each kind of weapon fights its own way (hero/weaponProfiles.ts): a blow's length and breath, its reach and arc, its
// weight against a steady foe, a sweep catching a second foe; about as much harm a second, whatever the kind.
import { describe, expect, it } from 'vitest';
import { WEAPON_PROFILES, profileText, wieldedOf } from '../src/model/hero/weaponProfiles';
import { blowTarget, heroBlow } from '../src/model/hero/combat';
import { landBlow } from '../src/model/hero/fighting';
import { blowOf } from '../src/model/hero/attributes';
import { makeEnemy } from '../src/model/enemies/enemies';
import { flinches } from '../src/model/enemies/poise';
import { ATTACK_DURATION, ATTACK_REACH, ENEMY_STATS } from '../src/model/constants';
import { fresh } from './support/testWorld';

const run = (model: ReturnType<typeof fresh>, seconds: number, step = 1 / 60) => {
  for (let t = 0; t < seconds; t += step) model.update(0, 0, step);
};

describe('weapons, each its own', () => {
  it('about as much harm a second whatever the kind (the slow ones hit the harder)', () => {
    for (const [kind, p] of Object.entries(WEAPON_PROFILES)) expect(p.harm / p.time, kind).toBeGreaterThan(0.85), expect(p.harm / p.time, kind).toBeLessThan(1.1);
  });

  it('a blow\'s harm not rounded: at a starter\'s blow, a dagger and a hammer land a sword\'s harm a second, near enough', () => {
    const perSecond = (weapon: string) => {
      const hero = fresh().hero;
      hero.equipment.mainHand = weapon as never;
      return heroBlow(hero, 0.99).damage / WEAPON_PROFILES[wieldedOf(hero)].time / blowOf(hero); // (a blow of 1 or 2: the weapon's own Strength)
    };
    const sword = perSecond('armingSword');
    for (const weapon of ['dagger', 'warHammer']) expect(perSecond(weapon) / sword, weapon).toBeCloseTo(1, 2); // (rounded, a dagger 1.39, a hammer 0.71)
  });

  it('a war hammer\'s blow slow and dear in breath; a dagger\'s quick and cheap', () => {
    const blowTime = (weapon: 'warHammer' | 'dagger') => {
      const model = fresh();
      model.hero.equipment.mainHand = weapon;
      const breath = model.moves.breath;
      model.startAttack();
      const spent = breath - model.moves.breath;
      let t = 0;
      while (model.moves.blowProgress !== null && t < 3) [t] = [t + 1 / 60, run(model, 1 / 60)];
      return { t, spent };
    };
    const [hammer, dagger] = [blowTime('warHammer'), blowTime('dagger')];
    expect(hammer.t).toBeCloseTo(ATTACK_DURATION * WEAPON_PROFILES.hammer.time, 1);
    expect(dagger.t).toBeCloseTo(ATTACK_DURATION * WEAPON_PROFILES.dagger.time, 1);
    expect([hammer.spent, dagger.spent]).toEqual([WEAPON_PROFILES.hammer.breath, WEAPON_PROFILES.dagger.breath]);
  });

  it('a spear reaches a foe a sword cannot, but only straight ahead', () => {
    const { hero } = fresh();
    Object.assign(hero, { x: 10, z: 10, facing: 0 });
    const far = makeEnemy(1, 'wolf', 10, 10 + ATTACK_REACH + ENEMY_STATS.wolf.radius + 0.3);
    hero.equipment.mainHand = 'armingSword';
    expect(blowTarget(hero, [far], null)).toBeNull();
    hero.equipment.mainHand = 'spear';
    expect(blowTarget(hero, [far], null)?.target).toBe(far);
    const aside = makeEnemy(2, 'wolf', 10.5, 10.5); // (45° off)
    expect(blowTarget(hero, [aside], null)).toBeNull();
    hero.equipment.mainHand = 'armingSword';
    expect(blowTarget(hero, [aside], null)?.target).toBe(aside);
  });

  it('an axe sweeps a second foe beside the first, for half', () => {
    const model = fresh();
    Object.assign(model.hero, { facing: 0 });
    model.hero.equipment.mainHand = 'battleAxe';
    const { x, z } = model.hero;
    const [a, b] = [makeEnemy(900001, 'wolf', x - 0.25, z + 0.55), makeEnemy(900002, 'wolf', x + 0.3, z + 0.6)];
    model.enemies.splice(0, model.enemies.length, a, b);
    for (const w of [a, b]) w.hp = w.maxHp = 999;
    landBlow(model as never);
    expect(a.hp).toBeLessThan(999);
    expect(b.hp).toBeLessThan(999);
    const [first, second] = [999 - a.hp, 999 - b.hp].sort((m, n) => n - m);
    expect(second).toBe(Math.max(1, Math.round(first * WEAPON_PROFILES.axe.sweep!)));
  });

  it('a hammer\'s blow shakes a steady foe at once; a dagger\'s takes four', () => {
    const bandit = makeEnemy(1, 'bandit', 0, 0);
    expect(flinches(bandit, 0, false, WEAPON_PROFILES.hammer.poise)).toBe(true);
    const other = makeEnemy(2, 'bandit', 0, 0);
    expect([0, 0.3, 0.6, 0.9].map((t) => flinches(other, t, false, WEAPON_PROFILES.dagger.poise))).toEqual([false, false, false, true]);
  });

  it('fists with nothing in hand; told in a few words on the weapon', () => {
    const { hero } = fresh();
    delete hero.equipment.mainHand;
    expect(wieldedOf(hero)).toBe('fists');
    expect(profileText('spear')).toContain('long reach');
    expect(profileText('hammer')).toContain('staggers the steady');
    expect(profileText('dagger')).toMatch(/^Quick/);
    expect(heroBlow(hero, 1).damage).toBeGreaterThan(0);
  });
});
