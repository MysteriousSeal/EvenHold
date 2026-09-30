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
    ['woodenSword', 1], // +1 Strength
    ['armingSword', 2], // +3
    ['battleAxe', 2], // +5
  ])('more with Strength (%s: %i a blow)', (item, damage) => {
    expect(heroBlow(heroWith(item), 0.99).damage).toBe(damage);
  });

  it('double on a critical blow (Agility, and the roll under its chance)', () => {
    const hero = heroWith('dagger'); // +3 Agility: 3%
    expect(heroBlow(hero, 0.02)).toEqual({ damage: 2, crit: true });
    expect(heroBlow(hero, 0.04)).toEqual({ damage: 1, crit: false });
  });

  it("a point more with the well's Strong blessing", () => {
    const hero = heroWith();
    hero.blessings = [{ kind: 'strong', left: 60 }];
    expect(heroBlow(hero, 0.99).damage).toBe(2);
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

  it.each<[ItemId[], number, number]>([
    [['chainMail'], 5, 4], // 8 armour: 1 off
    [['breastplate'], 5, 3], // 10: 2 off
    [['breastplate', 'greatHelm', 'plateGreaves', 'towerShield'], 9, 4], // 28: 5 off
    [['breastplate', 'greatHelm', 'plateGreaves', 'towerShield'], 3, 1], // never under 1
  ])('less through armour (%j: %i becomes %i)', (items, damage, taken) => {
    expect(blowTaken(heroWith(...items), damage, 0.99).damage).toBe(taken);
  });

  it("a point less with the well's Tough blessing, and never under 1", () => {
    const hero = heroWith();
    hero.blessings = [{ kind: 'tough', left: 60 }];
    expect(blowTaken(hero, 3, 0.99).damage).toBe(2);
    expect(blowTaken(hero, 1, 0.99).damage).toBe(1);
  });
});
