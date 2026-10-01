// Crypts' names (model/crypts/cryptNames.ts): over twenty thousand, no two alike;
// the same for a crypt every time; a man's title only with a man's name.
import { describe, expect, it } from 'vitest';
import { CRYPT_NAMES, cryptName } from '../src/model/crypts/cryptNames';

describe('crypt names', () => {
  it('number over twenty thousand, all different', () => {
    const { places, men, women, nameless, orders, bare } = CRYPT_NAMES;
    const all = new Set<string>();
    for (const place of places) {
      for (const who of [men, women]) for (const title of who.titles) for (const name of who.names) all.add(`the ${place} of ${title} ${name}`);
      for (const one of [...nameless, ...orders]) all.add(`the ${place} of ${one}`);
      for (const word of bare) all.add(`the ${word} ${place}`);
    }
    const counted = places.length * (men.titles.length * men.names.length + women.titles.length * women.names.length + nameless.length + orders.length + bare.length);
    expect(all.size).toBe(counted);
    expect(all.size).toBeGreaterThanOrEqual(20_000);
    expect(men.names.filter((n) => (women.names as readonly string[]).includes(n))).toEqual([]);
  });

  it('are the same for a crypt every time, and never pair a man\'s title with a woman\'s name or the other way', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const name = cryptName(i * 37, i * 11, 5);
      expect(cryptName(i * 37, i * 11, 5)).toBe(name);
      seen.add(name);
      const titled = name.match(/ of (\w+) (\w+)$/);
      if (titled && (CRYPT_NAMES.men.names as readonly string[]).includes(titled[2])) expect(CRYPT_NAMES.men.titles).toContain(titled[1]);
      if (titled && (CRYPT_NAMES.women.names as readonly string[]).includes(titled[2])) expect(CRYPT_NAMES.women.titles).toContain(titled[1]);
    }
    expect(seen.size).toBeGreaterThan(800); // (spread wide)
    expect([...seen].some((n) => / of (Lady|Lord|Sir|Queen|King) /.test(n))).toBe(true); // (the titled among them)
  });
});
