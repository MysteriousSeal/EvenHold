// Voxel crop fields at the world's 0.04 scale, palette first (warm soils,
// green-gold stalks, golden grain, weathered fence wood, hay), then shape.
// Every model is one tile (25 x 25 voxels); rows run along local X, and the
// field turns tiles a quarter turn when its rows run along Z.
// - Wheat: tilled rows, two voxels wide, on ridges between dark furrows;
//   stalks of varying height in short runs, heads dithered golden.
// - Corner: a stepped haystack, a wheelbarrow and a basket on bare soil.
// - Fence: a two-rail fence with posts along the tile's local -Z edge.

import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const FIELD_VOXEL_SIZE = 0.04;
const N = 25;
export const FIELD_GRID: [number, number, number] = [N, 11, N];
export const WHEAT_VARIANTS = 3;

export const FIELD_PALETTE = [
  0x6b4a2e, // 1 soil
  0x523822, // 2 furrow
  0x7d5838, // 3 soil, ridge
  0x8e9a3c, // 4 stalk
  0x76823a, // 5 stalk, shaded
  0xe0bb52, // 6 grain
  0xf0d27a, // 7 grain, sunlit
  0xc99a3c, // 8 grain, deep
  0x7a5433, // 9 fence
  0x5c3f26, // 10 fence, post
  0xd9b95a, // 11 hay
  0xb89440, // 12 hay, shaded
  0x8a6238, // 13 barrow wood
  0x3d3d42, // 14 iron
  0xa47a45, // 15 basket
];
const SOIL = 1;
const FURROW = 2;
const RIDGE = 3;
const STALKS = [4, 5];
const GRAIN = [6, 7, 8];
const FENCE = 9;
const POST = 10;
const HAY = 11;
const HAY_SHADE = 12;
const BARROW = 13;
const IRON = 14;
const BASKET = 15;

// Tilled soil: a repeating 4-voxel row pattern across Z (furrow, two crop
// rows, ridge), so rows line up across neighboring tiles.
function soil(grid: VoxelGrid): void {
  for (let i = 0; i < N; i++) for (let k = 0; k < N; k++) setColor(grid, i, 0, k, k % 4 === 0 ? FURROW : k % 4 === 3 ? RIDGE : SOIL);
}

export function buildWheatTile(variant: number): VoxelGrid {
  const grid = createGrid(FIELD_GRID);
  const rng = mulberry32(0x3ea7 + variant * 7919);
  soil(grid);
  for (let k = 0; k < N; k++) {
    if (k % 4 !== 1 && k % 4 !== 2) continue;
    // Heights change in runs of 2-4 stalks, so rows read as ragged but
    // still merge into a few long faces.
    let height = 0;
    for (let i = 0; i < N; ) {
      const run = 2 + Math.floor(rng() * 3);
      height = 6 + Math.floor(rng() * 4);
      const gap = rng() < 0.05;
      for (let r = 0; r < run && i < N; r++, i++) {
        if (gap) continue;
        const stalk = STALKS[k % 4 === 1 ? 0 : 1];
        for (let y = 1; y <= height - 3; y++) setColor(grid, i, y, k, stalk);
        for (let y = height - 2; y <= height; y++) {
          const roll = rng();
          setColor(grid, i, y, k, y === height && roll < 0.5 ? GRAIN[1] : roll < 0.15 ? GRAIN[2] : GRAIN[0]);
        }
      }
    }
  }
  return grid;
}

export function buildCornerTile(): VoxelGrid {
  const grid = createGrid(FIELD_GRID);
  soil(grid);
  // Stepped haystack: each layer one voxel narrower, with shaded courses.
  for (let y = 1; y <= 8; y++) {
    const r = Math.max(1, 6 - Math.floor(y / 2));
    fillBox(grid, 8 - r, y, 12 - r, 8 + r, y, 12 + r, y % 3 === 0 ? HAY_SHADE : HAY);
  }
  // Wheelbarrow: a tray on a wheel with two handles.
  fillBox(grid, 16, 3, 4, 21, 5, 8, BARROW);
  fillBox(grid, 17, 5, 5, 20, 5, 7, 0); // hollow tray
  fillBox(grid, 15, 1, 6, 15, 3, 6, IRON); // wheel
  fillBox(grid, 22, 4, 4, 24, 4, 4, BARROW);
  fillBox(grid, 22, 4, 8, 24, 4, 8, BARROW);
  fillBox(grid, 21, 1, 4, 21, 2, 4, BARROW); // legs
  fillBox(grid, 21, 1, 8, 21, 2, 8, BARROW);
  // A basket of grain.
  fillBox(grid, 17, 1, 17, 20, 3, 20, BASKET);
  fillBox(grid, 18, 3, 18, 19, 3, 19, GRAIN[0]);
  return grid;
}

export function buildFenceSegment(): VoxelGrid {
  const grid = createGrid(FIELD_GRID);
  for (const i of [0, 12, 24]) fillBox(grid, i, 0, 0, i, 7, 0, POST);
  for (const y of [3, 6]) fillBox(grid, 0, y, 0, N - 1, y, 0, FENCE);
  return grid;
}
