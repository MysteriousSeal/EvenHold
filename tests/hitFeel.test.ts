import { describe, expect, it } from 'vitest';
import { HIT_STOP, MAX_SHAKE, hitFeel } from '../src/controller/hitFeel';
import type { GameEvent } from '../src/model/types';
import { GameModel } from '../src/model/GameModel';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

type Hit = Extract<GameEvent, { kind: 'hit' }>;
const hit = (more: Partial<Hit> = {}): Hit => ({ kind: 'hit', on: 'bandit', amount: 2, x: 0, y: 0, z: 0, weapon: 'sword', share: 0.3, ...more });

describe('how a blow lands (hitFeel)', () => {
  it("holds the world still a sword's plain blow, longer a crit, longer a kill, longest a riposte", () => {
    const plain = hitFeel(hit()).stop;
    const crit = hitFeel(hit({ crit: true })).stop;
    const kill = hitFeel(hit({ killed: true })).stop;
    const riposte = hitFeel(hit({ crit: true, riposte: true })).stop;
    expect(plain).toBeCloseTo(HIT_STOP.hit);
    expect(crit).toBeCloseTo(HIT_STOP.crit);
    expect(kill).toBeCloseTo(HIT_STOP.kill);
    expect(riposte).toBeCloseTo(HIT_STOP.riposte);
    expect(plain).toBeLessThan(crit);
    expect(crit).toBeLessThan(kill);
    expect(kill).toBeLessThan(riposte);
  });

  it('a crit that kills holds as long as a kill (the longer of the two)', () => {
    expect(hitFeel(hit({ crit: true, killed: true })).stop).toBeCloseTo(HIT_STOP.kill);
  });

  it("weighs the stop by the weapon: a dagger's shorter than a sword's, a hammer's longer", () => {
    const of = (weapon: Hit['weapon']) => hitFeel(hit({ weapon })).stop;
    expect(of('dagger')).toBeLessThan(of('sword'));
    expect(of('hammer')).toBeGreaterThan(of('sword'));
    expect(of(undefined)).toBeCloseTo(of('sword')); // (a spell's: as a sword's)
  });

  it('never holds more than a few frames, whatever lands', () => {
    expect(hitFeel(hit({ weapon: 'hammer', crit: true, riposte: true, killed: true })).stop).toBeLessThanOrEqual(0.16);
    expect(hitFeel(hit({ weapon: 'dagger' })).stop).toBeGreaterThanOrEqual(0.02);
  });

  it('the hero struck: a short stop of its own', () => {
    expect(hitFeel(hit({ on: 'hero', weapon: undefined })).stop).toBeCloseTo(HIT_STOP.struck);
  });

  it("shakes by the harm done and the weapon's weight: a hammer's hard, a dagger's barely, never past the cap", () => {
    const shake = (more: Partial<Hit>) => hitFeel(hit(more)).shake;
    expect(shake({ share: 0.6 })).toBeGreaterThan(shake({ share: 0.1 }));
    expect(shake({ weapon: 'hammer' })).toBeGreaterThan(shake({ weapon: 'sword' }));
    expect(shake({ weapon: 'dagger' })).toBeLessThan(shake({ weapon: 'sword' }) / 1.5);
    expect(shake({ weapon: 'hammer', share: 1, crit: true, riposte: true, killed: true })).toBeLessThanOrEqual(MAX_SHAKE);
  });
});

describe('a blow landing, told (model/hero/fighting.ts)', () => {
  // The hero's blows on a wolf of `hp` right before them, till it falls or a few seconds pass: the hits told.
  function blows(hp: number): Hit[] {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const { hero } = model;
    const foe = model.enemies.find((e) => e.kind === 'wolf')!;
    Object.assign(foe, { x: hero.x + Math.sin(hero.facing) * 0.3, z: hero.z + Math.cos(hero.facing) * 0.3, state: 'wander', hp, maxHp: 4 });
    model.enemiesFrozen = true;
    model.random = () => 0.99; // (no critical blows)
    const hits: Hit[] = [];
    for (let t = 0; t < 4 && foe.state !== 'dead'; t += 1 / 60) {
      model.startAttack();
      model.update(0, 0, 1 / 60);
      hits.push(...model.takeEvents().filter((e): e is Hit => e.kind === 'hit'));
    }
    return hits;
  }

  it('with the weapon (fists), the share of its health it took, where it came from; the last, a kill', () => {
    const hits = blows(2);
    expect(hits.length).toBeGreaterThan(0);
    const [first, last] = [hits[0], hits[hits.length - 1]];
    expect(first).toMatchObject({ on: 'wolf', weapon: 'fists', riposte: false, share: first.amount / 4, from: { x: expect.any(Number), z: expect.any(Number) } });
    expect(last.killed).toBe(true);
    expect(hits.slice(0, -1).every((h) => !h.killed)).toBe(true);
  });
});
