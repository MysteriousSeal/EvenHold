// The game's clock: a minute of game time to each second played (an hour a
// real minute, a day every 24), counted only while playing and kept in the
// save. A new game starts on the first day at eight in the morning. No day
// and night yet: just the time.

export const START_MINUTES = 8 * 60; // day 1, 8:00
export const DAY_MINUTES = 24 * 60;

// The hour of the day at `minutes` (0 up to 24, its minutes a fraction of it).
export const hourAt = (minutes: number): number => (((minutes / 60) % 24) + 24) % 24;

// Whether `minutes` falls from the hour `from` till `till`, round midnight if it must (16 till 6: the evening and the night).
export function between(minutes: number, from: number, till: number): boolean {
  const hour = Math.floor(hourAt(minutes));
  return from <= till ? hour >= from && hour < till : hour >= from || hour < till;
}

// The next time it's `hour` o'clock after `minutes` (today's, if it's still to come; else tomorrow's).
export function nextHour(minutes: number, hour: number): number {
  const today = Math.floor(minutes / DAY_MINUTES) * DAY_MINUTES + hour * 60;
  return today > minutes ? today : today + DAY_MINUTES;
}

// The day (from 1) and the time of day ("08:05") at `minutes` of game time.
export function clockAt(minutes: number): { day: number; time: string } {
  const whole = Math.floor(minutes);
  const inDay = whole % DAY_MINUTES;
  const hh = String(Math.floor(inDay / 60)).padStart(2, '0');
  const mm = String(inDay % 60).padStart(2, '0');
  return { day: Math.floor(whole / DAY_MINUTES) + 1, time: `${hh}:${mm}` };
}

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

// Which part of the day it is at `minutes`: morning 6–11, day 11–17, evening 17–21, night 21–6.
export function timeOfDay(minutes: number): TimeOfDay {
  const hour = Math.floor(hourAt(minutes));
  return hour >= 6 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'evening' : 'night';
}
