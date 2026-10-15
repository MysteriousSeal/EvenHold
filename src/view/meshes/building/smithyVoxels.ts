// The village blacksmith, two tiles long (50 x 25 voxels): a stone
// workshop, soot over its door, and a work yard beside it, open to the sky
// at its front, a lean-to roof over its back half. The yard is packed earth
// with scattered cobbles, soot thick round the work and cinders glowing by
// the forge; the forge at the roof's edge (its coals open to the sky, its
// mouth glowing out at the street, its chimney blackened as it climbs); out
// in the open an anvil on a stump, a quench barrel and bar stock on chocks;
// under the roof tools hung, iron bars stacked and a heap of scrap. Its
// plank back wall, sooted, hung with horseshoes and an iron tyre, coal
// heaped at its foot; and the sign, an iron anvil hung from a wrought
// bracket, a horseshoe under it. Door faces -Z; the ridge runs along X.

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
export const SMITHY_SMOKE_ORIGIN: [number, number, number] = [30, 34, 12];

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

  fillBox(grid, 6, 11, shop.z0, 12, 12, shop.z0, (x, y) => (hashUnit(x, y + 7) < (y === 11 ? 0.8 : 0.45) ? C.soot : masonry(x, y, shop.z0))); // soot over the door

  yard(grid);
  forge(grid);
  anvil(grid);
  tools(grid);
  backWall(grid);
  sign(grid);
  return grid;
}

// The lean-to's roof height at row z (rising toward the back).
const roofAt = (z: number) => 14 + Math.floor((z - ROOF_FRONT + 1) / 4);

// Packed earth with scattered cobbles, soot and iron scraps, the soot thick
// before the forge and round the anvil, cinders glowing by the hearth; a
// plank back wall up to the roof, and a lean-to roof on posts over the back
// half.
function yard(grid: VoxelGrid): void {
  const [x0, x1] = YARD_X;
  fillBox(grid, x0, 0, 0, x1 + 1, 0, 21, (x, _y, z) => {
    const n = hashUnit(x, z);
    const fire = Math.hypot(x - 30, z - 6); // (from before the forge's mouth)
    if (fire < 3.5 && hashUnit(x, z, 3) < 0.25) return C.ember; // cinders, glowing
    const sooty = fire < 5 || Math.hypot(x - 38, z - 6) < 4; // (before the forge; round the anvil)
    return n < 0.07 ? C.stone : n < 0.12 ? C.stoneDark : n < (sooty ? 0.45 : 0.2) ? C.soot : n < 0.23 ? C.iron : n < 0.55 ? C.earthDark : C.earth;
  });
  fillBox(grid, x0, 1, 19, x1, roofAt(19) - 1, 19, (x, y) => (y % 4 === 0 ? C.timber : x % 2 === 0 ? C.door : C.doorDark));
  for (const x of [x0, x1]) fillBox(grid, x, 1, ROOF_FRONT, x, 13, ROOF_FRONT, C.timber); // front posts
  fillBox(grid, x0, 13, ROOF_FRONT, x1, 13, ROOF_FRONT, C.timber); // lintel beam
  const shades = ROOF_SETS[ROOF];
  const [sx, , sz] = SMITHY_SMOKE_ORIGIN;
  for (let z = ROOF_FRONT - 1; z <= 21; z++) {
    const streak = (x: number) => z > sz + 1 && z < sz + 7 && Math.abs(x - sx) <= 2 && hashUnit(x, z, 5) < 0.75 - (z - sz) * 0.1; // soot down the slate from the stack
    fillBox(grid, x0 - 1, roofAt(z), z, x1 + 1, roofAt(z), z, (x) => (streak(x) ? C.soot : z === ROOF_FRONT - 1 ? shades.dark : (x + z) % 5 === 0 ? shades.light : shades.base));
  }
}

// The stone hearth at the roof's edge: its bed of coals open to the sky,
// glowing, its mouth glowing out at the street, a sooted hood at its back,
// and the chimney rising from it through the roof, its courses blackening
// as they climb to a black cap.
function forge(grid: VoxelGrid): void {
  const [sx, sy, sz] = SMITHY_SMOKE_ORIGIN;
  fillBox(grid, 27, 1, 8, 33, 5, 13, masonry);
  fillBox(grid, 28, 5, 9, 32, 5, 12, (x, _y, z) => {
    const n = hashUnit(x, z);
    return n < 0.35 ? C.emberHot : n < 0.85 ? C.ember : C.coal;
  });
  fillBox(grid, 29, 1, 8, 31, 2, 8, (_x, y) => (y === 1 ? C.emberHot : C.ember)); // its mouth, glowing
  fillBox(grid, 28, 3, 8, 32, 3, 8, C.soot); // sooted over it
  fillBox(grid, 27, 9, 12, 33, 12, 13, masonry); // the hood,
  fillBox(grid, 27, 9, 11, 33, 9, 11, C.soot); // its sooty lip
  fillBox(grid, sx - 2, 13, sz - 2, sx + 2, sy - 1, sz + 1, (x, y, z) => (y >= sy - 7 + (hashUnit(x * 3 + z, 1) < 0.5 ? 0 : 2) || (y >= sy - 10 && hashUnit(x * 3 + z, y) < 0.15) ? C.soot : masonry(x, y, z))); // the stack, black over its top courses, streaked below
  fillBox(grid, sx - 3, sy, sz - 3, sx + 3, sy, sz + 2, C.coal); // its cap, black
  fillBox(grid, sx - 1, sy, sz - 1, sx + 1, sy, sz, C.soot); // its flue
}

// Out in the open: an anvil on a tree stump, a hammer left on it, a quench
// barrel beside it (its water dark), and bar stock on two chocks; under the
// roof, a heap of scrap (old bars, a rusted blade) waiting.
function anvil(grid: VoxelGrid): void {
  fillBox(grid, 37, 1, 5, 39, 3, 7, C.bark);
  fillBox(grid, 37, 4, 6, 39, 4, 6, C.anvil); // waist
  fillBox(grid, 35, 5, 5, 41, 6, 7, (_x, y) => (y === 6 ? C.anvilLight : C.anvil)); // face
  fillBox(grid, 42, 6, 6, 42, 6, 6, C.anvil); // horn
  put(grid, [36, 7, 6], C.iron); // hammer left on the anvil
  put(grid, [37, 7, 6], C.timberLight);
  for (let y = 1; y <= 4; y++) fillBox(grid, 44, y, 6, 46, y, 8, y === 2 ? C.iron : C.barrel);
  fillBox(grid, 45, 4, 7, 45, 4, 7, C.quenchDark);
  for (const x of [43, 46]) fillBox(grid, x, 1, 1, x, 1, 3, C.timber); // the chocks,
  fillBox(grid, 42, 2, 1, 47, 2, 3, (x, _y, z) => (z === 2 ? C.earthDark : x === 42 || x === 47 ? C.anvilLight : C.anvil)); // the bars on them, their ends bright
  fillBox(grid, 34, 1, 13, 37, 1, 16, (x, _y, z) => ((x + z) % 3 === 0 ? C.clayPot : C.iron)); // the scrap: bars, rusting,
  fillBox(grid, 35, 2, 14, 36, 2, 15, C.anvil);
  fillBox(grid, 34, 3, 14, 36, 3, 14, C.clayPot); // a blade
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

// The plank back wall's outer face, the one seen from the lane behind:
// sooted along its top, a row of horseshoes and an iron tyre hung on it,
// coal heaped at its foot.
function backWall(grid: VoxelGrid): void {
  const [x0, x1] = YARD_X;
  const top = roofAt(19) - 1;
  fillBox(grid, x0, top - 3, 19, x1, top, 19, (x, y) => (hashUnit(x, y, 4) < (y - top + 4) / 4 ? C.soot : x % 2 === 0 ? C.door : C.doorDark));
  for (const x of [29, 33, 37]) {
    fillBox(grid, x + 1, 8, 20, x + 3, 8, 20, C.anvilLight); // a horseshoe: its toe,
    for (const side of [x, x + 4]) fillBox(grid, side, 9, 20, side, 12, 20, C.anvilLight); // its branches
  }
  for (let y = 1; y <= 13; y++) {
    for (let x = 38; x <= 48; x++) if (Math.abs(Math.hypot(x - 43, y - 7) - 5) < 0.6) put(grid, [x, y, 20], y > 7 ? C.anvilLight : C.anvil); // a cartwheel's iron tyre, lit along its top
  }
  const layers: Array<[number, number]> = [[0, 1], [1, 2], [2, 3]]; // [inset, y] of each step
  for (const [inset, y] of layers) fillBox(grid, 27 + inset, y, 20, 36 - inset, y, 23 - inset, (x, _y, z) => (hashUnit(x, z, y) < 0.25 ? C.soot : C.coal)); // coal, heaped
}

// The sign, to be known from across the square: a wrought-iron bracket
// reaching out toward the street off a post at the yard's front, an iron
// anvil hung from it on two chains (solid, two thick, its face lit, seen
// from along the lane either way), and a horseshoe hung under that.
function sign(grid: VoxelGrid): void {
  const x = YARD_X[1];
  const [z0, z1] = [1, 7]; // the anvil, along z
  fillBox(grid, x, 1, z1 + 1, x, 17, z1 + 1, C.timber); // the post
  fillBox(grid, x, 17, z0, x, 17, z1 + 1, C.iron); // the bracket,
  put(grid, [x, 16, z1], C.iron); // braced
  put(grid, [x, 15, z1 - 1], C.iron);
  put(grid, [x, 17, z0 - 1], C.iron); // curled at its end
  for (const z of [z0 + 1, z1 - 1]) fillBox(grid, x, 15, z, x, 16, z, C.iron); // its chains
  const y0 = 11; // the anvil, four high
  for (const sx of [x - 1, x]) {
    fillBox(grid, sx, y0, z0 + 2, sx, y0, z1 - 1, C.anvil); // its foot,
    fillBox(grid, sx, y0 + 1, z0 + 3, sx, y0 + 1, z1 - 2, C.anvil); // waist,
    fillBox(grid, sx, y0 + 2, z0 + 1, sx, y0 + 2, z1, C.anvil); // face,
    fillBox(grid, sx, y0 + 3, z0, sx, y0 + 3, z1, C.anvilLight); // lit on top, the horn out to one end
  }
  fillBox(grid, x, y0 - 2, 4, x, y0 - 1, 4, C.iron); // a chain under it,
  fillBox(grid, x, y0 - 8, 3, x, y0 - 8, 5, C.iron); // and a horseshoe: its toe,
  for (const z of [2, 6]) fillBox(grid, x, y0 - 7, z, x, y0 - 3, z, C.iron); // its branches
}
