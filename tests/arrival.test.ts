// A place come to, told once (model/world/arrival.ts: a village come into, a bandit camp's gate come up to), and
// again only once the hero's gone far enough from it; another place found only once they've left the last. And a
// streamed world's village's number (villages/villageNumber.ts), from where it stands and back.
import { describe, expect, it } from 'vitest';
import { Arrival } from '../src/model/world/arrival';
import { villageNumber, villagePlace } from '../src/model/villages/villageNumber';

describe('a place come to', () => {
  const [a, b] = [{ x: 0, z: 0 }, { x: 30, z: 0 }];
  const at = (hero: { x: number; z: number }) => [a, b].find((p) => Math.hypot(hero.x - p.x, hero.z - p.z) <= 5) ?? null;

  it("is told once, again only past `leave` from it; looked for only once they've left the last", () => {
    const arrival = new Arrival<{ x: number; z: number }>((p) => p, 10);
    let looked = 0;
    const come = (x: number) => arrival.arrive({ x, z: 0 }, () => (looked++, at({ x, z: 0 })));
    expect(come(-8)).toBeNull();
    expect(come(-3)).toBe(a);
    expect(arrival.current).toBe(a);
    looked = 0;
    expect([come(4), come(-4), come(9)]).toEqual([null, null, null]); // (about it: not told again, nor looked for)
    expect(looked).toBe(0);
    expect(come(11)).toBeNull(); // (out of it: nothing there)
    expect(arrival.current).toBeNull();
    expect(come(27)).toBe(b);
    expect(come(2)).toBe(a); // (straight back: 28 from b, so b's left)
  });
});

describe("a streamed world's village's number", () => {
  it('is its place, the same each time, and back again', () => {
    const depth = 16384;
    for (const v of [{ x: 0, z: 0 }, { x: 512, z: 9001 }, { x: 16383, z: 16383 }, { x: 7, z: 0 }]) {
      expect(villagePlace(villageNumber(v, depth), depth)).toEqual(v);
      expect(Number.isSafeInteger(villageNumber(v, depth))).toBe(true);
    }
    expect(villageNumber({ x: 1, z: 0 }, depth)).not.toBe(villageNumber({ x: 0, z: 1 }, depth));
  });
});
