// The sky: the seasons round the year, the daylight through a day, the weather from the seed and the clock alone
// (the same every time, nothing saved), easing from one spell to the next, mist in the mornings and over lakes.

import { describe, expect, it } from 'vitest';
import { DAY_MINUTES, SEASON_DAYS, seasonAt, yearAt } from '../src/model/clock';
import { dampAt, daylightAt, TURN_HOURS, WEATHER_HOURS, weatherAt, type WeatherKind } from '../src/model/world/weather';
import type { Tiles } from '../src/model/map/tiles';

const H = 60;
const WEEK = SEASON_DAYS * DAY_MINUTES;

describe('the seasons', () => {
  it('turn a week each, spring first, round the year and again', () => {
    expect([0, 1, 2, 3, 4, 5].map((w) => seasonAt(w * WEEK + 8 * H))).toEqual(['spring', 'summer', 'autumn', 'winter', 'spring', 'summer']);
    expect(yearAt(1.5 * WEEK)).toBeCloseTo(1.5);
    expect(yearAt(-DAY_MINUTES)).toBeGreaterThan(3.8); // (before the start: winter's end, not a negative year)
  });
});

describe('the daylight', () => {
  it('rises in the morning and sets in the evening, golden low down, the moon out at night', () => {
    const at = (h: number) => daylightAt(3 * DAY_MINUTES + h * H); // (mid-spring: some thirteen hours of day)
    expect(at(13).light).toBe(1);
    expect(at(13).part).toBe('day');
    expect(at(1).night).toBe(1);
    expect(at(1).part).toBe('night');
    expect(at(6.5).rising).toBe(true);
    expect(at(19).rising).toBe(false);
    expect(at(18.5).golden).toBeGreaterThan(0.3); // the golden hour
    expect(at(18.5).part).toBe('golden hour');
    expect(at(20).part).toBe('dusk');
  });

  it('is longest in summer and shortest in winter', () => {
    const lit = (week: number) => Array.from({ length: 96 }, (_, q) => daylightAt(week * WEEK + 3.5 * DAY_MINUTES + q * 15).sun > 0).filter(Boolean).length / 4;
    expect(lit(1)).toBeCloseTo(16, 0); // midsummer's week
    expect(lit(3)).toBeCloseTo(10, 0);
    expect(lit(0)).toBeGreaterThan(lit(3));
  });
});

describe('the weather', () => {
  const seed = 7;
  const kinds = (s: number, from: number, spells: number) => Array.from({ length: spells }, (_, n) => weatherAt(s, from + n * WEATHER_HOURS * H + 2 * H).kind);

  it('is the same for a seed at a time, every time, and differs between worlds', () => {
    expect(weatherAt(seed, 12345)).toEqual(weatherAt(seed, 12345));
    expect(kinds(seed, 0, 40)).not.toEqual(kinds(seed + 1, 0, 40));
  });

  it('holds a spell, every kind turning up in its season, snow only in winter, little rain in summer', () => {
    const tally = (season: number) => {
      const seen = new Map<WeatherKind, number>();
      for (let w = 0; w < 40; w++) for (const k of kinds(seed, (season + w * 4) * WEEK, 42)) seen.set(k, (seen.get(k) ?? 0) + 1);
      return seen;
    };
    const [spring, summer, autumn, winter] = [0, 1, 2, 3].map(tally);
    expect([...spring.keys()].sort()).toEqual(['clear', 'fog', 'overcast', 'rain', 'windy']);
    expect(winter.get('snow')).toBeGreaterThan(0);
    for (const s of [spring, summer, autumn]) expect(s.has('snow')).toBe(false);
    expect(summer.get('clear')!).toBeGreaterThan(summer.get('rain')! * 3);
    expect(autumn.get('rain')!).toBeGreaterThan(summer.get('rain')!);
  });

  it('eases from one spell to the next, nothing jumping from minute to minute', () => {
    for (let m = 0; m < 30 * DAY_MINUTES; m += 7) {
      const [a, b] = [weatherAt(seed, m), weatherAt(seed, m + 1)];
      for (const k of ['cloud', 'rain', 'snow', 'fog', 'wind'] as const) expect(Math.abs(a[k] - b[k])).toBeLessThan(0.05);
      expect(Math.hypot(a.windX, a.windZ)).toBeCloseTo(1);
    }
    // A spell in full a turn's length in: its own look.
    const into = 5 * WEATHER_HOURS * H + (TURN_HOURS + 0.5) * H;
    const now = weatherAt(seed, into);
    if (now.kind === 'rain') expect(now.rain).toBe(1);
    if (now.kind === 'clear') expect(now.cloud).toBe(0);
  });

  it('gusts now and then, between nothing and full', () => {
    const gusts = Array.from({ length: 600 }, (_, m) => weatherAt(seed, m).gust);
    expect(Math.min(...gusts)).toBe(0);
    expect(Math.max(...gusts)).toBeGreaterThan(0.6);
    expect(Math.max(...gusts)).toBeLessThanOrEqual(1);
  });

  it('brings mist in the early morning, gone by noon', () => {
    // A clear, still autumn morning: misty at half past six, not at noon.
    for (let d = 14; d < 21; d++) {
      const dawn = weatherAt(seed, d * DAY_MINUTES + 6.5 * H);
      const noon = weatherAt(seed, d * DAY_MINUTES + 12 * H);
      if (dawn.kind !== 'clear' || noon.kind !== 'clear') continue;
      expect(dawn.fog).toBeGreaterThan(0.4);
      expect(noon.fog).toBe(0);
    }
  });
});

describe('the damp', () => {
  it('is how much of the land round is lake', () => {
    const lakeEast = { lake: (x: number) => x > 100 } as unknown as Tiles;
    expect(dampAt(lakeEast, 50, 50)).toBe(0);
    expect(dampAt(lakeEast, 100, 50)).toBeCloseTo(3 / 9);
    expect(dampAt(lakeEast, 200, 50)).toBe(1);
  });
});
