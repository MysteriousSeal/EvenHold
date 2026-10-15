// What the weather and the seasons tell the land's growing things (the skies' to set: each frame, or as they change):
// - the season's tint, a multiplier on every leaf, blade and the grass of the ground (1, 1, 1: the land as drawn;
//   autumn warmer and yellower, winter paler and cooler); evergreens (the pines) keep their own;
// - the wind's strength, how hard every swaying thing sways (1: as it ever was, 0: still, a gale ~2.5), and its
//   direction (a unit vector on the ground, world x and z).
// Shared uniforms, read by every material the wind sways (wind.ts) and the ground's grass (terrain/voxelGround.ts): one
// value each, no draw more.

import * as THREE from 'three';

export const natureUniforms = {
  uSeasonTint: { value: new THREE.Color(1, 1, 1) },
  uWindStrength: { value: 1 },
  uWindDir: { value: new THREE.Vector2(1, 0.6).normalize() },
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
