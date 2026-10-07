// The shared helpers (src/util/): the item a roll lands on (random.ts oneOf: each an even share of 0..1), a value
// kept for each thing it's asked of (kept.ts: made once), the first letter made a capital (text.ts).
import { describe, expect, it } from 'vitest';
import { oneOf } from '../src/util/random';
import { kept } from '../src/util/kept';
import { capitalize } from '../src/util/text';

describe('the shared helpers', () => {
  it('oneOf: the item a number in 0..1 lands on, each an even share', () => {
    const items = ['a', 'b', 'c', 'd'];
    expect([0, 0.24, 0.25, 0.5, 0.74, 0.75, 0.999].map((u) => oneOf(items, u))).toEqual(['a', 'a', 'b', 'c', 'c', 'd', 'd']);
    expect(oneOf(['only'], 0.7)).toBe('only');
  });

  it('kept: made the first time a thing is asked of, the same given after; each thing its own', () => {
    const keep = kept<object, number[]>();
    let made = 0;
    const [a, b] = [{}, {}];
    const first = keep(a, () => [++made]);
    expect(keep(a, () => [++made])).toBe(first);
    expect(keep(b, () => [++made])).toEqual([2]);
    expect(made).toBe(2);
    const zero = kept<object, number>();
    expect([zero(a, () => 0), zero(a, () => 5)]).toEqual([0, 0]); // (a value that's falsy, kept all the same)
  });

  it('capitalize: the first letter a capital, the rest as it is; nothing, nothing', () => {
    expect(capitalize('the tomb of Lady Morwen')).toBe('The tomb of Lady Morwen');
    expect(capitalize('Ale')).toBe('Ale');
    expect(capitalize('')).toBe('');
  });
});
