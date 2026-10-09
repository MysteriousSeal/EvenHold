// A village's salvage bench (worldgen/salvageBenches.ts) at the world's 0.04 voxel: a heavy workbench on two trestles,
// a thick plank top, an iron vice at one end with its screw out to the side, and the work of the day left on it: a
// mallet, a pair of tongs, a few scraps of rusted iron. Its silhouette the vice's: a block up off a slab, so it
// reads as a bench to work at, not to sit on, from the game's height.
import { createGrid, fillBox } from '../voxel/voxelShapes';
import type { VoxelGrid } from '../voxel/greedyMesh';

export const SALVAGE_VOXEL_SIZE = 0.04;
export const SALVAGE_GRID: [number, number, number] = [18, 15, 9]; // along, up, across (one tile is 25 voxels)
// Plank 1, its dark grain 2, the trestles' darker wood 3, iron 4, iron's bright edge 5, rust 6, the mallet's pale wood 7.
export const SALVAGE_PALETTE = [0xb8905e, 0x8a6840, 0x6a4a2c, 0x4a5462, 0x8a96a4, 0x9a4a28, 0xd8c69c];

export function buildSalvageBench(): VoxelGrid {
  const g = createGrid(SALVAGE_GRID);
  // Two trestles: a foot, a post, a crossbar under the top.
  for (const x of [2, 15]) {
    fillBox(g, x - 1, 0, 1, x + 1, 0, 7, 3); // the foot, across
    fillBox(g, x, 1, 3, x, 8, 5, 3); // the post
    fillBox(g, x - 1, 7, 2, x + 1, 8, 6, 3); // the bearer under the top
  }
  fillBox(g, 4, 4, 4, 13, 4, 4, 3); // a stretcher between them
  // The top: a thick slab, its grain in darker runs, an apron along the front.
  fillBox(g, 0, 9, 0, 17, 10, 8, 1);
  for (const z of [2, 5]) fillBox(g, 0, 10, z, 17, 10, z, 2);
  fillBox(g, 0, 8, 0, 17, 8, 0, 2);
  // The vice at the left end: two iron jaws, the screw's handle out to the side, a bright edge on top.
  fillBox(g, 0, 11, 2, 3, 13, 6, 4);
  fillBox(g, 0, 14, 2, 3, 14, 6, 5);
  fillBox(g, 1, 12, 3, 2, 13, 5, 1); // a scrap plank held in the jaws
  fillBox(g, 0, 12, 7, 0, 12, 8, 4); // the screw out the front
  fillBox(g, 0, 11, 8, 0, 13, 8, 5); // its handle, upright
  // A mallet lying along the back: its head a pale block, its handle toward the vice.
  fillBox(g, 11, 11, 6, 14, 13, 7, 7);
  fillBox(g, 6, 11, 6, 10, 11, 6, 3);
  // Tongs along the front: two thin arms meeting at the jaws.
  fillBox(g, 6, 11, 1, 12, 11, 1, 4);
  fillBox(g, 6, 11, 2, 11, 11, 2, 4);
  fillBox(g, 12, 11, 1, 13, 11, 2, 5);
  // Scraps of rusted iron, heaped by the vice's foot.
  fillBox(g, 4, 11, 3, 6, 11, 5, 6);
  fillBox(g, 5, 12, 4, 5, 12, 4, 6);
  fillBox(g, 7, 11, 4, 7, 11, 4, 4);
  return g;
}
