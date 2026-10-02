// @vitest-environment happy-dom
// The hero's moves in a fight (model/hero/combatMoves.ts): breath spent on
// blows and rolls and refilling, less of it tired; a roll carrying them and
// untouchable early on; the guard cutting blows, parrying one met as it's
// raised (the foe staggered, the next blow on it twice as hard), breaking
// with no breath left; and the keys (Shift alone a roll, Q held the guard).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { BREATH, COST, RIPOSTE_FACTOR, ROLL_REACH, ROLL_SAFE, ROLL_TIME, STAGGER, TIRED_BREATH, guardOf } from '../src/model/hero/combatMoves';
import { cryptHooks, heroStruck, landBlow } from '../src/model/hero/fighting';
import { makeEnemy } from '../src/model/enemies/enemies';
import { TIRED } from '../src/model/hero/heroStats';
import { KeyboardInput } from '../src/controller/KeyboardInput';
import type { GameEvent } from '../src/model/types';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = () => {
  const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
  model.random = () => 0.999; // (no dodge, no critical blow by chance)
  model.enemies.length = 0; // (none about to get in the way)
  return model;
};
const run = (model: GameModel, seconds: number, step = 1 / 60) => {
  for (let t = 0; t < seconds; t += step) model.update(0, 0, step);
};
const guarded = (model: GameModel) => model.takeEvents().filter((e): e is Extract<GameEvent, { kind: 'guard' }> => e.kind === 'guard').map((e) => e.outcome);

describe('breath', () => {
  it('a blow spends it; it refills a moment after; with none, no blow', () => {
    const model = fresh();
    expect(model.moves.breath).toBe(BREATH);
    expect(model.startAttack()).toBe(true);
    expect(model.moves.breath).toBe(BREATH - COST.blow);
    run(model, 2);
    expect(model.moves.breath).toBe(BREATH);
    model.moves.breath = 0;
    expect(model.startAttack()).toBe(false);
  });

  it('tired, it holds less and refills slower', () => {
    const model = fresh();
    model.hero.energy = TIRED - 1;
    run(model, 0.1);
    expect(model.moves.most).toBe(TIRED_BREATH);
    expect(model.moves.breath).toBeLessThanOrEqual(TIRED_BREATH);
    const rested = fresh();
    for (const m of [model, rested]) [m.moves.breath] = [10];
    run(model, 1);
    run(rested, 1);
    expect(model.moves.breath).toBeLessThan(rested.moves.breath);
  });
});

describe('the roll', () => {
  it('carries them the way they go (still: backwards), spending breath, never mid-blow', () => {
    const model = fresh();
    model.noclip = true; // (nothing in the way)
    const { x, z } = model.hero;
    expect(model.roll(1, 0)).toBe(true);
    expect(model.moves.breath).toBe(BREATH - COST.roll);
    run(model, ROLL_TIME + 0.05);
    expect(model.hero.x - x).toBeCloseTo(ROLL_REACH, 1);
    expect(model.hero.z).toBeCloseTo(z, 5);
    model.hero.facing = 0; // (facing +z)
    model.roll(0, 0);
    run(model, ROLL_TIME + 0.05);
    expect(model.hero.z).toBeLessThan(z - 2); // (backwards)
    model.startAttack();
    expect(model.roll(1, 0)).toBe(false);
  });

  it('untouchable early in it: a blow then rolled through; later, taken', () => {
    const model = fresh();
    const wolf = makeEnemy(900, 'wolf', model.hero.x + 1, model.hero.z);
    const hp = model.hero.hp;
    model.roll(0, 1);
    heroStruck(model, 5, wolf);
    expect(model.hero.hp).toBe(hp);
    expect(guarded(model)).toEqual(['rolled']);
    run(model, ROLL_SAFE + 0.02);
    heroStruck(model, 5, wolf);
    expect(model.hero.hp).toBeLessThan(hp);
  });
  it('a frost breath rolled through: no harm, not chilled; taken: chilled', () => {
    const chilled = (rolling: boolean) => {
      const model = fresh();
      if (rolling) model.roll(1, 0);
      cryptHooks(model).frost(makeEnemy(905, 'draugr', model.hero.x, model.hero.z + 1));
      return (model.hero.blessings ?? []).some((b) => b.kind === 'chilled');
    };
    expect(chilled(true)).toBe(false);
    expect(chilled(false)).toBe(true);
  });
});

describe('the guard', () => {
  it('raised just as a blow lands: parried, no harm, the foe staggered and the next blow on it twice as hard', () => {
    const model = fresh();
    const wolf = makeEnemy(901, 'wolf', model.hero.x, model.hero.z + 0.5);
    model.enemies.push(wolf);
    const hp = model.hero.hp;
    model.raiseGuard(true);
    heroStruck(model, 8, wolf);
    expect(model.hero.hp).toBe(hp);
    expect(guarded(model)).toEqual(['parried']);
    expect(wolf.hurtFor).toBe(STAGGER);
    model.focus(wolf.id);
    const plain = makeEnemy(902, 'wolf', 0, 0);
    expect(model.moves.riposteOn(plain)).toBe(1);
    const before = wolf.hp;
    model.raiseGuard(false);
    landBlow(model);
    const ripost = before - wolf.hp;
    wolf.hp = before;
    landBlow(model);
    expect(ripost).toBeGreaterThanOrEqual((before - wolf.hp) * RIPOSTE_FACTOR - 1);
  });

  it('held past the parry: the blow cut by what\'s in the off hand, breath spent; out of breath, broken', () => {
    const blocked = (offHand?: 'towerShield' | 'buckler') => {
      const model = fresh();
      if (offHand) model.hero.equipment.offHand = offHand;
      model.raiseGuard(true);
      run(model, 0.5);
      const [hp, breath] = [model.hero.hp, model.moves.breath];
      heroStruck(model, 10, makeEnemy(903, 'bandit', model.hero.x, model.hero.z + 0.5));
      expect(guarded(model)).toEqual(['blocked']);
      expect(model.moves.breath).toBeLessThan(breath);
      return hp - model.hero.hp;
    };
    expect(blocked('towerShield')).toBe(0); // (a wall of a shield: all of it)
    expect(blocked('buckler')).toBeLessThan(blocked());
    expect(guardOf(undefined)).toBe(0.5);
    const model = fresh();
    model.raiseGuard(true);
    run(model, 0.5);
    model.moves.breath = 1;
    const hp = model.hero.hp;
    heroStruck(model, 4, makeEnemy(904, 'bandit', model.hero.x, model.hero.z + 0.5));
    expect(guarded(model)).toEqual(['broken']);
    expect(model.hero.hp).toBeLessThan(hp);
    expect(model.moves.guard).toBeNull();
  });

  it('never in an inn (arms sheathed), nor while sat', () => {
    const model = fresh();
    Object.defineProperty(model, 'seated', { get: () => ({}) });
    model.raiseGuard(true);
    expect(model.moves.guard).toBeNull();
    expect(model.roll(1, 0)).toBe(false);
  });
});

describe('the keys', () => {
  const key = (type: 'keydown' | 'keyup', code: string, shiftKey = false) => window.dispatchEvent(new KeyboardEvent(type, { code, shiftKey }));
  it('Shift pressed: a roll at once, once (held, no more); Q held: the guard', () => {
    const input = new KeyboardInput();
    key('keydown', 'ShiftLeft');
    expect(input.consumeRoll()).toBe(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft', repeat: true }));
    expect(input.consumeRoll()).toBe(false);
    key('keyup', 'ShiftLeft');
    key('keydown', 'KeyW');
    key('keydown', 'ShiftRight');
    expect(input.consumeRoll()).toBe(true); // (rolling while moving)
    key('keydown', 'KeyQ');
    expect(input.guarding).toBe(true);
    key('keyup', 'KeyQ');
    expect(input.guarding).toBe(false);
  });
});
