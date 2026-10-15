// The sky over the world: the daylight at an hour, and the weather, both worked out from the seed and the clock alone
// (nothing kept in the save: any game, old or new, has the same sky at the same time). The weather holds a spell of
// WEATHER_HOURS, chosen by a roll of its own (the season's odds), and eases into the next over TURN_HOURS; mist
// gathers in the early morning, and over lakes. Only how things look: nothing in the game goes by it.

import { DAY_MINUTES, hourAt, SEASON_DAYS, SEASONS, seasonAt, yearAt, type Season } from '../clock';
import { hashUnit } from '../../util/random';
import type { Tiles } from '../map/tiles';

export type WeatherKind = 'clear' | 'overcast' | 'rain' | 'fog' | 'windy' | 'snow';

export interface Weather {
  kind: WeatherKind; // the spell's (the one coming, once it's half come in)
  cloud: number; // 0..1, how much of the sky's covered: the light dulled, the shafts gone
  rain: number; // 0..1
  snow: number; // 0..1
  fog: number; // 0..1 (the morning's mist with it)
  wind: number; // 0..1, its steady strength
  gust: number; // 0..1, a gust now (rising and falling over a few seconds)
  windX: number; // which way it blows, on the ground (a unit vector)
  windZ: number;
}

export interface Daylight {
  sun: number; // -1..1, how high the sun is (0 on the horizon, below it at night)
  light: number; // 0..1, the day's light (none at night: the moon's then)
  golden: number; // 0..1, the warm low sun of dawn and evening
  night: number; // 0..1
  rising: boolean; // before noon (a dawn's colours, not a dusk's)
  arc: number; // 0..1, the sun's way across the sky from rising to setting (east to west)
  part: DayPart;
}

export type DayPart = 'night' | 'dawn' | 'morning' | 'day' | 'golden hour' | 'dusk';

export const WEATHER_HOURS = 4; // a spell of weather
export const TURN_HOURS = 1; // the turn from one to the next
const NOON = 13;

type Look = Omit<Weather, 'kind' | 'gust' | 'windX' | 'windZ'>;
const LOOKS: Record<WeatherKind, Look> = {
  clear: { cloud: 0, rain: 0, snow: 0, fog: 0, wind: 0.25 },
  overcast: { cloud: 0.8, rain: 0, snow: 0, fog: 0.1, wind: 0.4 },
  rain: { cloud: 1, rain: 1, snow: 0, fog: 0.15, wind: 0.55 },
  fog: { cloud: 0.5, rain: 0, snow: 0, fog: 1, wind: 0.05 },
  windy: { cloud: 0.3, rain: 0, snow: 0, fog: 0, wind: 0.95 },
  snow: { cloud: 0.9, rain: 0, snow: 1, fog: 0.2, wind: 0.35 },
};

// Each season's odds of each weather.
const ODDS: Record<Season, Partial<Record<WeatherKind, number>>> = {
  spring: { clear: 3, overcast: 2, rain: 3, fog: 1, windy: 1 },
  summer: { clear: 6, overcast: 1, rain: 1, fog: 0.5, windy: 1 },
  autumn: { clear: 2, overcast: 3, rain: 3, fog: 2, windy: 2 },
  winter: { clear: 2, overcast: 3, snow: 3, fog: 2, windy: 1, rain: 0.5 },
};

// How misty each season's mornings are, at the most.
const MORNING_MIST: Record<Season, number> = { spring: 0.5, summer: 0.3, autumn: 0.7, winter: 0.5 };

const PREVAILING = Math.atan2(0.6, 1); // the wind's usual way (the plants' old one: meshes/common/wind.ts)

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The weather of spell `n` (counted from the clock's start), and which way its wind blows.
function spell(seed: number, n: number): { kind: WeatherKind; angle: number } {
  const odds = Object.entries(ODDS[seasonAt(n * WEATHER_HOURS * 60)]) as [WeatherKind, number][];
  let roll = hashUnit(n, seed, 0x5e7) * odds.reduce((sum, [, w]) => sum + w, 0);
  const kind = odds.find(([, w]) => (roll -= w) < 0)?.[0] ?? 'clear';
  return { kind, angle: PREVAILING + (hashUnit(n, seed, 0x3d1) - 0.5) * 2 };
}

// The weather at `minutes` in the world of `seed`.
export function weatherAt(seed: number, minutes: number): Weather {
  const n = Math.floor(minutes / (WEATHER_HOURS * 60));
  const into = (minutes - n * WEATHER_HOURS * 60) / 60;
  const t = smooth(0, TURN_HOURS, into);
  const [was, now] = [spell(seed, n - 1), spell(seed, n)];
  const mix = (k: keyof Look) => LOOKS[was.kind][k] * (1 - t) + LOOKS[now.kind][k] * t;
  const [x, z] = [Math.cos(was.angle) * (1 - t) + Math.cos(now.angle) * t, Math.sin(was.angle) * (1 - t) + Math.sin(now.angle) * t];
  const length = Math.hypot(x, z) || 1;
  const wind = mix('wind');
  // Mist in the early morning (thickest at half past six), blown off by a wind.
  const hour = hourAt(minutes);
  const mist = smooth(4, 6.5, hour) * (1 - smooth(6.5, 9.5, hour)) * MORNING_MIST[seasonAt(minutes)] * (1 - wind);
  return { kind: t < 0.5 ? was.kind : now.kind, cloud: mix('cloud'), rain: mix('rain'), snow: mix('snow'), fog: Math.max(mix('fog'), mist), wind, gust: gustAt(seed, minutes), windX: x / length, windZ: z / length };
}

// A gust at `minutes`: a few waves out of step, so they come unevenly, now and then strong.
function gustAt(seed: number, minutes: number): number {
  const phase = (seed % 1000) * 0.37;
  const wave = Math.sin(minutes * 0.21 + phase) * 0.5 + Math.sin(minutes * 0.53 + phase * 1.7) * 0.35 + Math.sin(minutes * 1.37) * 0.15;
  return Math.max(0, wave) ** 2;
}

// The daylight at `minutes`: the days longest in summer (16 hours), shortest in winter (10), noon at one.
export function daylightAt(minutes: number): Daylight {
  const hour = hourAt(minutes);
  const length = 13 + 3 * Math.cos(((yearAt(minutes) - 1.5) / 4) * Math.PI * 2);
  const [rise, set] = [NOON - length / 2, NOON + length / 2];
  // Through the day, the arc's sine; through the night, a dip below the horizon to midnight's lowest.
  const up = hour >= rise && hour <= set;
  const nightHours = 24 - length;
  const sun = up ? Math.sin(((hour - rise) / length) * Math.PI) : -Math.sin(((((hour - set) % 24) + 24) % 24 / nightHours) * Math.PI);
  const light = smooth(-0.15, 0.35, sun);
  const golden = smooth(-0.2, 0, sun) * (1 - smooth(0.05, 0.6, sun));
  const night = 1 - smooth(-0.25, 0, sun);
  const rising = hour < NOON;
  const arc = up ? (hour - rise) / length : rising ? 0 : 1;
  const part: DayPart = night > 0.6 ? 'night' : sun < 0.12 ? (rising ? 'dawn' : 'dusk') : golden > 0.3 ? (rising ? 'morning' : 'golden hour') : 'day';
  return { sun, light, golden, night, rising, arc, part };
}

// How much of the land round (x, z) is lake (0..1): mist lies over water at dawn, dusk and night.
export function dampAt(tiles: Tiles, x: number, z: number): number {
  let wet = 0;
  for (let i = 0; i < 9; i++) {
    const [dx, dz] = [((i % 3) - 1) * 6, (Math.floor(i / 3) - 1) * 6];
    if (tiles.lake(Math.floor(x + dx), Math.floor(z + dz))) wet++;
  }
  return wet / 9;
}

// The sky at `minutes` in `seed`'s world, all of it (what the view and the HUD read each frame).
export interface Sky {
  season: Season;
  year: number; // 0..4 (clock.ts yearAt)
  weather: Weather;
  daylight: Daylight;
}

// The sky as forced for a look at it (a developer's: ?hour=18&season=autumn&weather=rain), any of them.
export interface SkyForcing {
  hour?: number;
  season?: Season;
  weather?: WeatherKind;
}

export const WEATHER_KINDS = Object.keys(LOOKS) as WeatherKind[];

export function skyAt(seed: number, minutes: number, force: SkyForcing = {}): Sky {
  const at = forcedMinutes(minutes, force);
  const weather = weatherAt(seed, at);
  return { season: seasonAt(at), year: yearAt(at), weather: force.weather ? { ...weather, ...LOOKS[force.weather], kind: force.weather } : weather, daylight: daylightAt(at) };
}

// `minutes` moved to the forced hour of its day, and to the same day of the forced season's week (this year's).
export function forcedMinutes(minutes: number, force: SkyForcing): number {
  let day = Math.floor(minutes / DAY_MINUTES);
  if (force.season) {
    const week = Math.floor(day / SEASON_DAYS);
    day = (week - (((week % 4) + 4) % 4) + SEASONS.indexOf(force.season)) * SEASON_DAYS + (((day % SEASON_DAYS) + SEASON_DAYS) % SEASON_DAYS);
  }
  return day * DAY_MINUTES + (force.hour !== undefined ? force.hour * 60 : minutes - Math.floor(minutes / DAY_MINUTES) * DAY_MINUTES);
}
