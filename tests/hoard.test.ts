// What a chest holds (model/loot/hoard.ts), a crypt lord's, a brood mother's, a bandit camp's: a piece worth at
// least what's asked, coins by the level (its base each level, up to its spread more), the same every time for a
// spot and a salt, others elsewhere.
import { describe, expect, it } from 'vitest';
import { rollHoard } from '../src/model/loot/hoard';
import { ITEMS } from '../src/model/human/equipment';

describe('a hoard', () => {
  it('a piece worth what\'s asked, coins by the level, the same every time; others for other spots', () => {
    const terms = { worth: 100, base: 60, spread: 40 };
    const items = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const level = 1 + (i % 7);
      const hoard = rollHoard(i * 11, i * 5, 9091, level, terms);
      expect(rollHoard(i * 11, i * 5, 9091, level, terms)).toEqual(hoard);
      expect(ITEMS[hoard.item].value ?? 0).toBeGreaterThanOrEqual(100);
      expect(hoard.coins).toBeGreaterThanOrEqual(60 * level);
      expect(hoard.coins).toBeLessThan(100 * level);
      items.add(hoard.item);
    }
    expect(items.size).toBeGreaterThan(5);
    expect(ITEMS[rollHoard(3, 4, 1, 2, { worth: 60, base: 25, spread: 15 }).item].value ?? 0).toBeGreaterThanOrEqual(60);
  });
});
