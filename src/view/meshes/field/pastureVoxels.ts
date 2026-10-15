// A field kept as a pasture (model/wildlife/livestock.ts), at the fields'
// 0.04 scale, palette first: meadow greens, a worn, yellower green where
// it's grazed short, bare trodden earth in patches, the trough's weathered
// wood and its water. Every model is one tile (25 x 25 voxels), as the
// wheat's (fieldVoxels.ts).
// - Grass: a voxel of turf over the whole tile (the ground under it is the
//   field's tilled soil), in drifts of green and worn, a bare patch or two,
//   and a few tufts left standing where they don't like to graze.
// - Trough: a long plank trough on two trestles, water in it, the ground
//   round it trodden bare.

import { hashUnit } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

const N = 25;
export const PASTURE_GRID: [number, number, number] = [N, 6, N];
export const PASTURE_VARIANTS = 3;
export const PASTURE_PALETTE = [
  0x6fae4f, // 1 grass
  0x86bf5c, // 2 grass, sunlit
  0x9aa65a, // 3 grazed short
  0x948656, // 4 trodden earth
  0x5e9a44, // 5 tuft
  0x7a5433, // 6 trough wood
  0x5c3f26, // 7 trough wood, dark
  0x5a8ea8, // 8 water
];
const [GRASS, SUNLIT, GRAZED, EARTH, TUFT, WOOD, WOOD_DARK, WATER] = [1, 2, 3, 4, 5, 6, 7, 8];

// The turf, in drifts five voxels across (so it meshes into few faces): mostly green, grazed in places, now and
// then bare; `variant`: which of the few looks (tiles turned and mixed so it doesn't repeat).
export function buildPastureTile(variant: number, bare = 0): VoxelGrid {
  const grid = createGrid(PASTURE_GRID);
  const drift = (x: number, z: number, salt: number) => hashUnit(Math.floor(x / 5) + variant * 7, Math.floor(z / 5), salt);
  for (let x = 0; x < N; x++) {
    for (let z = 0; z < N; z++) {
      const r = drift(x, z, 71);
      const worn = Math.hypot(x - 12, z - 12) < bare; // (trodden round the middle: the trough's tile)
      setColor(grid, x, 0, z, worn ? (hashUnit(x, z, 72) < 0.6 ? EARTH : GRAZED) : r < 0.02 ? EARTH : r < 0.3 ? GRAZED : r < 0.75 ? GRASS : SUNLIT);
    }
  }
  // A few tufts left standing.
  for (let i = 0; i < 4; i++) {
    const [x, z] = [1 + Math.floor(hashUnit(i, variant, 73) * 23), 1 + Math.floor(hashUnit(i, variant, 74) * 23)];
    if (Math.hypot(x - 12, z - 12) < bare) continue;
    fillBox(grid, x, 1, z, x, 1 + Math.floor(hashUnit(i, variant, 75) * 2), z, TUFT);
    setColor(grid, x + 1, 1, z, TUFT);
  }
  return grid;
}

// A plank trough along X on two trestles, water in it.
export function buildTrough(): VoxelGrid {
  const grid = createGrid(PASTURE_GRID);
  for (const x of [6, 18]) fillBox(grid, x, 1, 10, x, 2, 14, WOOD_DARK); // trestles
  fillBox(grid, 5, 3, 10, 19, 5, 14, WOOD); // the trough
  fillBox(grid, 6, 4, 11, 18, 5, 13, WATER); // water to the brim but a voxel
  fillBox(grid, 6, 5, 11, 18, 5, 13, 0);
  for (const x of [5, 19]) fillBox(grid, x, 3, 10, x, 5, 14, WOOD_DARK); // its ends
  return grid;
}
