// The village blacksmith, two tiles long (50 x 25 voxels): a stone
// workshop with a tall forge chimney, and an open-fronted work yard under a
// lean-to roof. The yard is packed earth with scattered cobbles and soot; in
// it stand the forge (a stone hearth whose coals glow), an anvil on a stump,
// a quench barrel, a tool rack and stacked iron bars. A sign with an anvil
// hangs off the corner post. Door faces -Z; the ridge runs along X.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { C, ROOF_SETS } from './housePalette';
import { FOUNDATION_TOP, door, masonry, put, roof, wallsOf, window, type Box } from './houseParts';

export const SMITHY_GRID: [number, number, number] = [50, 42, 25];
const ROOF = 1; // slate
const YARD_X = [26, 48];
// Top of the forge chimney, in voxels: where the smoke comes out.
export const SMITHY_SMOKE_ORIGIN: [number, number, number] = [30, 34, 17];

// Deterministic per-voxel noise in [0, 1), for scattering yard details.
function speck(x: number, z: number): number {
  const h = Math.imul(x, 73856093) ^ Math.imul(z, 19349663);
  return (Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0) / 4294967296;
}

export function buildSmithyVoxels(): VoxelGrid {
  const grid = createGrid(SMITHY_GRID);

  // Workshop: solid coursed stone on a plinth, under a steep slate gable.
  const shop: Box = { x0: 2, x1: 24, z0: 5, z1: 19, y0: FOUNDATION_TOP + 1, y1: 13 };
  fillBox(grid, shop.x0 - 1, 0, shop.z0 - 1, shop.x1 + 1, FOUNDATION_TOP, shop.z1 + 1, masonry);
  fillBox(grid, shop.x0, shop.y0, shop.z0, shop.x1, shop.y1, shop.z1, masonry);
  const walls = wallsOf(shop);
  door(grid, walls.front, 9, true);
  window(grid, walls.front, 18, 8, true);
  window(grid, walls.back, 12, 8, true);
  window(grid, walls.left, 12, 8, true);
  roof(grid, shop, 11, ROOF);

  yard(grid);
  forge(grid);
  anvil(grid);
  tools(grid);
  sign(grid);
  return grid;
}

// Packed earth with scattered cobbles, soot and iron scraps, under an open
// lean-to roof on posts, with a plank back wall.
function yard(grid: VoxelGrid): void {
  const [x0, x1] = YARD_X;
  fillBox(grid, x0, 0, 0, x1 + 1, 0, 21, (x, _y, z) => {
    const n = speck(x, z);
    return n < 0.07 ? C.stone : n < 0.12 ? C.stoneDark : n < 0.2 ? C.soot : n < 0.23 ? C.iron : n < 0.55 ? C.earthDark : C.earth;
  });
  fillBox(grid, x0, 1, 19, x1, 13, 19, (x, y) => (y % 4 === 0 ? C.timber : x % 2 === 0 ? C.door : C.doorDark));
  for (const x of [x0, x1]) fillBox(grid, x, 1, 3, x, 13, 3, C.timber); // front posts
  fillBox(grid, x0, 13, 3, x1, 13, 3, C.timber); // lintel beam
  const shades = ROOF_SETS[ROOF];
  for (let z = 1; z <= 21; z++) {
    const y = 14 + Math.floor((z - 1) / 4); // rises toward the back
    fillBox(grid, x0 - 1, y, z, x1 + 1, y, z, (x) => (z === 1 ? shades.dark : (x + z) % 5 === 0 ? shades.light : shades.base));
  }
}

// Stone hearth against the back wall with glowing coals, a hood above it,
// and the chimney rising through the lean-to roof.
function forge(grid: VoxelGrid): void {
  const [sx, sy, sz] = SMITHY_SMOKE_ORIGIN;
  fillBox(grid, 27, 1, 12, 33, 5, 18, masonry);
  fillBox(grid, 28, 5, 13, 32, 5, 17, (x, _y, z) => {
    const n = speck(x, z);
    return n < 0.3 ? C.emberHot : n < 0.8 ? C.ember : C.coal;
  });
  fillBox(grid, 27, 9, 13, 33, 12, 18, masonry); // hood
  fillBox(grid, 28, 9, 14, 32, 9, 17, C.soot); // sooty underside
  fillBox(grid, sx - 2, 13, sz - 2, sx + 2, sy - 1, sz + 1, masonry);
  fillBox(grid, sx - 3, sy, sz - 3, sx + 3, sy, sz + 2, C.stoneDark); // cap
}

// An anvil on a tree stump, and a quench barrel beside it.
function anvil(grid: VoxelGrid): void {
  fillBox(grid, 37, 1, 8, 39, 3, 10, C.bark);
  fillBox(grid, 37, 4, 9, 39, 4, 9, C.anvil); // waist
  fillBox(grid, 35, 5, 8, 41, 6, 10, (_x, y) => (y === 6 ? C.anvilLight : C.anvil)); // face
  fillBox(grid, 42, 6, 9, 42, 6, 9, C.anvil); // horn
  put(grid, [36, 7, 9], C.iron); // hammer left on the anvil
  put(grid, [37, 7, 9], C.timberLight);
  for (let y = 1; y <= 4; y++) fillBox(grid, 43, y, 12, 45, y, 14, y === 2 ? C.iron : C.barrel);
  fillBox(grid, 44, 4, 13, 44, 4, 13, C.quench);
}

// Hammers and tongs hanging on the back wall, and iron bars stacked below.
function tools(grid: VoxelGrid): void {
  for (const x of [37, 40, 43]) {
    fillBox(grid, x, 7, 18, x, 10, 18, C.timberLight); // handles
    fillBox(grid, x - 1, 11, 18, x + 1, 11, 18, C.iron); // heads
  }
  fillBox(grid, 38, 1, 16, 46, 1, 17, C.iron);
  fillBox(grid, 39, 2, 16, 45, 2, 16, C.anvilLight);
}

// A sign hanging from the front corner post, with an anvil on both faces.
function sign(grid: VoxelGrid): void {
  const x = YARD_X[1];
  fillBox(grid, x, 12, 0, x, 12, 2, C.iron); // bracket
  fillBox(grid, x, 6, 0, x, 11, 2, C.sign);
  for (const side of [x - 1, x + 1]) {
    fillBox(grid, side, 9, 0, side, 9, 2, C.anvil);
    fillBox(grid, side, 8, 1, side, 8, 1, C.anvil);
    fillBox(grid, side, 7, 0, side, 7, 2, C.anvil);
  }
}
