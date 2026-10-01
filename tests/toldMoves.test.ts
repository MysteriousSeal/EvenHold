// A foe's told move (model/crypts/toldMoves.ts), whichever it is (a lord's
// slam, a draugr's breath or cleave): started only close, chasing, not mid-blow,
// its wait over, not while busy with another; planted through it; landed at
// its tell's end on what it hits (even with nothing after); lost to a blow
// while told (unless staunch); done after.
import { describe, expect, it } from 'vitest';
import { ToldMoves, type ToldMove } from '../src/model/enemies/toldMoves';
import { makeEnemy } from '../src/model/enemies/enemies';
import type { Enemy } from '../src/model/types';

const DT = 1 / 60;
const MOVE: ToldMove = { told: 'cleave', by: 'draugr', tell: 0.5, after: 0.2, every: 3, first: 0, near: 2, hits: (m, hero) => Math.hypot(hero.x - m.x, hero.z - m.z) < 1.5 };
const foe = (): Enemy => ({ ...makeEnemy(1, 'draugr', 0, 0), state: 'chase' });
const run = (moves: ToldMoves, f: Enemy, hero: { x: number; z: number }, seconds: number, busy?: (f: Enemy) => boolean) => {
  for (let t = 0; t < seconds; t += DT) moves.update([f], hero as never, DT, busy);
};

describe('told moves', () => {
  it('start only close, chasing, not mid-blow, its wait over, not while busy; never by another kind', () => {
    const start = (tweak: (f: Enemy) => void, at = { x: 1, z: 0 }, busy?: () => boolean, move = MOVE) => {
      const moves = new ToldMoves(move, () => {});
      const f = foe();
      tweak(f);
      run(moves, f, at, DT, busy);
      return moves.moves.length;
    };
    expect(start(() => {})).toBe(1);
    expect(start(() => {}, { x: 3, z: 0 })).toBe(0); // (too far)
    expect(start((f) => (f.state = 'wander'))).toBe(0);
    expect(start((f) => (f.swingFor = 0.1))).toBe(0);
    expect(start(() => {}, undefined, () => true)).toBe(0); // (busy with another)
    expect(start(() => {}, undefined, undefined, { ...MOVE, first: 1 })).toBe(0); // (its wait)
    expect(start(() => {}, undefined, undefined, { ...MOVE, by: 'skeleton' })).toBe(0);
  });

  it('plant the foe, tell it, land at the tell\'s end on what it hits (once), and be done after', () => {
    const landed: unknown[] = [];
    const moves = new ToldMoves(MOVE, (_f, m) => landed.push(m));
    const f = foe();
    run(moves, f, { x: 1, z: 0 }, DT);
    f.x = 0.4; // (the director would move it: it's held)
    run(moves, f, { x: 1, z: 0 }, 0.2);
    expect([f.x, f.told, f.windUp! > 0]).toEqual([0, 'cleave', true]);
    run(moves, f, { x: 1, z: 0 }, 0.35);
    expect(landed).toHaveLength(1);
    run(moves, f, { x: 1, z: 0 }, 0.3);
    expect(moves.moves).toHaveLength(0);
    expect([f.told, f.windUp]).toEqual([null, null]);
    expect(landed).toHaveLength(1);
  });

  it('miss what it doesn\'t hit; land even with nothing after', () => {
    const missed: unknown[] = [];
    const away = new ToldMoves(MOVE, () => missed.push(1));
    const f = foe();
    run(away, f, { x: 1, z: 0 }, DT);
    run(away, f, { x: 1.9, z: 0 }, 1);
    expect(missed).toHaveLength(0);
    const landed: unknown[] = [];
    const sharp = new ToldMoves({ ...MOVE, after: 0 }, () => landed.push(1));
    run(sharp, foe(), { x: 1, z: 0 }, 1);
    expect(landed).toHaveLength(1);
  });

  it('are lost to a blow while told, unless staunch', () => {
    for (const staunch of [false, true]) {
      const landed: unknown[] = [];
      const moves = new ToldMoves({ ...MOVE, staunch }, () => landed.push(1));
      const f = foe();
      run(moves, f, { x: 1, z: 0 }, 0.1);
      f.hurtFor = 0.25;
      run(moves, f, { x: 1, z: 0 }, 0.6);
      expect(landed).toHaveLength(staunch ? 1 : 0);
    }
  });
});
