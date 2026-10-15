// The village blacksmith, two tiles long (50 x 25 voxels): a stone
// workshop with a tall forge chimney, and a work yard beside it, open to the
// sky at its front, a lean-to roof over its back half. The yard is packed
// earth with scattered cobbles, soot thick round the work; under the roof
// the forge (a stone hearth, its coals and its mouth glowing out at the
// street), tools hung on the plank wall behind and stacked iron bars; out
// in the open an anvil on a stump, a quench barrel and a heap of scrap. A
// big sign, an anvil throwing sparks, hangs square to the street off a post
// at the yard's front corner. Door faces -Z; the ridge runs along X.

import { hashUnit } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { C, ROOF_SETS } from './housePalette';
import { FOUNDATION_TOP, door, masonry, put, roof, wallsOf, window, type Box } from './houseParts';

export const SMITHY_GRID: [number, number, number] = [50, 42, 25];
const ROOF = 1; // slate
const YARD_X = [26, 48];
const ROOF_FRONT = 11; // the lean-to's front posts (its roof from a row before them to the back)
// Top of the forge chimney, in voxels: where the smoke comes out.
export const SMITHY_SMOKE_ORIGIN: [number, number, number] = [30, 34, 17];

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

// Packed earth with scattered cobbles, soot and iron scraps, the soot thick
// before the forge and round the anvil; a plank back wall, and a lean-to
// roof on posts over the back half, rising toward the back.
function yard(grid: VoxelGrid): void {
  const [x0, x1] = YARD_X;
  fillBox(grid, x0, 0, 0, x1 + 1, 0, 21, (x, _y, z) => {
    const n = hashUnit(x, z);
    const sooty = Math.hypot(x - 30, z - 10) < 5 || Math.hypot(x - 38, z - 6) < 4; // (before the forge; round the anvil)
    return n < 0.07 ? C.stone : n < 0.12 ? C.stoneDark : n < (sooty ? 0.45 : 0.2) ? C.soot : n < 0.23 ? C.iron : n < 0.55 ? C.earthDark : C.earth;
  });
  fillBox(grid, x0, 1, 19, x1, 13, 19, (x, y) => (y % 4 === 0 ? C.timber : x % 2 === 0 ? C.door : C.doorDark));
  for (const x of [x0, x1]) fillBox(grid, x, 1, ROOF_FRONT, x, 13, ROOF_FRONT, C.timber); // front posts
  fillBox(grid, x0, 13, ROOF_FRONT, x1, 13, ROOF_FRONT, C.timber); // lintel beam
  const shades = ROOF_SETS[ROOF];
  for (let z = ROOF_FRONT - 1; z <= 21; z++) {
    const y = 14 + Math.floor((z - ROOF_FRONT + 1) / 4); // rises toward the back
    fillBox(grid, x0 - 1, y, z, x1 + 1, y, z, (x) => (z === ROOF_FRONT - 1 ? shades.dark : (x + z) % 5 === 0 ? shades.light : shades.base));
  }
}

// Stone hearth against the back wall, its coals glowing on top and its
// mouth glowing out at the street, a hood above it, and the chimney rising
// through the lean-to roof, blackened toward its top.
function forge(grid: VoxelGrid): void {
  const [sx, sy, sz] = SMITHY_SMOKE_ORIGIN;
  fillBox(grid, 27, 1, 12, 33, 5, 18, masonry);
  fillBox(grid, 28, 5, 13, 32, 5, 17, (x, _y, z) => {
    const n = hashUnit(x, z);
    return n < 0.3 ? C.emberHot : n < 0.8 ? C.ember : C.coal;
  });
  fillBox(grid, 29, 1, 12, 31, 3, 12, (_x, y) => (y === 1 ? C.emberHot : C.ember)); // its mouth, glowing
  fillBox(grid, 28, 4, 12, 32, 4, 12, C.soot); // sooted over it
  fillBox(grid, 27, 9, 13, 33, 12, 18, masonry); // hood
  fillBox(grid, 28, 9, 14, 32, 9, 17, C.soot); // sooty underside
  fillBox(grid, sx - 2, 13, sz - 2, sx + 2, sy - 1, sz + 1, (x, y, z) => (y >= sy - 2 || (y === sy - 3 && hashUnit(x * 3 + z, y) < 0.5) ? C.soot : masonry(x, y, z))); // the stack, blackened at its top
  fillBox(grid, sx - 3, sy, sz - 3, sx + 3, sy, sz + 2, C.stoneDark); // cap
  fillBox(grid, sx - 1, sy, sz - 1, sx + 1, sy, sz, C.soot); // its flue
}

// Out in the open: an anvil on a tree stump, a hammer left on it, a quench
// barrel beside it, and a heap of scrap (old bars, a rusted blade, a wheel's
// iron tyre) waiting by the forge.
function anvil(grid: VoxelGrid): void {
  fillBox(grid, 37, 1, 5, 39, 3, 7, C.bark);
  fillBox(grid, 37, 4, 6, 39, 4, 6, C.anvil); // waist
  fillBox(grid, 35, 5, 5, 41, 6, 7, (_x, y) => (y === 6 ? C.anvilLight : C.anvil)); // face
  fillBox(grid, 42, 6, 6, 42, 6, 6, C.anvil); // horn
  put(grid, [36, 7, 6], C.iron); // hammer left on the anvil
  put(grid, [37, 7, 6], C.timberLight);
  for (let y = 1; y <= 4; y++) fillBox(grid, 44, y, 6, 46, y, 8, y === 2 ? C.iron : C.barrel);
  fillBox(grid, 45, 4, 7, 45, 4, 7, C.quench);
  fillBox(grid, 27, 1, 4, 31, 1, 7, (x, _y, z) => ((x + z) % 3 === 0 ? C.clayPot : C.iron)); // the scrap: bars, rusting,
  fillBox(grid, 28, 2, 5, 30, 2, 6, C.anvil);
  fillBox(grid, 29, 3, 5, 31, 3, 5, C.clayPot); // a blade,
  fillBox(grid, 26, 1, 3, 26, 4, 3, C.iron); // a tyre leant on the post
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

// The sign, to be known from across the square: a post at the yard's front
// corner, an arm out from its top, and a board hung square to the street
// from two chains, framed in iron, on both faces an anvil in bright iron
// throwing sparks (glowing, by night too).
function sign(grid: VoxelGrid): void {
  const x = YARD_X[1];
  fillBox(grid, x, 1, 1, x, 16, 1, C.timber); // the post
  fillBox(grid, x - 10, 16, 1, x - 1, 16, 1, C.iron); // the arm
  put(grid, [x - 1, 15, 1], C.iron); // braced
  const [b0, b1, y0, y1] = [x - 10, x - 2, 6, 14];
  for (const cx of [b0 + 1, b1 - 1]) put(grid, [cx, 15, 1], C.iron); // its chains
  fillBox(grid, b0, y0, 1, b1, y1, 1, (bx, by) => (bx === b0 || bx === b1 || by === y0 || by === y1 ? C.iron : C.sign)); // framed
  const mid = (b0 + b1) / 2;
  for (const z of [0, 2]) {
    fillBox(grid, mid - 2, y0 + 1, z, mid + 2, y0 + 1, z, C.anvilLight); // the anvil: its foot,
    fillBox(grid, mid - 1, y0 + 2, z, mid + 1, y0 + 2, z, C.anvilLight); // waist,
    fillBox(grid, mid - 2, y0 + 3, z, mid + 3, y0 + 4, z, (_x, y) => (y === y0 + 4 ? C.pewter : C.anvilLight)); // face, lit,
    put(grid, [mid - 3, y0 + 4, z], C.pewter); // horn
    for (const [dx, dy] of [[-2, 6], [0, 7], [1, 6], [3, 7]] as const) put(grid, [mid + dx, y0 + dy, z], C.emberHot); // sparks
  }
}
