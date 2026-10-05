// What told moves are made of (model/enemies/toldMoves.ts), shared by the
// caves' beasts and the wild ones: carried along the way it faced (stopped
// short of what's in the way); a leap, biting only where it lands; a rush down
// a strip, catching only who's on it; a knock straight away from the move
// (right on it: thrown all the same).
import { describe, expect, it } from 'vitest';
import { carried, knockAway, leap, onStrip, rush, type Told } from '../src/model/enemies/toldMoves';

const move = (over: Partial<Told> = {}): Told => ({ foe: {} as Told['foe'], x: 0, z: 0, dx: 1, dz: 0, tx: 3, tz: 0, t: 0, ...over });
const open = () => false;
const wallAt = (x: number) => (wx: number) => wx >= x; // (the rock from x on)
const shape = { told: 'charge' as const, by: 'bear' as const, tell: 1, after: 0.5, every: 5, first: 0, near: 6 };

describe('told moves\' shapes', () => {
  it('carried: on along the way it faced, as far as it goes over its time, stopped short of what\'s in the way', () => {
    const path = carried(open, () => 4, 0.5);
    expect(Math.abs(path(move(), 0.25).x - 2)).toBeLessThanOrEqual(0.1); // (a tenth of a tile at a step)
    expect(Math.abs(path(move(), 1).x - 4)).toBeLessThanOrEqual(0.1);
    const walled = carried(wallAt(2.5), () => 4, 0.5);
    expect(walled(move(), 1).x).toBeLessThan(2.5);
    expect(walled(move(), 1).x).toBeGreaterThan(2.3);
  });

  it('a leap: at where the hero stood (and a little), its bite only where it lands', () => {
    const pounce = leap(shape, open, { reach: 4.2, time: 0.3, bite: 0.6 });
    expect(pounce.hits(move(), { x: 3.2, z: 0 })).toBe(true);
    expect(pounce.hits(move(), { x: 1.5, z: 0 })).toBe(false); // (leapt over)
    expect(pounce.hits(move({ tx: 9 }), { x: 9, z: 0 })).toBe(false); // (out of reach)
  });

  it('a rush: down its strip, catching only who\'s on it, stopped at the rock', () => {
    const charge = rush(shape, open, { long: 4.5, time: 0.5, half: 0.4 });
    expect(charge.hits(move(), { x: 3, z: 0.3 })).toBe(true);
    expect(charge.hits(move(), { x: 3, z: 0.6 })).toBe(false); // (beside it)
    expect(charge.hits(move(), { x: -1, z: 0 })).toBe(false); // (behind it)
    const walled = rush(shape, wallAt(2), { long: 4.5, time: 0.5, half: 0.4 });
    expect(walled.hits(move(), { x: 3.5, z: 0 })).toBe(false); // (past the rock it stopped at)
    expect(onStrip(move(), { x: 1, z: 0 }, 2, 0.4)).toBe(true);
  });

  it('a knock: straight away from the move, as far as said; right on it, thrown all the same', () => {
    expect(knockAway({ x: 0, z: 0 }, { x: 0, z: 2 }, 1.5)).toEqual({ dx: 0, dz: 1.5 });
    const k = knockAway({ x: 1, z: 1 }, { x: 4, z: 5 }, 1);
    expect(Math.hypot(k.dx, k.dz)).toBeCloseTo(1);
    expect(k.dx).toBeCloseTo(0.6);
    expect(Math.hypot(...Object.values(knockAway({ x: 2, z: 2 }, { x: 2, z: 2 }, 0.8)) as [number, number])).toBeCloseTo(0.8);
  });
});
