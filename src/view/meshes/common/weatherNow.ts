// The weather as the living world feels it (the chimneys' smoke, the small
// life round the hero): which way the wind blows (a unit vector on the
// ground, x and z), how hard (0 still .. 1 a full wind, its gusts with it),
// and how wet, foggy or snowy it is (0..1). The wind blows across the
// screen, a little toward it (so smoke leans off sideways as it rises),
// easing through the day: the weather's own (model/world/weather.ts weatherAt), as the living world reads it.

import { weatherAt } from '../../../model/world/weather';

export interface WeatherNow {
  x: number;
  z: number;
  strength: number;
  rain: number;
  fog: number;
  snow: number;
}

// `minutes`: the game's clock; `seconds`: the moment (kept for its callers: the gusts are the weather's own).
export function weatherNow(seed: number, minutes: number, _seconds: number): WeatherNow {
  const w = weatherAt(seed, minutes);
  return { x: w.windX, z: w.windZ, strength: Math.min(1, w.wind * (0.8 + w.gust)), rain: w.rain, fog: w.fog, snow: w.snow };
}
