// The game's clock: the hour, a stretch of hours round midnight, the next time it's a given hour.

import { describe, expect, it } from 'vitest';
import { DAY_MINUTES, between, clockAt, hourAt, nextHour, timeOfDay } from '../src/model/clock';

const H = 60;

describe('the clock', () => {
  it('tells the hour, any day, its minutes a fraction of it', () => {
    expect(hourAt(8 * H)).toBe(8);
    expect(hourAt(8 * H + 30)).toBe(8.5);
    expect(hourAt(3 * DAY_MINUTES + 23 * H)).toBe(23);
    expect(clockAt(DAY_MINUTES + 9 * H + 5)).toEqual({ day: 2, time: '09:05' });
    expect([2, 7, 12, 18].map((h) => timeOfDay(h * H))).toEqual(['night', 'morning', 'day', 'evening']);
  });

  it('says whether it falls in a stretch of hours, round midnight too', () => {
    expect([9, 11, 16, 17].map((h) => between(h * H, 10, 17))).toEqual([false, true, true, false]);
    expect([15, 16, 23, 0, 5, 6].map((h) => between(DAY_MINUTES + h * H, 16, 6))).toEqual([false, true, true, true, true, false]);
  });

  it('finds the next time it is a given hour: today\'s if still to come, else tomorrow\'s', () => {
    expect(nextHour(7 * H, 8)).toBe(8 * H);
    expect(nextHour(8 * H, 8)).toBe(DAY_MINUTES + 8 * H); // (not this very minute)
    expect(nextHour(DAY_MINUTES + 20 * H, 10)).toBe(2 * DAY_MINUTES + 10 * H);
  });
});
