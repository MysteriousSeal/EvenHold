// Procedural grass texture for tile tops: a sparse sprinkle of short dark
// blade strokes on flat white, multiplying the tile's green, so one texture
// serves every tier. Built from a DataTexture (no canvas, no image files)
// with nearest filtering, so the pixels stay crisp like the blocky world.

import * as THREE from 'three';
import { mulberry32 } from '../../../util/random';

const SIZE = 16; // pixels per tile edge
// Kept sparse on purpose: denser patterns (or per-pixel speckle noise)
// read as grainy static rather than grass.
const BLADE_STROKES = Math.round(SIZE * SIZE * 0.03); // scales with area, so density per tile stays the same at any SIZE
const BLADE_LENGTH = 2; // pixels
const SEED = 0x6a55;
const BLADE = 0.88; // brightness of a stroke pixel (1 = untouched grass)

function srgbToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export interface GrassTexture {
  texture: THREE.DataTexture;
  // Mean linear brightness; dividing the tile color by this keeps each
  // tile's average shade what it was before texturing.
  meanBrightness: number;
}

export function createGrassTexture(): GrassTexture {
  const rng = mulberry32(SEED);
  const values = new Float32Array(SIZE * SIZE).fill(1);

  // Blade strokes a few pixels tall, so they read as grass rather than noise.
  for (let i = 0; i < BLADE_STROKES; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    for (let dy = 0; dy < BLADE_LENGTH; dy++) values[((y + dy) % SIZE) * SIZE + x] = BLADE;
  }

  const data = new Uint8Array(SIZE * SIZE * 4);
  let linearSum = 0;
  values.forEach((v, i) => {
    const byte = Math.round(v * 255);
    data.set([byte, byte, byte, 255], i * 4);
    linearSum += srgbToLinear(v);
  });

  const texture = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace; // values act as perceptual brightness multipliers
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  return { texture, meanBrightness: linearSum / values.length };
}
