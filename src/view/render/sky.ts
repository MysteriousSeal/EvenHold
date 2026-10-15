// The sky as the view sees it this frame, shared: what anything drawn outdoors may read (the plants' sway, the
// chimneys' smoke, the creatures about at an hour), written once a frame by SkyView (skyView.ts) from the model's
// (model/world/weather.ts), and nowhere else. Read it, don't write it.
//
// - `sky`: plain values, for code run each frame (the smoke's drift, who's out at night).
// - `skyUniforms`: the same as shader uniforms, to hand a material's shader as they are (shader.uniforms.uWindDir =
//   skyUniforms.uWindDir): they change in place, so a material given them once follows the sky with no more work.
//
// The season's tint on the plants and the ground, and how hard they sway, are the plants' own uniforms
// (meshes/common/nature.ts), set from here each frame. The world's materials (stylize.ts) take frost and snow on their
// tops in winter, a darkening in the rain, the moon's blue at night.

import * as THREE from 'three';
import type { DayPart, WeatherKind } from '../../model/world/weather';
import type { Season } from '../../model/clock';

export interface SkyNow {
  outdoors: boolean; // false indoors and underground (no weather there; the values below are the world outside's)
  season: Season;
  year: number; // 0..4 round the year, smoothly (1.5: midsummer)
  weather: WeatherKind;
  rain: number; // 0..1
  snow: number; // 0..1
  fog: number; // 0..1, how thick round the hero (the morning's mist, a lake's, with it)
  cloud: number; // 0..1
  wind: number; // 0..~1.8, how hard it blows now: its steady strength with the gust on it (a calm day ~0.3)
  gust: number; // 0..1
  windX: number; // which way it blows, on the ground (a unit vector, world x and z)
  windZ: number;
  light: number; // 0..1, the day's light
  night: number; // 0..1
  golden: number; // 0..1, the low warm sun (dawn, evening)
  part: DayPart; // 'night' | 'dawn' | 'morning' | 'day' | 'golden hour' | 'dusk'
}

export const sky: SkyNow = {
  outdoors: true,
  season: 'spring',
  year: 0,
  weather: 'clear',
  rain: 0,
  snow: 0,
  fog: 0,
  cloud: 0,
  wind: 0.3,
  gust: 0,
  windX: 0.857,
  windZ: 0.514,
  light: 1,
  night: 0,
  golden: 0,
  part: 'day',
};

export const skyUniforms = {
  uWindDir: { value: new THREE.Vector2(0.857, 0.514) }, // which way it blows (world x, z), a unit vector
  uWindGust: { value: 0 }, // 0..1, a gust now
  uSeason: { value: new THREE.Vector4(1, 0, 0, 0) }, // how much it's each season (spring, summer, autumn, winter), summing to 1: blended over a season's last day
  uDaylight: { value: 1 }, // 0..1, the day's light
  uSnow: { value: 0 }, // 0..1, frost and snow on what faces up
  uWet: { value: 0 }, // 0..1, the rain's darkening
  uNight: { value: 0 }, // 0..1
  uMist: { value: 0 }, // 0..1, extra low mist (a lake's, the morning's) over the hollows
};
