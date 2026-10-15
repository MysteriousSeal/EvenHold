// The sky over the world outside, each frame: the light of the hour (a rosy dawn, the golden hour, a violet dusk, a
// blue moonlit night), dulled and greyed by cloud, closed in by fog and mist, rain and snow falling round the hero,
// the season's colours on the land, all from the model's sky (model/world/weather.ts). It sets the lights, the fog,
// the light shafts and the shared sky (sky.ts) others read; it adds nothing to draw but the rain and the snow (a draw
// each, only while they fall). Indoors and underground it's the world outside's, unseen (rooms are lit their own).
//
// The night's kept light enough to see by (foes and paths read at any hour): a moon, and a blue sky glow.

import * as THREE from 'three';
import { dampAt, skyAt, weatherAt } from '../../model/world/weather';
import { SEASONS } from '../../model/clock';
import type { GameModel } from '../../model/GameModel';
import { FOG_FAR, FOG_NEAR, SHAFT_COLOR, SUN_DIRECTION } from '../constants';
import type { Lights } from './lighting';
import type { PostProcessing } from './postprocessing';
import { Precipitation } from './rainView';
import { sky, skyUniforms } from './sky';
import { viewUp } from './stylize';

// The light at a point of the day: the sky's glow and the ground's bounce (the hemisphere), the sun's (or moon's)
// colour and strength, and the fog's (the horizon's, and the background).
interface Light {
  sky: number;
  ground: number;
  fill: number;
  sun: number;
  strength: number;
  fog: number;
}
const DAY: Light = { sky: 0xffe2c4, ground: 0x8a6442, fill: 0.95, sun: 0xffeccc, strength: 1.0, fog: 0xf2c9a8 };
const DAWN: Light = { sky: 0xffc4c8, ground: 0x7d5060, fill: 0.88, sun: 0xffb4a0, strength: 1.0, fog: 0xf0b4b8 };
const GOLDEN: Light = { sky: 0xffc08a, ground: 0x8a4e2c, fill: 0.9, sun: 0xffa040, strength: 1.3, fog: 0xf6aa72 };
const DUSK: Light = { sky: 0xc89cc0, ground: 0x4e3a52, fill: 0.78, sun: 0xff8a6a, strength: 0.55, fog: 0xa886a8 };
const NIGHT: Light = { sky: 0x7088c8, ground: 0x2c3448, fill: 0.68, sun: 0xa8bfff, strength: 0.45, fog: 0x28344f };
const OVERCAST_SKY = 0xc4c8cc; // cloud greys the sky's glow (darker at night: by the light's own brightness)
const FOG_GREY = 0xd6dad8; // the colour of a thick fog by day
const WINTER_AIR = 0xdfe6ee; // the winter's colder haze

const MOON_DIRECTION = new THREE.Vector3(8, 30, 18).normalize();
const SUN_TURN = 1.2; // radians the sun swings round from rising to setting

// Each season's colours for greens (taken at their own lightness: grass and leaves keep their light and shade), how
// far they're turned, and the frost on what faces up.
const SEASON_LOOKS = {
  spring: { tint: 0x9ad45c, tint2: 0xb2dc66, amount: 0.35, frost: 0 },
  summer: { tint: 0xffffff, tint2: 0xffffff, amount: 0, frost: 0 },
  autumn: { tint: 0xb8a640, tint2: 0xc89a3c, amount: 0.6, frost: 0 }, // (the land's ochre; the trees' reds are flora's)
  winter: { tint: 0x9aa898, tint2: 0xa8b2a6, amount: 0.6, frost: 0.22 },
};
const SEASON_TURN = 6 / 7; // how far through a season its colours start turning to the next's (its last day)

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// A colour as a tint taken at a lightness of one (its own shade divided out).
const asTint = (hex: number, into: THREE.Color): THREE.Color => {
  into.setHex(hex);
  return into.multiplyScalar(1 / Math.max(0.05, into.r * 0.299 + into.g * 0.587 + into.b * 0.114));
};

export class SkyView {
  private readonly precipitation: Precipitation;
  private readonly from = new THREE.Color();
  private readonly to = new THREE.Color();
  private readonly fogColor = new THREE.Color();
  private readonly shaftColor = new THREE.Color();
  private readonly sunDirection = new THREE.Vector3();
  private readonly focus = new THREE.Vector3();
  private readonly tintA = new THREE.Color();
  private readonly tintB = new THREE.Color();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly lights: Lights,
    private readonly camera: THREE.Camera,
    pixelRatio: number,
  ) {
    this.precipitation = new Precipitation(scene, pixelRatio);
  }

  // Each frame (indoors too: the world outside's sky kept, for whoever reads it); `ruin`: how far into an old ruin's
  // mist the hero is (no sun's shafts there).
  update(model: GameModel, elapsed: number, post: PostProcessing | null, ruin: number): void {
    const { weather, daylight, season, year } = skyAt(model.seed, model.minutes);
    const { hero } = model;
    sky.outdoors = !model.inside && !model.yard;
    // Mist over lakes, at dawn, in the evening and through the night.
    const damp = dampAt(model.tiles, hero.x, hero.z) * Math.max(daylight.night, daylight.golden) * 0.7;
    const fog = Math.max(weather.fog, damp);
    const wind = weather.wind * (0.8 + weather.gust * 1.0);
    Object.assign(sky, { season, year, weather: weather.kind, rain: weather.rain, snow: weather.snow, fog, cloud: weather.cloud, wind, gust: weather.gust, windX: weather.windX, windZ: weather.windZ, light: daylight.light, night: daylight.night, golden: daylight.golden, part: daylight.part });

    // The hour's light: the day's, warmed low (a dawn's rose, an evening's gold), past the sunset a dusk's violet, then night.
    const twilight = daylight.night * (1 - daylight.night) * 4; // (most just under the horizon)
    const light = this.mixLight(DAY, daylight.rising ? DAWN : GOLDEN, daylight.golden);
    this.mixInto(light, daylight.rising ? DAWN : DUSK, twilight * 0.85);
    this.mixInto(light, NIGHT, daylight.night);
    const { sky: hemi, sun } = this.lights;
    hemi.color.copy(this.from.setHex(light.sky).lerp(this.to.setHex(OVERCAST_SKY).multiplyScalar(0.35 + 0.65 * daylight.light), weather.cloud * 0.6));
    hemi.groundColor.setHex(light.ground);
    hemi.intensity = light.fill * (1 + 0.12 * weather.cloud);
    sun.color.setHex(light.sun);
    sun.intensity = light.strength * (1 - 0.7 * weather.cloud) * (1 - 0.4 * fog);

    // The sun round the sky from rising to setting, higher at noon; the moon's own way at night.
    const turn = Math.atan2(SUN_DIRECTION.z, SUN_DIRECTION.x) + (daylight.arc - 0.5) * SUN_TURN;
    const rise = 0.45 + (Math.asin(SUN_DIRECTION.y) - 0.45) * smooth(0, 0.8, daylight.sun);
    this.sunDirection.set(Math.cos(turn) * Math.cos(rise), Math.sin(rise), Math.sin(turn) * Math.cos(rise)).lerp(MOON_DIRECTION, daylight.night).normalize();
    sun.position.copy(this.sunDirection).multiplyScalar(30);

    // Fog: the hour's horizon, greyed by cloud, paled by a thick fog, colder in winter; nearer the thicker it is
    // (never so near the hero's lost in it: it starts past them, and the nearest things stay clear).
    const fogColor = this.fogColor.setHex(light.fog);
    const brightness = 0.25 + 0.75 * daylight.light;
    fogColor.lerp(this.to.setHex(OVERCAST_SKY).multiplyScalar(brightness), weather.cloud * 0.5);
    fogColor.lerp(this.to.setHex(FOG_GREY).multiplyScalar(brightness), fog * 0.6);
    fogColor.lerp(this.to.setHex(WINTER_AIR).multiplyScalar(brightness), (season === 'winter' ? 0.3 : 0) * (1 - daylight.night));
    const sceneFog = this.scene.fog as THREE.Fog | null;
    if (sceneFog) {
      sceneFog.color.copy(fogColor);
      sceneFog.near = FOG_NEAR - 3 * fog;
      sceneFog.far = FOG_FAR - 8 * fog;
    }
    if (this.scene.background instanceof THREE.Color) this.scene.background.copy(fogColor);
    skyUniforms.uMist.value = fog;

    // The light shafts: a clear sun's alone, its colour.
    this.shaftColor.setHex(SHAFT_COLOR).lerp(this.to.setHex(light.sun), daylight.golden * 0.7);
    post?.setShafts((1 - ruin) * (1 - weather.cloud) * (1 - fog) * smooth(0, 0.2, daylight.sun), this.shaftColor);
    post?.setSun(this.sunDirection);

    // The wind, for the plants (and the smoke).
    skyUniforms.uWindStrength.value = 0.6 + wind * 0.8;
    skyUniforms.uWindDir.value.set(weather.windX, weather.windZ);
    skyUniforms.uWindGust.value = weather.gust;
    skyUniforms.uNight.value = daylight.night;

    this.seasonColours(year, model.seed, model.minutes);
    viewUp.value.set(0, 1, 0).transformDirection(this.camera.matrixWorldInverse);

    this.focus.set(hero.x, model.inside ? hero.y : model.getGroundY(hero.x, hero.z), hero.z);
    const shown = sky.outdoors ? 1 : 0;
    this.precipitation.update(weather.rain * shown, weather.snow * shown, { x: weather.windX, z: weather.windZ, strength: wind }, this.focus, elapsed, brightness);
  }

  // The season's tints, turning to the next's over a season's last day; frost in winter, and snow lying a while
  // after it's fallen (as the wet does after the rain).
  private seasonColours(year: number, seed: number, minutes: number): void {
    const index = Math.floor(year);
    const turn = smooth(SEASON_TURN, 1, year - index);
    const [now, next] = [SEASON_LOOKS[SEASONS[index]], SEASON_LOOKS[SEASONS[(index + 1) % 4]]];
    skyUniforms.uSeasonTint.value.copy(asTint(now.tint, this.tintA)).lerp(asTint(next.tint, this.tintB), turn);
    skyUniforms.uSeasonTint2.value.copy(asTint(now.tint2, this.tintA)).lerp(asTint(next.tint2, this.tintB), turn);
    skyUniforms.uSeasonAmount.value = now.amount + (next.amount - now.amount) * turn;
    let [lying, wet] = [0, 0];
    for (let hours = 0; hours < 6; hours++) {
      const then = weatherAt(seed, minutes - hours * 60);
      lying = Math.max(lying, then.snow * (1 - hours / 8));
      if (hours < 3) wet = Math.max(wet, then.rain * (1 - hours / 3.5));
    }
    const winter = now.frost + (next.frost - now.frost) * turn;
    skyUniforms.uSnowCover.value = Math.min(0.85, winter + lying * 0.7);
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
