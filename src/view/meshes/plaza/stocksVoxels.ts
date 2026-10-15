// A square's stocks (model/roads/stocks.ts) at the world's 0.04 voxel scale, within its tile, palette first: old oak
// gone grey-brown in the weather (darker than the benches beside it, so it reads apart), black iron at the hinge and a
// rusted padlock, and what the village has thrown: a broken egg run down the board, a turnip on the ground. A low
// bench behind (its top 4 voxels up, 0.16, where the hips rest) on four legs, and before it the board, no higher:
// two posts capped dark, two planks one over the other, the ankle holes between them. It faces +z, the way the one held looks.
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';

export const STOCKS_VOXEL_SIZE = 0.04;
export const STOCKS_GRID: [number, number, number] = [22, 7, 14];
export const STOCKS_PALETTE = [0x8a7458, 0x6a5640, 0x4a3a2c, 0x2e2622, 0x3c3c44, 0x7a3a22, 0xf0d870, 0xf6f0e0, 0x8a4a8a, 0x6a8a3a];
const [LIGHT, MID, DARK, DARKEST, IRON, RUST, YOLK, WHITE, TURNIP, LEAF] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function buildStocks(): VoxelGrid {
  const g = createGrid(STOCKS_GRID);
  // The bench behind: four legs, a seat of two planks.
  for (const x of [2, 18]) for (const z of [0, 3]) fillBox(g, x, 0, z, x + 1, 2, z + 1, DARK);
  fillBox(g, 1, 3, 0, 20, 3, 4, (_x, _y, z) => (z === 4 ? LIGHT : z % 2 === 0 ? MID : LIGHT));
  // The board, low (no higher than the seat: the legs out through it): two posts, capped; the lower plank, the
  // upper (the ankle holes between, where the two meet).
  for (const x of [0, 20]) {
    fillBox(g, x, 0, 8, x + 1, 5, 9, DARK);
    fillBox(g, x, 6, 8, x + 1, 6, 9, DARKEST);
  }
  fillBox(g, 2, 0, 8, 19, 1, 9, MID);
  fillBox(g, 2, 3, 8, 19, 4, 9, (_x, y) => (y === 4 ? LIGHT : MID));
  for (const x0 of [5, 14]) {
    fillBox(g, x0, 2, 8, x0 + 2, 2, 9, MID); // the wood round each hole
    fillBox(g, x0 + 1, 2, 8, x0 + 1, 2, 9, 0); // the hole itself (the ankle through it)
  }
  fillBox(g, 2, 2, 8, 3, 2, 9, IRON); // the hinge
  fillBox(g, 10, 1, 10, 11, 2, 10, RUST); // the padlock, hung on the front
  fillBox(g, 3, 4, 10, 4, 4, 10, WHITE); // a broken egg on the upper plank, its yolk run down
  fillBox(g, 4, 2, 10, 4, 3, 10, YOLK);
  fillBox(g, 16, 0, 11, 17, 1, 12, TURNIP); // a turnip on the ground before it
  fillBox(g, 16, 1, 12, 16, 1, 12, WHITE);
  fillBox(g, 17, 2, 11, 17, 2, 11, LEAF);
  return g;
}
