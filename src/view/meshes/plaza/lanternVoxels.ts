// A square's lantern post at the world's 0.04 voxel scale: a stepped stone
// base, a timber post with a darker band, an iron arm, and a hanging lantern
// (iron cap and frame around glowing glass, meshed with the glow material).

import { HOUSE_WINDOW_COLOR, IRON_COLOR } from '../../constants';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';

export const LANTERN_VOXEL_SIZE = 0.04;
export const LANTERN_GRID: [number, number, number] = [7, 20, 7];
// Sandstone like the well, timber, iron, and the houses' window glass.
export const LANTERN_PALETTE = [0xdcc49c, 0xa88c66, 0x5a3a22, 0x3a281c, IRON_COLOR, HOUSE_WINDOW_COLOR];
const [STONE, STONE_DARK, TIMBER, TIMBER_DARK, IRON, GLASS] = [1, 2, 3, 4, 5, 6];
export const LANTERN_GLOWING = new Set([GLASS]);

// Two arms, along +X and +Z, each with a lantern, so a corner post reaches
// into the square along both of its sides.
export function buildLanternPost(): VoxelGrid {
  const grid = createGrid(LANTERN_GRID);
  fillBox(grid, 1, 0, 1, 5, 0, 5, STONE_DARK); // stepped base
  fillBox(grid, 2, 1, 2, 4, 1, 4, STONE);
  fillBox(grid, 3, 2, 3, 3, 14, 3, (_x, y) => (y === 4 || y === 12 ? TIMBER_DARK : TIMBER)); // post
  for (const [ax, az] of [
    [1, 0],
    [0, 1],
  ]) {
    const lx = 3 + 2 * ax; // lantern center, two voxels out along the arm
    const lz = 3 + 2 * az;
    fillBox(grid, 3, 15, 3, lx, 15, lz, IRON); // arm
    fillBox(grid, lx, 14, lz, lx, 14, lz, IRON); // hook
    fillBox(grid, lx - 1, 13, lz - 1, lx + 1, 13, lz + 1, IRON); // cap
    fillBox(grid, lx - 1, 10, lz - 1, lx + 1, 12, lz + 1, (x, _y, z) => (x === lx || z === lz ? GLASS : IRON)); // glass sides, iron corners
    fillBox(grid, lx - 1, 9, lz - 1, lx + 1, 9, lz + 1, IRON); // base
  }
  return grid;
}
