import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { ENEMY_STATS } from '../src/model/constants';
import { LOOT, LOOT_QUALITY, rollDrop } from '../src/model/loot/loot';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const fresh = (seed = TEST_SEEDS[0]) => new GameModel(seed, TEST_MAP_SIZE);
const boarsOf = (model: GameModel) => model.enemies.filter((e) => e.kind === 'boar');

describe('boars', () => {
  it('root about the woods in ones, twos and threes', () => {
    const counts = TEST_SEEDS.map((seed) => boarsOf(fresh(seed)).length);
    expect(counts.some((n) => n > 0)).toBe(true);
    for (const seed of TEST_SEEDS) {
      const homes = new Map<string, number>();
      for (const b of boarsOf(fresh(seed))) homes.set(`${b.homeX},${b.homeZ}`, (homes.get(`${b.homeX},${b.homeZ}`) ?? 0) + 1);
      for (const n of homes.values()) expect(n).toBeLessThanOrEqual(3);
    }
  });

  it('leave the hero be, right beside them, until one is struck: then only that one charges', () => {
    const seed = TEST_SEEDS.find((s) => boarsOf(fresh(s)).length > 0)!;
    const model = fresh(seed);
    const boar = boarsOf(model)[0];
    for (const e of model.enemies) if (e.kind !== 'boar') e.state = 'dead'; // no wolves or bandits to muddle it
    model.teleport(boar.x + 0.6, boar.z);
    for (let t = 0; t < 1; t += FRAME) model.update(0, 0, FRAME);
    expect(boarsOf(model).every((b) => b.state === 'wander')).toBe(true); // passive
    model.focus(boar.id);
    model.startAttack();
    for (let t = 0; t < 0.5; t += FRAME) model.update(0, 0, FRAME);
    expect(boar.state).toBe('chase');
    expect(boarsOf(model).filter((b) => b !== boar).every((b) => b.state === 'wander')).toBe(true); // its fellows don't join in
    // Outrun past its (short) patience: back to rooting, and passive again.
    model.teleport(boar.x + ENEMY_STATS.boar.giveUp + 2, boar.z);
    for (let t = 0; t < 1; t += FRAME) model.update(0, 0, FRAME);
    expect(boar.state).toBe('wander');
    expect(ENEMY_STATS.boar.giveUp).toBeLessThan(ENEMY_STATS.wolf.giveUp);
  });

  it('drop their tusks (wolves never do)', () => {
    expect(LOOT.boarTusk.droppedBy).toEqual({ boar: 3 });
    expect(Object.values(LOOT).some((item) => (item.droppedBy as Record<string, number>).boar)).toBe(true);
  });

  it('drop raw meat, a cooking ingredient, more often than anything else', () => {
    expect(LOOT_QUALITY.rawBoarMeat).toBe('ingredient');
    const drops = Array.from({ length: 600 }, (_, id) => rollDrop('boar', id)).filter((d) => d !== null);
    const meat = drops.filter((d) => d === 'rawBoarMeat').length;
    for (const other of ['boarTusk', 'mattedPelt'] as const) expect(meat).toBeGreaterThan(drops.filter((d) => d === other).length);
  });
});
