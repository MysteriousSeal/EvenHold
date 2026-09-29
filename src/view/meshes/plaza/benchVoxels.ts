// A square's wooden bench (worldgen/benches.ts) at the world's 0.04 voxel
// scale, two seats wide within its tile: a seat of planks along its length
// (light tops, a lit front edge) on four stepped dark legs joined by a
// stretcher, and a backrest behind: two posts, a plank and a top rail, with
// gaps between that read at a distance. It faces +z, the way sitters look;
// the seat's top is 5 voxels up (0.2), where the hips rest.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';

export const BENCH_VOXEL_SIZE = 0.04;
export const BENCH_GRID: [number, number, number] = [22, 11, 9];
// Timber, light to dark, and a little iron at the joints.
export const BENCH_PALETTE = [0xc0925a, 0x9a6a3c, 0x6a4428, 0x4a3020, 0x4a4a52];
const [LIGHT, MID, DARK, DARKEST, IRON] = [1, 2, 3, 4, 5];

export function buildBench(): VoxelGrid {
  const g = createGrid(BENCH_GRID);
  for (const x of [1, 19]) {
    for (const z of [2, 6]) {
      fillBox(g, x, 0, z, x + 1, 0, z + 1, DARKEST); // each leg's foot, a step wider
      fillBox(g, x, 1, z, x + 1, 3, z + 1, DARK);
    }
    fillBox(g, x, 1, 4, x + 1, 1, 5, DARK); // a rail between its front and back legs
  }
  fillBox(g, 3, 1, 4, 18, 1, 5, MID); // the stretcher, end to end
  // The seat: planks along it, alternating, its front edge lit.
  fillBox(g, 0, 4, 1, 21, 4, 8, (_x, _y, z) => (z === 8 ? LIGHT : z % 2 === 0 ? MID : LIGHT));
  for (const x of [1, 20]) fillBox(g, x, 4, 8, x, 4, 8, IRON); // iron at the front corners
  // The backrest: two posts up from the back legs, a plank, and a top rail.
  for (const x of [1, 19]) fillBox(g, x, 5, 0, x + 1, 10, 1, DARK);
  fillBox(g, 0, 7, 0, 21, 8, 0, (_x, y) => (y === 8 ? LIGHT : MID));
  fillBox(g, 0, 10, 0, 21, 10, 1, LIGHT);
  return g;
}
