// Voxel ground cover at the world's 0.04 voxel scale, palette first:
// - Grass tufts: clusters of 1x1 upright blades, taller toward the middle,
//   shaded root -> tip. The palette is near-white multipliers; each tuft is
//   tinted with its tile's green, so one model serves every tier.
// - Flowers: a short stem with a cross-shaped bloom around a heart.
// - Pebbles: clusters of 2-4 small stepped stones, some with mossy tops.
// Straight, grid-aligned voxels only.

import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const COVER_VOXEL_SIZE = 0.04;

export const COVER_PALETTE = [
  0xd9d9d9, // 1 blade root (tinted by the tile green)
  0xebebe6, // 2 blade middle
  0xf7f7e8, // 3 blade tip, warm
  0x4d7a3a, // 4 stem
  0xf1eee4, // 5 white petal
  0xe8c547, // 6 yellow petal
  0x9a6bc4, // 7 purple petal
  0xffd35c, // 8 heart, gold
  0xd9822b, // 9 heart, orange (on yellow blooms)
  0x9a978f, // 10 stone
  0x86837c, // 11 stone, dark
  0xb0ada5, // 12 stone, light
  0x5f8a3e, // 13 moss
];
const BLADE = [1, 2, 3];
const STEM = 4;
const PETALS = [5, 6, 7]; // matches the scatter's flower color variants
const HEART = 8;
const HEART_ON_YELLOW = 9;
const STONES = [10, 11, 12];
const MOSS = 13;

// Tufts come in size classes (small at meadow edges, large in lush
// centers) and a few shapes each. Tallest blades by class, in voxels:
export const TUFT_SIZES = [4, 6, 8];
export const TUFT_SHAPES = 3;
export const TUFT_GRID: [number, number, number] = [7, 8, 7];
export const FLOWER_GRID: [number, number, number] = [3, 5, 3];
export const FLOWER_HEIGHTS = 2; // stem-length variants
export const PEBBLE_GRID: [number, number, number] = [8, 3, 8];
export const PEBBLE_SHAPES = 6; // the upper half are mossy

export function buildTuft(size: number, shape: number): VoxelGrid {
  const grid = createGrid(TUFT_GRID);
  const rng = mulberry32(0x7af7 + size * 101 + shape * 7919);
  const tallest = TUFT_SIZES[size];
  const blades = 7 + Math.floor(rng() * 4);
  for (let n = 0; n < blades; n++) {
    // Blades crowd the middle and get shorter toward the tuft's edge.
    const i = 3 + Math.round((rng() - 0.5) * (n < 3 ? 2 : 5));
    const k = 3 + Math.round((rng() - 0.5) * (n < 3 ? 2 : 5));
    if (colorAt(grid, i, 0, k) !== 0) continue;
    const edge = Math.max(Math.abs(i - 3), Math.abs(k - 3));
    const height = Math.max(2, tallest - edge - Math.floor(rng() * 2));
    for (let y = 0; y < height; y++) {
      const t = y / (height - 1);
      setColor(grid, i, y, k, BLADE[t < 0.4 ? 0 : t < 0.85 ? 1 : 2]);
    }
  }
  return grid;
}

export function buildFlower(color: number, height: number): VoxelGrid {
  const grid = createGrid(FLOWER_GRID);
  const stem = 2 + height; // 2-3 voxels
  for (let y = 0; y < stem; y++) setColor(grid, 1, y, 1, STEM);
  const petal = PETALS[color];
  for (const [di, dk] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) setColor(grid, 1 + di, stem, 1 + dk, petal);
  setColor(grid, 1, stem, 1, color === 1 ? HEART_ON_YELLOW : HEART);
  setColor(grid, 1, stem + 1, 1, petal); // a petal tuft on top gives the bloom some height
  return grid;
}

export function buildPebbles(shape: number): VoxelGrid {
  const grid = createGrid(PEBBLE_GRID);
  const rng = mulberry32(0x9eb1 + shape * 104729);
  const mossy = shape >= PEBBLE_SHAPES / 2;
  const stones = 2 + Math.floor(rng() * 3);
  for (let n = 0; n < stones; n++) {
    // The first stone is the biggest; the rest are pebbles around it.
    const w = n === 0 ? 3 + Math.floor(rng() * 2) : 2;
    const d = n === 0 ? 3 : 1 + Math.floor(rng() * 2);
    const i0 = n === 0 ? 2 : Math.floor(rng() * (8 - w));
    const k0 = n === 0 ? 2 : Math.floor(rng() * (8 - d));
    const color = STONES[Math.floor(rng() * STONES.length)];
    const tall = n === 0 && w > 2;
    for (let i = i0; i < i0 + w; i++) {
      for (let k = k0; k < k0 + d; k++) {
        setColor(grid, i, 0, k, color);
        // Stepped top: the upper layer is inset by a voxel on each side.
        const inner = i > i0 && i < i0 + w - 1 && k >= k0 && k < k0 + d - (d > 2 ? 1 : 0);
        if (tall && inner) setColor(grid, i, 1, k, mossy ? MOSS : color);
        else if (mossy && n === 0 && rng() < 0.5) setColor(grid, i, 0, k, MOSS);
      }
    }
  }
  return grid;
}
