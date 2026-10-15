// What the weather and the seasons tell the land's growing things (the skies' to set: each frame, or as they change):
// - the season's tint, a multiplier on every leaf, blade and the grass of the ground (1, 1, 1: the land as drawn;
//   autumn warmer and yellower, winter paler and cooler); evergreens (the pines) keep their own;
// - the wind's strength, how hard every swaying thing sways (1: as it ever was, 0: still, a gale ~2.5), and its
//   direction (a unit vector on the ground, world x and z);
// - the snow's cover (0..1: frost ~0.2, a deep fall ~0.85), under which the ground cover sinks away;
// - how far into each season it is (weights, spring, summer, autumn, winter, summing to 1): the broadleaf trees'
//   blossom, their autumn colours and leaf fall, bare in winter (wind.ts `broadleaf`).
// Shared uniforms, read by every material the wind sways (wind.ts) and the ground's grass (terrain/voxelGround.ts): one
// value each, no draw more.

import * as THREE from 'three';

export const natureUniforms = {
  uSeasonTint: { value: new THREE.Color(1, 1, 1) },
  uWindStrength: { value: 1 },
  uWindDir: { value: new THREE.Vector2(1, 0.6).normalize() },
  uSnow: { value: 0 },
  uSeason: { value: new THREE.Vector4(0, 1, 0, 0) }, // spring, summer, autumn, winter
};

export function setSeasonTint(r: number, g: number, b: number): void {
  natureUniforms.uSeasonTint.value.setRGB(r, g, b);
}

export function setWindStrength(strength: number): void {
  natureUniforms.uWindStrength.value = Math.max(0, strength);
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
