// @vitest-environment happy-dom
// The small pieces everything leans on: the heap under pathfinding, the
// seeded randomness under world generation, the seed in the URL, and the
// near lists that keep only what's round the hero to hand.
import { describe, expect, it } from 'vitest';
import { MinHeap } from '../src/util/MinHeap';
import { Nearby } from '../src/util/nearby';
import { firstRoll, generateRandomSeed, hashCell, hashUnit, mulberry32, shuffle, snapTo } from '../src/util/random';
import { keepSessionSeed, sessionSeed, takeSeedFromUrl } from '../src/util/seed';

describe('the min-heap', () => {
  it('gives back what it holds smallest first', () => {
    const heap = new MinHeap();
    const priorities = [5, 3, 9, 1, 7, 2, 8, 6, 4, 0];
    priorities.forEach((p, i) => heap.push(i, p));
    const out: number[] = [];
    while (heap.size > 0) out.push(heap.pop()[1]);
    expect(out).toEqual([...priorities].sort((a, b) => a - b));
  });

  it('pairs each item with its own priority', () => {
    const heap = new MinHeap();
    heap.push(42, 3);
    heap.push(7, 1);
    expect(heap.pop()).toEqual([7, 1]);
    expect(heap.pop()).toEqual([42, 3]);
  });

  it('takes the same item twice (a key lowered by pushing again)', () => {
    const heap = new MinHeap();
    heap.push(1, 10);
    heap.push(1, 2);
    expect(heap.size).toBe(2);
    expect(heap.pop()).toEqual([1, 2]);
  });

  it.each([1, 10, 100, 1000])('stays sorted with %i random entries', (n) => {
    const rng = mulberry32(n);
    const heap = new MinHeap();
    for (let i = 0; i < n; i++) heap.push(i, rng());
    let last = -Infinity;
    while (heap.size > 0) {
      const [, p] = heap.pop();
      expect(p).toBeGreaterThanOrEqual(last);
      last = p;
    }
  });
});

describe('seeded randomness', () => {
  it.each([0, 1, 42, 12345, 2 ** 31 - 1])('mulberry32(%i) repeats itself, in [0, 1)', (seed) => {
    const [a, b] = [mulberry32(seed), mulberry32(seed)];
    for (let i = 0; i < 50; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('differs from one seed to the next', () => {
    expect(mulberry32(1)()).not.toBe(mulberry32(2)());
  });

  it('spreads evenly enough (each tenth of [0, 1) gets its share)', () => {
    const rng = mulberry32(7);
    const buckets = Array(10).fill(0);
    for (let i = 0; i < 10_000; i++) buckets[Math.floor(rng() * 10)]++;
    for (const n of buckets) expect(n).toBeGreaterThan(850);
  });

  it('shuffles in place, keeping every item, the same on a seed', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const [a, b] = [[...items], [...items]];
    shuffle(a, mulberry32(3));
    shuffle(b, mulberry32(3));
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
    expect(a).not.toEqual(items);
  });

  it.each([
    [0, 0, 0],
    [5, -3, 1],
    [-100, 200, 7],
    [123456, 654321, 99],
  ])('hashes cell (%i, %i) salt %i the same every time, as a whole number and in [0, 1)', (x, z, salt) => {
    expect(hashCell(x, z, salt)).toBe(hashCell(x, z, salt));
    expect(Number.isInteger(hashCell(x, z, salt))).toBe(true);
    expect(hashCell(x, z, salt)).toBeGreaterThanOrEqual(0);
    expect(hashUnit(x, z, salt)).toBeGreaterThanOrEqual(0);
    expect(hashUnit(x, z, salt)).toBeLessThan(1);
  });

  it('gives neighbours and salts values of their own', () => {
    const values = new Set([hashCell(0, 0), hashCell(1, 0), hashCell(0, 1), hashCell(0, 0, 1), hashCell(1, 1)]);
    expect(values.size).toBe(5);
  });

  it.each([
    [0.26, 0.25, 0.25],
    [0.38, 0.25, 0.5],
    [-0.13, 0.25, -0.25],
    [10, 3, 9],
  ])('snaps %f to the nearest multiple of %f', (v, step, snapped) => {
    expect(snapTo(v, step)).toBeCloseTo(snapped);
  });

  it('makes a fresh seed a whole number in range', () => {
    for (let i = 0; i < 20; i++) {
      const seed = generateRandomSeed();
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2 ** 31);
    }
  });
});

describe('the seed in the URL', () => {
  const at = (search: string) => window.history.replaceState(null, '', `/play${search}`);

  it.each([
    ['?seed=42', 42],
    ['?seed=0', 0],
    ['?seed=-7', -7],
    ['?seed=%2012%20', 12],
  ])('reads %s as %i, and takes it out of the address (kept clean)', (search, seed) => {
    at(search);
    expect(takeSeedFromUrl()).toBe(seed);
    expect(window.location.search).toBe('');
    expect(takeSeedFromUrl()).toBeNull(); // (taken: not there again)
  });

  it.each(['', '?seed=', '?seed=abc', '?seed=1.5'])('none in "%s"', (search) => {
    at(search);
    expect(takeSeedFromUrl()).toBeNull();
    expect(new URLSearchParams(window.location.search).has('seed')).toBe(false);
  });

  it('leaves the rest of the address be', () => {
    at('?seed=5&pr=2');
    expect(takeSeedFromUrl()).toBe(5);
    expect(window.location.search).toBe('?pr=2');
  });
});

describe("the tab's world", () => {
  it('kept for a reload; let go, none', () => {
    keepSessionSeed(1234);
    expect(sessionSeed()).toBe(1234);
    keepSessionSeed(0);
    expect(sessionSeed()).toBe(0);
    keepSessionSeed(null);
    expect(sessionSeed()).toBeNull();
  });
});

describe('the first roll', () => {
  it.each([0, 1, 7, 12345, -9, 2 ** 31 - 1, 0xdeadbeef])("is mulberry32(%i)'s first number, without making it", (seed) => {
    expect(firstRoll(seed)).toBe(mulberry32(seed)());
  });
});

describe('Nearby', () => {
  const things = Array.from({ length: 200 }, (_, i) => ({ x: (i % 20) * 10, z: Math.floor(i / 20) * 10 }));
  const near = (list: readonly { x: number; z: number }[], p: { x: number; z: number }, r: number) => list.filter((t) => Math.abs(t.x - p.x) <= r && Math.abs(t.z - p.z) <= r);

  it('holds everything within reach of the point, as the point moves a little and a lot', () => {
    const nearby = new Nearby(things, (t) => t, 25, 10);
    for (const p of [{ x: 50, z: 50 }, { x: 55, z: 52 }, { x: 59, z: 41 }, { x: 150, z: 80 }, { x: 0, z: 0 }]) {
      const got = nearby.near(p);
      for (const t of near(things, p, 25)) expect(got).toContain(t);
    }
  });

  it('takes in what\'s been added to the big list, and drops what\'s gone', () => {
    const list = [...things];
    const nearby = new Nearby(list, (t) => t, 25, 10);
    nearby.near({ x: 50, z: 50 });
    const added = { x: 51, z: 51 };
    list.push(added);
    expect(nearby.near({ x: 50, z: 50 })).toContain(added);
    list.splice(list.indexOf(added), 1);
    expect(nearby.near({ x: 50, z: 50 })).not.toContain(added);
  });

  it('is made afresh now and then even if the big list keeps its length (one gone, another come)', () => {
    const list = [...things];
    const nearby = new Nearby(list, (t) => t, 25, 10);
    nearby.near({ x: 50, z: 50 });
    const swapped = { x: 52, z: 52 };
    list[0] = swapped;
    let seen = false;
    for (let i = 0; i < 40 && !seen; i++) seen = nearby.near({ x: 50, z: 50 }).includes(swapped);
    expect(seen).toBe(true);
  });
});
