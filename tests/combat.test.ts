// The fight's rules, the hero's side (hero/combat.ts): which foe a blow
// lands on, what it does, and what a foe's blow does to the hero.
import { describe, expect, it } from 'vitest';
import { blowTaken, blowTarget, heroBlow } from '../src/model/hero/combat';
import { makeEnemy } from '../src/model/enemies/enemies';
import { ATTACK_REACH, ENEMY_STATS } from '../src/model/constants';
import { ITEMS, type ItemId } from '../src/model/human/equipment';
import type { EnemyKind, Hero } from '../src/model/types';
import { fresh } from './support/testWorld';

// The hero at (10, 10) facing +z, wearing `items`.
function heroWith(...items: ItemId[]): Hero {
  const { hero } = fresh();
  Object.assign(hero, { x: 10, z: 10, facing: 0 });
  for (const id of items) hero.equipment[ITEMS[id].slot] = id;
  return hero;
}
const foe = (id: number, x: number, z: number, kind: EnemyKind = 'wolf') => makeEnemy(id, kind, x, z);

describe("the hero's blow lands on", () => {
  it('the foe right in front', () => {
    const hero = heroWith();
    const wolf = foe(1, 10, 10.6);
    expect(blowTarget(hero, [wolf], null)).toMatchObject({ target: wolf });
  });

  it.each([
    ['behind', 10, 9.4],
    ['to the side, past the swing', 10.6, 10],
    ['out of reach', 10, 10 + ATTACK_REACH + 0.6],
  ])('nothing %s', (_, x, z) => {
    expect(blowTarget(heroWith(), [foe(1, x, z)], null)).toBeNull();
  });

  it('the nearest, of several in front', () => {
    const [far, near] = [foe(1, 10, 10.8), foe(2, 10.1, 10.4)];
    expect(blowTarget(heroWith(), [far, near], null)?.target).toBe(near);
  });

  it('a dead foe never', () => {
    const wolf = foe(1, 10, 10.5);
    wolf.state = 'dead';
    expect(blowTarget(heroWith(), [wolf], wolf)).toBeNull();
  });

  it('the focused foe whenever it is in reach, even behind and with another nearer', () => {
    const [focused, other] = [foe(1, 10, 9.5), foe(2, 10, 10.4)];
    expect(blowTarget(heroWith(), [focused, other], focused)?.target).toBe(focused);
  });

  it('the nearest in front when the focused one is out of reach', () => {
    const [focused, other] = [foe(1, 10, 20), foe(2, 10, 10.4)];
    expect(blowTarget(heroWith(), [focused, other], focused)?.target).toBe(other);
  });

  it.each(['wolf', 'bandit', 'boar'] as const)('a %s, as far as its size reaches', (kind) => {
    const edge = 10 + ATTACK_REACH + ENEMY_STATS[kind].radius - 0.01;
    expect(blowTarget(heroWith(), [foe(1, 10, edge, kind)], null)).not.toBeNull();
  });
});

describe("what the hero's blow does", () => {
  it('1 damage, bare-handed at level 1, and no critical without Agility', () => {
    expect(heroBlow(heroWith(), 0)).toEqual({ damage: 1, crit: false });
  });

  it.each<[ItemId, number]>([
    ['woodenSword', 1.25], // +1 Strength (gear's: a quarter a point)
    ['armingSword', 1.75], // +3
    ['battleAxe', 2.25], // +5
  ])('more with Strength (%s: %s a blow)', (item, damage) => {
    expect(heroBlow(heroWith(item), 0.99).damage).toBe(damage);
  });

  it('double on a critical blow (Agility, and the roll under its chance)', () => {
    const hero = heroWith('dagger'); // +3 Agility: 3%; a dagger's blow 0.72 of a sword's (quicker: not rounded)
    expect(heroBlow(hero, 0.02)).toEqual({ damage: 1.44, crit: true });
    expect(heroBlow(hero, 0.04)).toEqual({ damage: 0.72, crit: false });
  });

  it("a fifth more with the well's Strong blessing", () => {
    const hero = heroWith();
    hero.blessings = [{ kind: 'strong', left: 60 }];
    expect(heroBlow(hero, 0.99).damage).toBeCloseTo(1.2);
  });
});

describe("what a foe's blow does to the hero", () => {
  it('all of it, bare and without Agility', () => {
    expect(blowTaken(heroWith(), 3, 0)).toEqual({ dodged: false, damage: 3 });
  });

  it('nothing, dodged (Agility, and the roll under its chance)', () => {
    const hero = heroWith('parryingDagger'); // +3 Agility: 3%
    expect(blowTaken(hero, 5, 0.01)).toEqual({ dodged: true, damage: 0 });
    expect(blowTaken(hero, 5, 0.5).dodged).toBe(false);
  });

  it.each<[ItemId[], number, number, number]>([
    [['chainMail'], 5, 1, 4], // 8 armour: a fifth off a level-1 foe's
    [['breastplate', 'greatHelm', 'plateGreaves', 'towerShield'], 10, 1, 5], // 28: near half off
    [['breastplate', 'greatHelm', 'plateGreaves', 'towerShield'], 10, 10, 8], // the same from a level-10 foe: a quarter
    [['breastplate', 'greatHelm', 'plateGreaves', 'towerShield'], 1, 1, 1], // never under 1
  ])('a share less through armour, the less the stronger the foe (%j: %i from a level-%i foe becomes %i)', (items, damage, level, taken) => {
    expect(blowTaken(heroWith(...items), damage, 0.99, level).damage).toBe(taken);
  });

  it("15% less with the well's Tough blessing; with a feast and armour, never more than 60% off, nor under 1", () => {
    const hero = heroWith();
    hero.blessings = [{ kind: 'tough', left: 60 }];
    expect(blowTaken(hero, 20, 0.99).damage).toBe(17);
    expect(blowTaken(hero, 1, 0.99).damage).toBe(1);
    const walled = heroWith('breastplate', 'greatHelm', 'plateGreaves', 'towerShield');
    walled.blessings = [{ kind: 'tough', left: 60 }, { kind: 'feasted', left: 60 }];
    expect(blowTaken(walled, 10, 0.99, 1).damage).toBe(4); // (near half, and 30% more: 60% at most)
  });

  it("a level-6 bandit king's blow on a level-1 hero in the smith's best is not cut to 1", () => {
    const hero = heroWith('greatHelm', 'mailMantle', 'breastplate', 'gauntlets', 'plateGreaves', 'sabatons', 'towerShield');
    expect(blowTaken(hero, 7, 0.99, 6).damage).toBeGreaterThanOrEqual(4);
  });
});

describe('a palisade between them', () => {
  it("stops the hero's blow and the foe's alike: neither through it, a bandit in its camp and the hero outside", () => {
    const model = fresh();
    model.random = () => 0.999;
    const camp = model.camps[0];
    model.enemies.length = 0;
    // A tile off the middle of a side (not the way in, there): a bandit pressed to the palisade inside, the hero against it outside.
    const along = ([dx, dz]: number[], d: number) => ({ x: camp.x + dx * d + (dz ? 1 : 0), z: camp.z + dz * d + (dx ? 1 : 0) });
    const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find((s) => !model.clear(along(s, 2.3), along(s, 2.75)))!;
    const [dx, dz] = side;
    const at = (d: number) => along(side, d);
    const bandit = { ...makeEnemy(901, 'bandit', at(2.3).x, at(2.3).z, camp.x, camp.z), state: 'chase' as const };
    model.enemies.push(bandit);
    model.teleport(at(2.75).x, at(2.75).z);
    model.hero.facing = Math.atan2(-dx, -dz);
    expect(Math.hypot(bandit.x - model.hero.x, bandit.z - model.hero.z)).toBeLessThan(ATTACK_REACH);
    expect(blowTarget(model.hero, model.enemies, null, model.clear)).toBeNull();
    const hp = model.hero.hp;
    for (let i = 0; i < 300; i++) model.update(0, 0, 1 / 60);
    expect(model.hero.hp).toBe(hp);
  });
});
