// The difficulty, played out (support/fightCurve.ts): no foe beaten unhurt by holding the attack down (poise:
// enemies/poise.ts), unless it's a light one.
import { describe, expect, it } from 'vitest';
import { STAGES, fight } from './support/fightCurve';
import { blowsToFlinch, flinches } from '../src/model/enemies/poise';
import { makeEnemy } from '../src/model/enemies/enemies';

const stage = (level: number) => STAGES.find((s) => s.level === level)!;

describe('poise', () => {
  it('the light flinch at every blow; the steadier at the second within a moment; the heavy and the bosses never, unless caught open', () => {
    const [wolf, boar, draugr] = [makeEnemy(1, 'wolf', 0, 0), makeEnemy(2, 'boar', 0, 0), makeEnemy(3, 'draugr', 0, 0)];
    expect([flinches(wolf, 0, false), flinches(wolf, 0.1, false)]).toEqual([true, true]);
    expect([flinches(boar, 0, false), flinches(boar, 1, false), flinches(boar, 1.2, false), flinches(boar, 5, false)]).toEqual([false, true, false, false]); // (the third: counting afresh; the fourth: long after)
    expect([flinches(draugr, 0, false), flinches(draugr, 0.2, false), flinches(draugr, 0.4, false), flinches(draugr, 0.6, true)]).toEqual([false, false, false, true]);
    expect([blowsToFlinch('cryptLord'), blowsToFlinch('banditKing'), blowsToFlinch('bandit')]).toEqual([Infinity, Infinity, 1]);
  });

  it('a hero holding the attack down never beats a boar, a camp chief or a draugr unhurt', { timeout: 300_000 }, () => {
    for (const [kind, level] of [['boar', 3], ['banditChief', 5], ['draugr', 8]] as const) {
      const r = fight(stage(1), kind, level, 'masher', 120);
      expect(r.won && r.lost === 0, `${kind} L${level}: ${JSON.stringify({ won: r.won, lost: r.lost, t: r.t })}`).toBe(false);
    }
  });
});
