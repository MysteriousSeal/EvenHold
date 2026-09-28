// A bandit camp at the world's 0.04 voxel scale, palette first: grey fire
// stones, charred and bark-brown logs, glowing flames from deep orange to
// pale yellow; weathered canvas in two shades, timber poles.
// - Campfire: a square ring of stones round crossed logs, flames tapering up.
// - Tent: a stepped A-frame of canvas, ridge along X, open at the -X end
//   (the fire side) with a dark inside, poles at both ends.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const CAMP_VOXEL_SIZE = 0.04;
export const CAMP_PALETTE = [
  0x8e8b82, // 1 stone
  0x6f6c64, // 2 stone, dark
  0x5c4330, // 3 log bark
  0x2b2522, // 4 charred
  0xff7a2a, // 5 flame, deep
  0xffb347, // 6 flame
  0xffe39a, // 7 flame, heart
  0xd8c7a6, // 8 canvas
  0xb3a283, // 9 canvas, shade
  0x5a3a22, // 10 pole
  0x2e2620, // 11 tent inside
];
const [STONE, STONE_DARK, BARK, CHAR, FLAME_DEEP, FLAME, FLAME_HEART, CANVAS, CANVAS_SHADE, POLE, INSIDE] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
export const CAMP_GLOWING = new Set([FLAME_DEEP, FLAME, FLAME_HEART]);

export const FIRE_GRID: [number, number, number] = [11, 8, 11];
export const TENT_GRID: [number, number, number] = [23, 13, 21];

export function buildCampfire(): VoxelGrid {
  const grid = createGrid(FIRE_GRID);
  for (let x = 1; x <= 9; x++) {
    for (let z = 1; z <= 9; z++) {
      const ring = Math.max(Math.abs(x - 5), Math.abs(z - 5)) === 4;
      if (ring && (x + z) % 2 === 0) setColor(grid, x, 0, z, (x * 3 + z) % 3 === 0 ? STONE_DARK : STONE);
    }
  }
  fillBox(grid, 2, 0, 5, 8, 0, 5, (x) => (x === 5 ? CHAR : BARK)); // crossed logs
  fillBox(grid, 5, 1, 2, 5, 1, 8, (_x, _y, z) => (z === 5 ? CHAR : BARK));
  fillBox(grid, 4, 1, 4, 6, 2, 6, (x, y, z) => (x === 5 && z === 5 ? FLAME_HEART : y === 1 ? FLAME_DEEP : FLAME));
  fillBox(grid, 5, 3, 5, 5, 4, 5, (_x, y) => (y === 3 ? FLAME : FLAME_HEART));
  setColor(grid, 4, 3, 5, FLAME_DEEP);
  setColor(grid, 5, 5, 5, FLAME);
  return grid;
}

export function buildTent(): VoxelGrid {
  const grid = createGrid(TENT_GRID);
  const [sx, , sz] = TENT_GRID;
  const mid = (sz - 1) / 2;
  for (let y = 0; y < 12; y++) {
    const half = mid - Math.floor((y * mid) / 12); // stepped slope
    for (const side of [-1, 1]) {
      for (let d = 0; d <= 1; d++) {
        const z = mid + side * Math.max(0, half - d);
        fillBox(grid, 1, y, z, sx - 2, y, z, (x) => (side < 0 || (x + y) % 5 === 0 ? CANVAS_SHADE : CANVAS));
      }
    }
    fillBox(grid, sx - 2, y, mid - half, sx - 2, y, mid + half, CANVAS); // closed back end
    fillBox(grid, 1, y, mid - half + 1, 1, y, mid + half - 1, INSIDE); // dark doorway
  }
  for (const x of [0, sx - 1]) fillBox(grid, x, 0, mid, x, 12, mid, POLE);
  fillBox(grid, 0, 12, mid, sx - 1, 12, mid, POLE); // ridge pole
  return grid;
}
