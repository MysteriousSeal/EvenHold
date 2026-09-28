// A square's lamp post at the world's 0.04 voxel scale: a stepped sandstone
// base, a timber post with dark bands and an iron collar, and on top a
// lantern: a 5x5 iron cage whose corner posts frame three-voxel glass panes
// on all four sides (so it shines into the square whichever corner it's
// on), under a stepped iron roof and finial. The glass is meshed with the
// glowing material.

import { HOUSE_WINDOW_COLOR, IRON_COLOR } from '../../constants';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';

export const LANTERN_VOXEL_SIZE = 0.04;
export const LANTERN_GRID: [number, number, number] = [7, 19, 7];
// Sandstone like the well, timber, iron (dark and catching the light), and
// the houses' window glass.
export const LANTERN_PALETTE = [0xdcc49c, 0xa88c66, 0x5a3a22, 0x3a281c, IRON_COLOR, 0x62626b, HOUSE_WINDOW_COLOR];
const [STONE, STONE_DARK, TIMBER, TIMBER_DARK, IRON, IRON_LIGHT, GLASS] = [1, 2, 3, 4, 5, 6, 7];
export const LANTERN_GLOWING = new Set([GLASS]);

export function buildLanternPost(): VoxelGrid {
  const grid = createGrid(LANTERN_GRID);
  const c = 3; // center column
  fillBox(grid, 1, 0, 1, 5, 0, 5, STONE_DARK); // stepped base
  fillBox(grid, 2, 1, 2, 4, 1, 4, STONE);
  fillBox(grid, c, 2, c, c, 9, c, (_x, y) => (y === 3 || y === 8 ? TIMBER_DARK : TIMBER)); // post
  fillBox(grid, c - 1, 10, c - 1, c + 1, 10, c + 1, IRON); // collar

  // Lantern cage: iron rings top and bottom, iron corner posts, glass panes.
  fillBox(grid, 1, 11, 1, 5, 11, 5, IRON);
  fillBox(grid, 1, 12, 1, 5, 14, 5, (x, _y, z) => {
    const corner = (x === 1 || x === 5) && (z === 1 || z === 5);
    return corner ? IRON : GLASS;
  });
  fillBox(grid, 1, 15, 1, 5, 15, 5, IRON_LIGHT);
  // Stepped roof and finial.
  fillBox(grid, 2, 16, 2, 4, 16, 4, IRON);
  fillBox(grid, c, 17, c, c, 17, c, IRON_LIGHT);
  fillBox(grid, c, 18, c, c, 18, c, IRON);
  return grid;
}
