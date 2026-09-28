// The village inn, two tiles long (50 x 25 voxels): the biggest building
// on the square. A two-storey hall (coursed stone below, a jettied
// half-timbered floor above with a timber balcony over the door), a
// hanging tankard sign, a table with benches, barrels and a lantern post
// out front, and an open stable lean-to with hay bales at one end.
// Door faces -Z; the ridge runs along X.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { C, ROOF_SETS } from './housePalette';
import { FOUNDATION_TOP, braces, chimney, door, masonry, put, roof, timberStorey, wallsOf, window, type Box } from './houseParts';

export const INN_GRID: [number, number, number] = [50, 48, 25];
const ROOF = 0; // clay tiles
const HALL_X = [2, 33]; // stone hall walls
const STABLE_X = [36, 48];

export function buildInnVoxels(): VoxelGrid {
  const grid = createGrid(INN_GRID);

  // Hall: stone ground floor on a plinth, jettied timber floor above.
  const ground: Box = { x0: HALL_X[0], x1: HALL_X[1], z0: 5, z1: 19, y0: FOUNDATION_TOP + 1, y1: 11 };
  fillBox(grid, ground.x0 - 1, 0, ground.z0 - 1, ground.x1 + 1, FOUNDATION_TOP, ground.z1 + 1, masonry);
  fillBox(grid, ground.x0, ground.y0, ground.z0, ground.x1, ground.y1, ground.z1, masonry);
  const upper: Box = { x0: ground.x0 - 1, x1: ground.x1 + 1, z0: ground.z0 - 1, z1: ground.z1 + 1, y0: ground.y1 + 1, y1: 24 };
  timberStorey(grid, upper);

  const doorU = 17;
  const g = wallsOf(ground);
  const u = wallsOf(upper);
  door(grid, g.front, doorU, true);
  for (const x of [7, 27]) window(grid, g.front, x, 7, true);
  for (const x of [9, 17, 25]) window(grid, g.back, x, 7, true);
  for (const wall of [g.left, g.right]) window(grid, wall, 12, 7, true);

  const upperY = Math.round((upper.y0 + upper.y1) / 2);
  for (const wall of [u.front, u.back]) {
    braces(grid, wall, upper.x0, upper.x1, upper.y0, upper.y1, doorU);
    for (const x of [6, 12, 22, 28]) window(grid, wall, x, upperY, false);
  }
  window(grid, u.front, doorU, upperY, false);
  for (const wall of [u.left, u.right]) window(grid, wall, 12, upperY, false);

  // Balcony over the door: plank floor on two brackets, posts and a rail.
  const bz0 = upper.z0 - 3;
  fillBox(grid, doorU - 5, upper.y0, bz0, doorU + 5, upper.y0, upper.z0 - 1, C.timberLight);
  for (const x of [doorU - 5, doorU + 5]) {
    fillBox(grid, x, upper.y0 - 2, upper.z0 - 1, x, upper.y0 - 1, upper.z0 - 1, C.timber); // brackets
    fillBox(grid, x, upper.y0 + 1, bz0, x, upper.y0 + 3, bz0, C.timber); // corner posts
  }
  fillBox(grid, doorU - 5, upper.y0 + 3, bz0, doorU + 5, upper.y0 + 3, bz0, C.timber);
  for (let x = doorU - 3; x <= doorU + 3; x += 2) fillBox(grid, x, upper.y0 + 1, bz0, x, upper.y0 + 2, bz0, C.timberLight);

  const ridge = roof(grid, upper, 14, ROOF);
  chimney(grid, upper, ridge);
  tankardSign(grid, upper);
  seating(grid);
  stable(grid);
  return grid;
}

// A board hanging from an iron bracket off the upper floor's corner, in
// the 4-voxel strip between the wall and the tile edge, with a foaming
// tankard on both faces.
function tankardSign(grid: VoxelGrid, upper: Box): void {
  const x = upper.x1 - 2;
  const top = upper.y0 + 6;
  fillBox(grid, x, top, 0, x, top, upper.z0 - 1, C.iron); // bracket
  fillBox(grid, x, top - 1, 0, x, top - 1, 0, C.iron);
  fillBox(grid, x, top - 1, 2, x, top - 1, 2, C.iron);
  fillBox(grid, x, top - 7, 0, x, top - 2, 2, C.sign);
  for (const sx of [x - 1, x + 1]) {
    fillBox(grid, sx, top - 6, 0, sx, top - 4, 1, C.pewter); // mug
    fillBox(grid, sx, top - 3, 0, sx, top - 3, 1, C.beerFoam);
    put(grid, [sx, top - 5, 2], C.pewter); // handle
  }
}

// Out front: a table between two benches, two barrels by the door and a
// lantern post.
function seating(grid: VoxelGrid): void {
  fillBox(grid, 5, 3, 1, 11, 3, 2, C.tableWood); // table top
  for (const x of [5, 11]) fillBox(grid, x, 0, 1, x, 2, 2, C.timber);
  for (const z of [0, 3]) {
    fillBox(grid, 5, 1, z, 11, 1, z, C.tableWood); // benches
    for (const x of [5, 11]) put(grid, [x, 0, z], C.timber);
  }
  put(grid, [7, 4, 1], C.pewter); // a tankard left on the table
  put(grid, [7, 5, 1], C.beerFoam);
  for (const bx of [23, 26]) {
    for (let y = 0; y <= 3; y++) fillBox(grid, bx, y, 1, bx + 1, y, 2, y === 1 ? C.iron : C.barrel);
  }
  fillBox(grid, 14, 0, 1, 14, 9, 1, C.timber); // lantern post
  fillBox(grid, 13, 10, 0, 15, 10, 2, C.iron);
  fillBox(grid, 14, 11, 1, 14, 12, 1, C.glass);
  put(grid, [14, 13, 1], C.iron);
}

// Open-fronted stable against the hall's end wall: corner posts, a plank
// back wall, a stepped lean-to roof falling away from the hall, and hay.
function stable(grid: VoxelGrid): void {
  const [x0, x1] = STABLE_X;
  const shades = ROOF_SETS[ROOF];
  fillBox(grid, x0, 0, 5, x1, 0, 19, C.earth); // trodden floor
  for (const [x, z] of [
    [x1, 5],
    [x1, 19],
  ]) {
    fillBox(grid, x, 1, z, x, 12, z, C.timber);
  }
  fillBox(grid, x0, 1, 19, x1, 11, 19, (x, y) => (y % 3 === 0 ? C.timber : x % 2 === 0 ? C.door : C.doorDark)); // plank back wall
  for (let x = x0 - 1; x <= x1 + 1; x++) {
    const y = 17 - Math.floor((x - x0 + 1) / 3); // steps down away from the hall
    fillBox(grid, x, y, 3, x, y, 21, (_x, _y, z) => (z === 3 || z === 21 ? shades.dark : x % 3 === 0 ? shades.light : shades.base));
  }
  fillBox(grid, x0 + 2, 1, 13, x0 + 6, 3, 17, (x, y) => (y === 2 || x === x0 + 4 ? C.hayDark : C.hay)); // hay bales
  fillBox(grid, x0 + 3, 4, 14, x0 + 6, 5, 17, (x) => (x === x0 + 5 ? C.hayDark : C.hay));
  fillBox(grid, x0 + 8, 1, 15, x1 - 2, 2, 17, C.tableWood); // trough
  fillBox(grid, x0 + 9, 2, 16, x1 - 3, 2, 16, C.quench);
}
