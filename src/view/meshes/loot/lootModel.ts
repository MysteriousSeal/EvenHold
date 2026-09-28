// What a loot item's voxel model is (junkVoxels.ts, provisionVoxels.ts):
// its palette and how to build its grid, drawn larger than life (0.045
// voxels, about the world's) so it's easy to spot on the ground.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid } from '../voxel/voxelShapes';

export const LOOT_VOXEL_SIZE = 0.045;

export interface LootModel {
  palette: number[];
  build(): VoxelGrid;
}

// A model from a palette and a painter over a grid of `size`.
export const model = (palette: number[], size: [number, number, number], paint: (grid: VoxelGrid) => void): LootModel => ({
  palette,
  build: () => {
    const grid = createGrid(size);
    paint(grid);
    return grid;
  },
});
