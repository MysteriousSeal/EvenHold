// What the weather and the seasons tell the land's growing things (the skies' to set: each frame, or as they change):
// - the season's tint, a multiplier on every leaf, blade and the grass of the ground (1, 1, 1: the land as drawn;
//   autumn warmer and yellower, winter paler and cooler);
// - the wind's strength, how hard every swaying thing sways (1: as it ever was, 0: still, a gale ~2.5), and its way;
// - the snow lying (0..1), under which the ground cover goes.
// Shared uniforms, read by every material the wind sways (wind.ts) and the ground's grass (terrain/voxelGround.ts): one
// value each, no draw more.

import * as THREE from 'three';

export const natureUniforms = {
  uSeasonTint: { value: new THREE.Color(1, 1, 1) },
  uWindStrength: { value: 1 },
  uWindDir: { value: new THREE.Vector2(1, 0.6).normalize() },
  uSnow: { value: 0 },
};

export function setSeasonTint(r: number, g: number, b: number): void {
  natureUniforms.uSeasonTint.value.setRGB(r, g, b);
}

export function setWindStrength(strength: number): void {
  natureUniforms.uWindStrength.value = Math.max(0, strength);
}

export function setWindDirection(x: number, z: number): void {
  natureUniforms.uWindDir.value.set(x, z);
}

export function setSnow(amount: number): void {
  natureUniforms.uSnow.value = Math.min(1, Math.max(0, amount));
}
