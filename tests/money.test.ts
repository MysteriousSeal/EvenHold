import { describe, expect, it } from 'vitest';
import { coinDrop, coins } from '../src/model/money';
import type { Enemy } from '../src/model/types';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';

describe('money', () => {
  it('counts copper as gold, silver and copper', () => {
    expect(coins(0)).toEqual({ gold: 0, silver: 0, copper: 0 });
    expect(coins(1234567)).toEqual({ gold: 123, silver: 45, copper: 67 });
  });

  it('comes from every slain foe, more from bandits and tougher ones', () => {
    const foe = (id: number, kind: Enemy['kind'], level: number) => ({ id, kind, level }) as Enemy;
    expect(Array.from({ length: 300 }, (_, id) => coinDrop(foe(id, 'wolf', 1))).every((d) => d > 0)).toBe(true);
    const sum = (kind: Enemy['kind'], level: number) => Array.from({ length: 300 }, (_, id) => coinDrop(foe(id, kind, level))).reduce((a, b) => a + b, 0);
    expect(sum('bandit', 1)).toBeGreaterThan(sum('wolf', 1));
    expect(sum('wolf', 5)).toBeGreaterThan(sum('wolf', 1));
  });

  it('is scooped into the purse by walking near it', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const { hero } = model;
    model.coins.push({ id: 999, amount: 57, x: hero.x + 0.5, z: hero.z, y: hero.y });
    expect(hero.money).toBe(0);
    model.update(0, 0, 1 / 60); // standing close: picked up, no key needed
    expect(hero.money).toBe(57);
    expect(model.coins).toHaveLength(0);
  });
});
