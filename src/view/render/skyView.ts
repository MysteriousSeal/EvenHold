// The sky over the world outside, each frame: the light of the hour (a rosy dawn, the golden hour, a violet dusk, a
// blue moonlit night), dulled and greyed by cloud, closed in by fog and mist, rain and snow falling round the hero,
// the season's tint and the wind on the plants (meshes/common/nature.ts), all from the model's sky
// (model/world/weather.ts). It sets the lights, the fog, the light shafts and the bloom, and the shared sky (sky.ts)
// others read; it adds nothing to draw but the rain and the snow (a draw each, only while they fall). Indoors and
// underground it's the world outside's, unseen (rooms are lit their own).
//
// The night's kept light enough to see by (foes and paths read at any hour): a moon, and a blue sky glow, the land a
// third of its day's brightness or more; windows, lanterns and fires glow brighter.

import * as THREE from 'three';
import { dampAt, skyAt, weatherAt, type SkyForcing } from '../../model/world/weather';
import { SEASONS, type Season } from '../../model/clock';
import type { GameModel } from '../../model/GameModel';
import { FOG_FAR, FOG_NEAR, SHAFT_COLOR, SUN_DIRECTION } from '../constants';
import { setSeasonTint, setSnow, setWindDirection, setWindStrength } from '../meshes/common/nature';
import type { Lights } from './lighting';
import type { PostProcessing } from './postprocessing';
import { Precipitation } from './rainView';
import { sky, skyUniforms } from './sky';
import { viewUp } from './stylize';

// The light at a point of the day: the sky's glow and the ground's bounce (the hemisphere), the sun's (or moon's)
// colour and strength, and the fog's (the horizon's, and the background). The art direction's keys (world-design).
interface Light {
  sky: number;
  ground: number;
  fill: number;
  sun: number;
  strength: number;
  fog: number;
}
const DAY: Light = { sky: 0xffe2c4, ground: 0x8a6442, fill: 0.95, sun: 0xffeccc, strength: 1.0, fog: 0xf2c9a8 };
const DAWN: Light = { sky: 0xf2c4c8, ground: 0x7d5060, fill: 0.9, sun: 0xffb98a, strength: 1.0, fog: 0xe8c8d0 };
// (The golden hour's glow a cool lavender, against its orange sun: warm lit faces, cool shaded ones.)
const GOLDEN: Light = { sky: 0xa898c4, ground: 0x6a4a50, fill: 0.85, sun: 0xffa860, strength: 1.6, fog: 0xf0a878 };
const DUSK: Light = { sky: 0x8a7aa8, ground: 0x4e3a52, fill: 0.95, sun: 0xd06a5a, strength: 0.9, fog: 0x7a6a98 };
// (The night's sky glow lighter than the art's 0x3a4a78, the same blue: the land kept at a third of its day's light.)
const NIGHT: Light = { sky: 0x7088c8, ground: 0x2c3448, fill: 0.56, sun: 0x8aa0d8, strength: 0.65, fog: 0x2a3458 }; // (the moon on the tops: canopy and ground lighter than the sides)
const OVERCAST_SKY = 0xc4c8cc; // cloud greys the sky's glow (darker at night: by the light's own brightness)
const FOG_GREY = 0xd6dad8; // the colour of a thick fog by day
const WINTER_AIR = 0xdfe6ee; // the winter's colder haze
const WINTER_SUN = 0xfff4e8; // a winter's pale sun, and its paler sky
const WINTER_SKY = 0xeef0f4;
const AUTUMN_SUN = 0xffd8a8; // an autumn's warmer sun, low all day, and its amber haze
const AUTUMN_AIR = 0xf0c080;

const MOON_DIRECTION = new THREE.Vector3(8, 30, 18).normalize();
const SUN_TURN = 1.2; // radians the sun swings round from rising to setting
const SHAFTS = 0.6; // the shafts at their strongest (against the old, all-day ones)

// Each season's tint on the plants and the ground's grass (flora's: a multiplier), and the frost on what faces up.
const SEASON_LOOKS: Record<Season, { tint: [number, number, number]; frost: number }> = {
  spring: { tint: [0.98, 1.07, 0.94], frost: 0 },
  summer: { tint: [1, 1, 1], frost: 0 },
  autumn: { tint: [1.25, 0.97, 0.72], frost: 0 },
  winter: { tint: [1.05, 1.0, 1.08], frost: 0.35 }, // (frost on the tops all winter, unmistakable)
};
const SEASON_TURN = 6 / 7; // how far through a season it starts turning to the next (its last day)

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class SkyView {
  private readonly precipitation: Precipitation;
  private readonly from = new THREE.Color();
  private readonly to = new THREE.Color();
  private readonly fogColor = new THREE.Color();
  private readonly shaftColor = new THREE.Color();
  private readonly sunDirection = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly lights: Lights,
    private readonly camera: THREE.Camera,
    pixelRatio: number,
    private readonly force: SkyForcing = {}, // (a developer's look at a sky: renderOptions.ts)
  ) {
    this.precipitation = new Precipitation(scene, pixelRatio);
  }

  // Each frame (indoors too: the world outside's sky kept, for whoever reads it); `ruin`: how far into an old ruin's
  // mist the hero is (no sun's shafts there).
  update(model: GameModel, elapsed: number, post: PostProcessing | null, ruin: number): void {
    const { weather, daylight, season, year } = skyAt(model.seed, model.minutes, this.force);
    const { hero } = model;
    sky.outdoors = !model.inside && !model.yard;
    // Mist over lakes, at dawn, in the evening and through the night.
    const damp = dampAt(model.tiles, hero.x, hero.z) * Math.max(daylight.night, daylight.golden) * 0.7;
    const fog = Math.max(weather.fog, damp);
    const wind = weather.wind * (0.8 + weather.gust * 1.0);
    Object.assign(sky, { season, year, weather: weather.kind, rain: weather.rain, snow: weather.snow, fog, cloud: weather.cloud, wind, gust: weather.gust, windX: weather.windX, windZ: weather.windZ, light: daylight.light, night: daylight.night, golden: daylight.golden, part: daylight.part });
    this.seasonLooks(year, model.seed, model.minutes);
    setSnow(skyUniforms.uSnow.value);

    // The hour's light: the day's, warmed low (a dawn's rose, an evening's gold), past the sunset a dusk's rose-red sun
    // on the tops against violet shade, and only once the sun's well down the night's blue.
    const dusk = smooth(0, 0.45, daylight.night) * (1 - smooth(0.5, 1, daylight.night));
    const night = smooth(0.5, 1, daylight.night);
    const light = this.mixLight(DAY, daylight.rising ? DAWN : GOLDEN, daylight.golden);
    this.mixInto(light, daylight.rising ? DAWN : DUSK, dusk);
    this.mixInto(light, NIGHT, night);
    // The season's: a pale sun and sky in winter, a warmer one in autumn (by day).
    const [, , autumn, winter] = skyUniforms.uSeason.value.toArray();
    light.sun = this.from.setHex(light.sun).lerp(this.to.setHex(WINTER_SUN), winter * 0.7 * (1 - night)).lerp(this.to.setHex(AUTUMN_SUN), autumn * 0.5 * (1 - night) * (1 - daylight.golden)).getHex();
    light.sky = this.from.setHex(light.sky).lerp(this.to.setHex(WINTER_SKY), winter * 0.35 * (1 - night)).getHex();
    // Cloud: the sky's glow greyed, the sun dimmed to some 40%, the light flatter (more of it the sky's).
    const { sky: hemi, sun } = this.lights;
    hemi.color.copy(this.from.setHex(light.sky).lerp(this.to.setHex(OVERCAST_SKY).multiplyScalar(0.35 + 0.65 * daylight.light), weather.cloud * 0.75));
    hemi.groundColor.setHex(light.ground);
    hemi.intensity = light.fill * (1 + 0.18 * weather.cloud);
    sun.color.setHex(light.sun);
    sun.intensity = light.strength * (1 - 0.6 * weather.cloud) * (1 - 0.4 * fog);

    // The sun round the sky from rising to setting, high at noon, low (its bands long) at dawn and dusk; the moon's
    // own way at night.
    const turn = Math.atan2(SUN_DIRECTION.z, SUN_DIRECTION.x) + (daylight.arc - 0.5) * SUN_TURN;
    const rise = 0.45 + (Math.asin(SUN_DIRECTION.y) - 0.45) * smooth(0, 0.8, daylight.sun) * (1 - 0.3 * (autumn + winter)); // (lower in autumn and winter)
    this.sunDirection.set(Math.cos(turn) * Math.cos(rise), Math.sin(rise), Math.sin(turn) * Math.cos(rise)).lerp(MOON_DIRECTION, night).normalize();
    sun.position.copy(this.sunDirection).multiplyScalar(30);

    // Fog: the hour's horizon, greyed by cloud, paled by a thick fog, colder in winter; nearer the thicker it is
    // (never so near the hero's lost in it: it starts past them, and the nearest things stay clear).
    const fogColor = this.fogColor.setHex(light.fog);
    const brightness = 0.25 + 0.75 * daylight.light;
    fogColor.lerp(this.to.setHex(OVERCAST_SKY).multiplyScalar(brightness), weather.cloud * 0.5);
    fogColor.lerp(this.to.setHex(FOG_GREY).multiplyScalar(brightness), fog * 0.6);
    fogColor.lerp(this.to.setHex(WINTER_AIR).multiplyScalar(brightness), winter * 0.3 * (1 - night));
    fogColor.lerp(this.to.setHex(AUTUMN_AIR).multiplyScalar(brightness), autumn * 0.2 * (1 - night));
    // (Thinner in the golden hour: the far land in its low light, not veiled.)
    const sceneFog = this.scene.fog as THREE.Fog | null;
    if (sceneFog) {
      sceneFog.color.copy(fogColor);
      sceneFog.near = FOG_NEAR - 3 * fog + 4 * daylight.golden;
      sceneFog.far = FOG_FAR - 8 * fog + 8 * daylight.golden;
    }
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(fogColor);
    skyUniforms.uMist.value = fog;

    // The light shafts: a clear low sun's alone (the morning's, the golden hour's), none at noon, under cloud or at night.
    const low = smooth(0, 0.12, daylight.sun) * (1 - smooth(0.55, 0.8, daylight.sun));
    this.shaftColor.setHex(SHAFT_COLOR).lerp(this.to.setHex(light.sun), daylight.golden * 0.7);
    post?.setShafts(SHAFTS * low * (1 - ruin) * (1 - weather.cloud) * (1 - fog), this.shaftColor);
    post?.setSun(this.sunDirection);
    post?.setBloom(1 + 0.6 * night);

    // The wind and the season, for the plants (flora's), the smoke and the creatures (sky.ts).
    setWindStrength(Math.min(2.5, 0.6 + wind * 1.1));
    setWindDirection(weather.windX, weather.windZ);
    skyUniforms.uWindDir.value.set(weather.windX, weather.windZ);
    skyUniforms.uWindGust.value = weather.gust;
    skyUniforms.uNight.value = night;
    skyUniforms.uDaylight.value = daylight.light;
    viewUp.value.set(0, 1, 0).transformDirection(this.camera.matrixWorldInverse);

    this.focus.set(hero.x, model.inside ? hero.y : model.getGroundY(hero.x, hero.z), hero.z);
    const shown = sky.outdoors ? 1 : 0;
    this.precipitation.update(weather.rain * shown, weather.snow * shown, { x: weather.windX, z: weather.windZ, strength: wind }, this.focus, elapsed, brightness);
  }

  // The season's weights and tint, turning to the next's over a season's last day; frost in winter, and snow lying a
  // while after it's fallen (as the wet does after the rain).
  private seasonLooks(year: number, seed: number, minutes: number): void {
    const index = Math.floor(year);
    const turn = smooth(SEASON_TURN, 1, year - index);
    const [now, next] = [SEASON_LOOKS[SEASONS[index]], SEASON_LOOKS[SEASONS[(index + 1) % 4]]];
    const weights = [0, 0, 0, 0];
    weights[index] = 1 - turn;
    weights[(index + 1) % 4] += turn;
    skyUniforms.uSeason.value.fromArray(weights);
    setSeasonTint(...(now.tint.map((c, i) => c + (next.tint[i] - c) * turn) as [number, number, number]));
    let [lying, wet] = [0, 0];
    const then = this.force.weather ? () => ({ snow: this.force.weather === 'snow' ? 1 : 0, rain: this.force.weather === 'rain' ? 1 : 0 }) : (hours: number) => weatherAt(seed, minutes - hours * 60);
    for (let hours = 0; hours < 6; hours++) {
      const was = then(hours);
      lying = Math.max(lying, was.snow * (1 - hours / 8));
      if (hours < 3) wet = Math.max(wet, was.rain * (1 - hours / 3.5));
    }
    const frost = now.frost + (next.frost - now.frost) * turn;
    skyUniforms.uSnow.value = Math.min(0.85, frost + lying * 0.7);
    skyUniforms.uWet.value = wet;
  }

  private mixLight(a: Light, b: Light, t: number): Light {
    const light = { ...a };
    this.mixInto(light, b, t);
    return light;
  }

  // `light` moved toward `b` by t (its colours blended, as hex).
  private mixInto(light: Light, b: Light, t: number): void {
    if (t <= 0) return;
    for (const key of ['sky', 'ground', 'sun', 'fog'] as const) light[key] = this.from.setHex(light[key]).lerp(this.to.setHex(b[key]), t).getHex();
    light.fill += (b.fill - light.fill) * t;
    light.strength += (b.strength - light.strength) * t;
  }
}
