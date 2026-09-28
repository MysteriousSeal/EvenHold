// Pixel-art dirt and cobblestone textures for roads and village squares.
// Generated in code with fixed seeds, one texture per 1x1 tile (they're
// mapped in world space, so the pattern lines up with the grid), nearest
// filtering so pixels stay crisp like the rest of the blocky world.

import * as THREE from 'three';
import { mulberry32 } from '../../../util/random';

const SIZE = 16;

function colorTexture(pixels: Uint8Array<ArrayBuffer>): THREE.DataTexture {
  const texture = new THREE.DataTexture(pixels, SIZE, SIZE, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function writePixel(pixels: Uint8Array, x: number, y: number, color: THREE.Color): void {
  const i = (((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)) * 4;
  const byte = (v: number) => Math.min(255, Math.round(v * 255));
  pixels.set([byte(color.r), byte(color.g), byte(color.b), 255], i);
}

// sRGB hex -> Color whose r/g/b hold sRGB (not linear) values, for raw pixel bytes.
function srgb(hex: number): THREE.Color {
  return new THREE.Color().setHex(hex, THREE.NoColorSpace);
}

// Packed dirt: flat base with a light sprinkle of darker specks and small
// pale pebbles. Kept sparse — dense per-pixel noise reads as static.
export function createDirtTexture(baseHex: number): THREE.DataTexture {
  const rng = mulberry32(0xd1a7);
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const base = srgb(baseHex);
  const speck = base.clone().multiplyScalar(0.86);
  const pebble = srgb(0xcbbfa7);
  const pebbleShadow = base.clone().multiplyScalar(0.78);

  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) writePixel(pixels, x, y, base);
  for (let i = 0; i < 14; i++) writePixel(pixels, Math.floor(rng() * SIZE), Math.floor(rng() * SIZE), speck);
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(rng() * SIZE);
    const y = Math.floor(rng() * SIZE);
    writePixel(pixels, x, y, pebble);
    writePixel(pixels, x, y - 1, pebbleShadow); // shadow on the lower side
  }
  return colorTexture(pixels);
}

// Cobbles laid in a running bond: 4x4-pixel cells (3x3 stone + 1px mortar
// gap), every other row shifted by half a stone, each stone its own shade
// of grey, with a lighter top edge so they read as slightly domed.
export function createCobbleTexture(): THREE.DataTexture {
  const rng = mulberry32(0xc0bb1e);
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const gap = srgb(0x6e6353);
  const stoneShades = [0x9d998f, 0x8f8b82, 0xaaa69b, 0x86827a];

  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) writePixel(pixels, x, y, gap);

  for (let row = 0; row < SIZE / 4; row++) {
    const shift = row % 2 === 0 ? 0 : 2;
    for (let col = 0; col < SIZE / 4; col++) {
      const stone = srgb(stoneShades[Math.floor(rng() * stoneShades.length)]);
      const highlight = stone.clone().multiplyScalar(1.12);
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          writePixel(pixels, col * 4 + dx + shift, row * 4 + dy, dy === 2 ? highlight : stone);
        }
      }
    }
  }
  return colorTexture(pixels);
}
