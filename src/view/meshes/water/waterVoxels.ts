// Voxel lake decor at the world's 0.04 voxel scale, palette first:
// - Lily pads: a blocky 9x9 disc with a slit to its center, a darker rim
//   and a lighter vein, some carrying a pink or white bloom.
// - Reeds: a clump of straight 1x1 stalks of mixed heights, some topped
//   with a brown cattail head, rising from the shallows.
// Only straight, grid-aligned voxels, no diagonals.

import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const WATER_DECOR_VOXEL_SIZE = 0.04;

export const WATER_DECOR_PALETTE = [
  0x4f9a3c, // 1 pad
  0x3c7d30, // 2 pad rim
  0x74b34f, // 3 pad vein
  0xf3a6c8, // 4 pink petal
  0xf6f1e6, // 5 white petal
  0xffd86a, // 6 bloom heart
  0x5f9a3a, // 7 reed stalk
  0x86b84c, // 8 reed stalk, light
  0x7a4a2a, // 9 cattail
];
const PAD = 1;
const PAD_RIM = 2;
const PAD_VEIN = 3;
const PETALS = [4, 5];
const HEART = 6;
const STALKS = [7, 8];
const CATTAIL = 9;

export const LILY_GRID: [number, number, number] = [9, 3, 9];
export const LILY_VARIANTS = 4; // 0-1 plain pads, 2 pink bloom, 3 white bloom
export const REED_GRID: [number, number, number] = [7, 14, 7];
export const REED_VARIANTS = 3;

export function buildLilyPad(variant: number): VoxelGrid {
  const grid = createGrid(LILY_GRID);
  const c = 4;
  const inside = (i: number, k: number) => (i - c) ** 2 + (k - c) ** 2 <= 17;
  for (let i = 0; i < 9; i++) {
    for (let k = 0; k < 9; k++) {
      if (!inside(i, k) || (i === c && k > c)) continue; // the slit runs from the center to the +z edge
      const rim = !inside(i - 1, k) || !inside(i + 1, k) || !inside(i, k - 1) || !inside(i, k + 1);
      setColor(grid, i, 0, k, rim ? PAD_RIM : i === c + 2 || k === c - 2 ? PAD_VEIN : PAD);
    }
  }
  if (variant >= 2) {
    const petal = PETALS[variant - 2];
    // A 3x3 ring of petals with a raised cross above it around the heart.
    for (let i = c - 2; i <= c; i++) for (let k = c - 2; k <= c; k++) setColor(grid, i, 1, k, petal);
    for (const [di, dk] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) setColor(grid, c - 1 + di, 2, c - 1 + dk, petal);
    setColor(grid, c - 1, 2, c - 1, HEART);
  }
  return grid;
}

export function buildReeds(variant: number): VoxelGrid {
  const grid = createGrid(REED_GRID);
  const rng = mulberry32(0x5eed + variant * 7919);
  const [sx, sy, sz] = REED_GRID;
  const stalks = 6 + Math.floor(rng() * 3);
  for (let n = 0; n < stalks; n++) {
    const i = 1 + Math.floor(rng() * (sx - 2));
    const k = 1 + Math.floor(rng() * (sz - 2));
    if (colorAt(grid, i, 0, k) !== 0) continue;
    const height = 7 + Math.floor(rng() * (sy - 7));
    const stalk = STALKS[Math.floor(rng() * STALKS.length)];
    const cattail = rng() < 0.45;
    for (let y = 0; y < height; y++) {
      const head = cattail && y >= height - 4 && y < height - 1; // the tip pokes out above the head
      setColor(grid, i, y, k, head ? CATTAIL : stalk);
    }
  }
  return grid;
}
