// The game's clock: a minute of game time to each second played (an hour a
// real minute, a day every 24), counted only while playing and kept in the
// save. A new game starts on the first day at eight in the morning. No day
// and night yet: just the time.

export const START_MINUTES = 8 * 60; // day 1, 8:00

// The day (from 1) and the time of day ("08:05") at `minutes` of game time.
export function clockAt(minutes: number): { day: number; time: string } {
  const whole = Math.floor(minutes);
  const inDay = whole % (24 * 60);
  const hh = String(Math.floor(inDay / 60)).padStart(2, '0');
  const mm = String(inDay % 60).padStart(2, '0');
  return { day: Math.floor(whole / (24 * 60)) + 1, time: `${hh}:${mm}` };
}

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night';

// Which part of the day it is at `minutes`: morning 6–11, day 11–17, evening 17–21, night 21–6.
export function timeOfDay(minutes: number): TimeOfDay {
  const hour = Math.floor(minutes / 60) % 24;
  return hour >= 6 && hour < 11 ? 'morning' : hour >= 11 && hour < 17 ? 'day' : hour >= 17 && hour < 21 ? 'evening' : 'night';
}
