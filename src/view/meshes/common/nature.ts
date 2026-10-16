// What the weather and the seasons tell the land's growing things (the skies' to set: each frame, or as they change):
// - the season's tint, a multiplier on every leaf, blade and the grass of the ground (1, 1, 1: the land as drawn;
//   autumn warmer and yellower, winter paler and cooler); evergreens (the pines) keep their own;
// - the wind's strength, how hard every swaying thing sways (1: as it ever was, 0: still, a gale ~2.5), and its
//   direction (a unit vector on the ground, world x and z); eased toward the weather's over a second or two, and
//   the sway's own clock slowed as it rises (`tickWind`): a strong wind bends things further and slower, never a
//   faster shake;
// - the snow's cover (0..1: frost ~0.2, a deep fall ~0.85), under which the ground cover sinks away;
// - how far into each season it is (weights, spring, summer, autumn, winter, summing to 1): the broadleaf trees'
//   blossom, their autumn colours and leaf fall, bare in winter (wind.ts `broadleaf`).
// Shared uniforms, read by every material the wind sways (wind.ts) and the ground's grass (terrain/voxelGround.ts): one
// value each, no draw more.

import * as THREE from 'three';

export const natureUniforms = {
  uSeasonTint: { value: new THREE.Color(1, 1, 1) },
  uWindStrength: { value: 1 },
  uWindClock: { value: 0 }, // seconds of sway, run slower in a strong wind (`windPace`)
  uWindDrift: { value: new THREE.Vector2() }, // how far the wind has carried what it carries (the falling leaves), world units
  uWindDir: { value: new THREE.Vector2(1, 0.6).normalize() },
  uSnow: { value: 0 },
  uSeason: { value: new THREE.Vector4(0, 1, 0, 0) }, // spring, summer, autumn, winter
};

export function setSeasonTint(r: number, g: number, b: number): void {
  natureUniforms.uSeasonTint.value.setRGB(r, g, b);
}

const blowing = { target: 1, elapsed: null as number | null };

// How hard the wind should blow (eased toward each frame by `tickWind`).
export function setWindStrength(strength: number): void {
  blowing.target = Math.max(0, strength);
}

export const WIND_EASE_SECONDS = 1.5; // (how long the sway takes to follow a gust, or a change of weather)

// How fast the sway's clock runs at `strength` (1 as it ever was up to a fresh breeze; a gale's ~0.7): the speed
// falls as the bend grows, so the strength shows in how far things lean, not how fast they rock.
export function windPace(strength: number): number {
  return 1 / (1 + 0.25 * Math.max(0, strength - 1));
}

// Each frame (`elapsed`: seconds since the start): the strength eased toward the weather's, the sway's clock and the
// wind's drift moved on by the time since the last.
export function tickWind(elapsed: number): void {
  const u = natureUniforms;
  const dt = blowing.elapsed === null ? 0 : Math.min(0.1, Math.max(0, elapsed - blowing.elapsed)); // (a hitch, a long pause: no leap)
  if (blowing.elapsed === null) u.uWindStrength.value = blowing.target;
  blowing.elapsed = elapsed;
  u.uWindStrength.value += (blowing.target - u.uWindStrength.value) * (1 - Math.exp(-dt / WIND_EASE_SECONDS));
  u.uWindClock.value += dt * windPace(u.uWindStrength.value);
  u.uWindDrift.value.addScaledVector(u.uWindDir.value, dt * u.uWindStrength.value);
}

// Which way the wind blows (x, z on the ground; made a unit vector).
export function setWindDirection(x: number, z: number): void {
  if (x !== 0 || z !== 0) natureUniforms.uWindDir.value.set(x, z).normalize();
}

export function setSnow(cover: number): void {
  natureUniforms.uSnow.value = Math.min(1, Math.max(0, cover));
}

// How far into each season it is: weights, blended across a season's turn (summing to 1).
export function setSeasonWeights(spring: number, summer: number, autumn: number, winter: number): void {
  natureUniforms.uSeason.value.set(spring, summer, autumn, winter);
}
