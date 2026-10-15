// The weather as the living world feels it (the chimneys' smoke, the small
// life round the hero): which way the wind blows (a unit vector on the
// ground, x and z), how hard (0 still .. 1 a full wind, its gusts with it),
// how wet, foggy or snowy it is (0..1), and the season. The wind blows across the
// screen, a little toward it (so smoke leans off sideways as it rises),
// easing through the day. It stands in for the weather's own
// (model/world/weather.ts weatherAt: skies'), its body to be theirs:
//   const w = weatherAt(seed, minutes);
//   wind: { x: w.windX, z: w.windZ, strength: min(1, w.wind * (0.8 + w.gust)) }; rain: w.rain, fog: w.fog, snow: w.snow;
//   season: seasonAt(minutes) (model/clock.ts)

const DIRECTION = (() => {
  const [x, z] = [1, -0.6];
  const d = Math.hypot(x, z);
  return { x: x / d, z: z / d };
})();

export interface WeatherNow {
  x: number;
  z: number;
  strength: number;
  rain: number;
  fog: number;
  snow: number;
  season: Season;
}

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

// `minutes`: the time of day (the wind rising and falling over hours); `seconds`: the moment (its gusts).
export function weatherNow(seed: number, minutes: number, seconds: number): WeatherNow {
  const steady = 0.45 + 0.25 * Math.sin(minutes / 170 + (seed % 97));
  const gust = 0.15 * Math.max(0, Math.sin(seconds * 0.7) * Math.sin(seconds * 0.23 + 1));
  return { ...DIRECTION, strength: Math.min(1, Math.max(0, steady + gust)), rain: 0, fog: 0, snow: 0, season: 'summer' }; // (summer: none of the small life kept in by it)
}
