// Voxel medieval houses at the world's 0.04 voxel scale (25 voxels = one
// tile). Each wall is built in depth layers so the relief reads at
// gameplay distance: plaster sits one voxel back, the timber frame stands
// proud of it, window glass is recessed behind its frame, sills, planters
// and lanterns project outward. Door faces -Z; the roof ridge runs along X.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { C } from './housePalette';
import { FOUNDATION_TOP, MID, braces, chimney, door, masonry, onWall, put, roof, timberStorey, wallsOf, window, type Box } from './houseParts';

export const HOUSE_VOXEL_SIZE = 0.04;
export const HOUSE_GRID: [number, number, number] = [25, 44, 25];
export interface HouseLayout {
  width: number; // wall-to-wall voxels along X (odd, so the house centers on the tile)
  depth: number; // along Z (odd)
  wallHeight: number; // voxels above the plinth
  roofHeight: number;
  groundHeight?: number; // two-storey only: height of the stone ground floor
  stone?: boolean; // single storey in coursed stone instead of half-timbering
  offsetX?: number; // shifts the house along X (to make room for a lean-to)
  leanTo?: boolean; // open woodshed against the +X wall
  porch?: boolean; // little timber porch roof over the door
}

export const HOUSE_LAYOUTS: readonly HouseLayout[] = [
  { width: 19, depth: 17, wallHeight: 12, roofHeight: 13 }, // cottage
  { width: 21, depth: 15, wallHeight: 11, roofHeight: 11 }, // longhouse
  { width: 15, depth: 15, wallHeight: 21, roofHeight: 13, groundHeight: 10 }, // townhouse, jettied upper floor
  { width: 17, depth: 15, wallHeight: 10, roofHeight: 12, stone: true }, // stone cottage
  { width: 13, depth: 13, wallHeight: 25, roofHeight: 11, groundHeight: 12 }, // tower house
  { width: 21, depth: 13, wallHeight: 8, roofHeight: 15 }, // hall house: low walls, steep roof
  { width: 15, depth: 15, wallHeight: 11, roofHeight: 11, offsetX: -3, leanTo: true }, // cottage with a woodshed
  { width: 19, depth: 15, wallHeight: 12, roofHeight: 12, porch: true, stone: true }, // stone house with a porch
];

// A small timber porch over the door: two posts and a stepped plank roof.
function porch(grid: VoxelGrid, b: Box, doorU: number): void {
  for (const x of [doorU - 3, doorU + 3]) fillBox(grid, x, FOUNDATION_TOP + 1, b.z0 - 3, x, FOUNDATION_TOP + 9, b.z0 - 3, C.timber);
  fillBox(grid, doorU - 4, FOUNDATION_TOP + 10, b.z0 - 2, doorU + 4, FOUNDATION_TOP + 10, b.z0 - 1, C.timberLight);
  fillBox(grid, doorU - 4, FOUNDATION_TOP + 10, b.z0 - 4, doorU + 4, FOUNDATION_TOP + 10, b.z0 - 3, C.timberLight);
  fillBox(grid, doorU - 4, FOUNDATION_TOP + 11, b.z0 - 2, doorU + 4, FOUNDATION_TOP + 11, b.z0 - 1, C.timber);
}

// An open woodshed against the +X wall: two posts, a plank roof
// falling away from the house, and stacked logs with pale cut ends inside.
function leanTo(grid: VoxelGrid, b: Box): void {
  const x0 = b.x1 + 1;
  const x1 = Math.min(HOUSE_GRID[0] - 1, b.x1 + 6);
  for (const z of [b.z0 + 1, b.z1 - 1]) fillBox(grid, x1, 0, z, x1, 7, z, C.timber);
  for (let x = x0; x <= x1; x++) {
    const y = 10 - Math.floor((x - x0) / 2);
    fillBox(grid, x, y, b.z0, x, y, b.z1, x === x1 ? C.timber : (x + y) % 2 === 0 ? C.timber : C.timberLight);
  }
  for (let y = 0; y <= 4; y++) {
    fillBox(grid, x0, y, b.z0 + 3, x1 - 2, y, b.z1 - 3, (_x, _y, z) => (z === b.z0 + 3 || z === b.z1 - 3 ? C.endGrain : C.bark));
  }
}

// Props around the house, each inside the tile: a banded barrel by the
// door, firewood stacked at the back (pale cut ends), and on a two-storey
// house a shop sign hanging from an iron bracket.
function props(grid: VoxelGrid, ground: Box, upper: Box, doorU: number, twoStorey: boolean): void {
  const bx = doorU + 5;
  const bz = ground.z0 - 3;
  for (let y = 0; y <= 2; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (Math.abs(dx) + Math.abs(dz) === 2) continue; // rounded: no corners
        put(grid, [bx + dx, y, bz + dz], y === 1 ? C.iron : C.barrel);
      }
    }
  }

  const logStart = ground.x0 + 2;
  const logEnd = ground.x0 + 6;
  for (const [z, y] of [
    [ground.z1 + 2, 0],
    [ground.z1 + 3, 0],
    [ground.z1 + 2, 1],
  ]) {
    for (let x = logStart; x <= logEnd; x++) put(grid, [x, y, z], x === logStart || x === logEnd ? C.endGrain : C.bark);
  }

  if (twoStorey) {
    const front = wallsOf(upper).front;
    const u = upper.x1 - 2;
    for (let d = -1; d >= -4; d--) put(grid, onWall(front, u, upper.y0 + 4, d), C.iron);
    fillBox(grid, u, upper.y0 + 1, upper.z0 - 4, u, upper.y0 + 3, upper.z0 - 2, C.sign);
  }
}

export function buildHouseVoxels(layout: HouseLayout, roofIndex: number): VoxelGrid {
  const grid = createGrid(HOUSE_GRID);
  const hw = (layout.width - 1) / 2;
  const hd = (layout.depth - 1) / 2;
  const cx = MID + (layout.offsetX ?? 0); // the house's center along X
  const ground: Box = {
    x0: cx - hw,
    x1: cx + hw,
    z0: MID - hd,
    z1: MID + hd,
    y0: FOUNDATION_TOP + 1,
    y1: FOUNDATION_TOP + layout.wallHeight,
  };
  const twoStorey = layout.groundHeight !== undefined;

  // Plinth: coursed stone, one voxel wider than the walls all round.
  fillBox(grid, ground.x0 - 1, 0, ground.z0 - 1, ground.x1 + 1, FOUNDATION_TOP, ground.z1 + 1, masonry);

  let upper: Box = ground;
  if (twoStorey) {
    const groundTop = ground.y0 + layout.groundHeight! - 1;
    fillBox(grid, ground.x0, ground.y0, ground.z0, ground.x1, groundTop, ground.z1, masonry);
    // Quoins: alternating long/short dressed stones up each corner.
    for (let y = ground.y0; y <= groundTop; y++) {
      const long = ((y - ground.y0) >> 1) % 2 === 0;
      for (const [x, z, dx, dz] of [
        [ground.x0, ground.z0, 1, 1],
        [ground.x1, ground.z0, -1, 1],
        [ground.x0, ground.z1, 1, -1],
        [ground.x1, ground.z1, -1, -1],
      ]) {
        put(grid, [x, y, z], C.stoneLight);
        put(grid, long ? [x + dx, y, z] : [x, y, z + dz], C.stoneLight);
      }
    }
    // Jettied upper floor: its frame overhangs the stone by a voxel.
    upper = { x0: ground.x0 - 1, x1: ground.x1 + 1, z0: ground.z0 - 1, z1: ground.z1 + 1, y0: groundTop + 1, y1: ground.y1 };
  }
  if (layout.stone) fillBox(grid, upper.x0, upper.y0, upper.z0, upper.x1, upper.y1, upper.z1, masonry);
  else timberStorey(grid, upper);

  const doorU = twoStorey ? cx : cx - 4;
  // Window/brace center on a wall: along X for front and back, Z for the sides.
  const centerOf = (wall: { axis: 'x' | 'z' }) => (wall.axis === 'z' ? cx : MID);
  const groundWalls = wallsOf(twoStorey ? ground : upper);
  const upperWalls = wallsOf(upper);
  // Mid-wall: high enough for a planter underneath, low enough to clear the eaves.
  const windowY = (b: Box) => Math.round((b.y0 + b.y1) / 2);

  if (twoStorey) {
    const y = windowY({ ...ground, y1: upper.y0 - 1 });
    for (const wall of [groundWalls.back, groundWalls.left, groundWalls.right]) window(grid, wall, centerOf(wall), y, true);
    door(grid, groundWalls.front, doorU, true);
    for (const wall of [upperWalls.front, upperWalls.back, upperWalls.left, upperWalls.right]) {
      braces(grid, wall, wall.axis === 'z' ? upper.x0 : upper.z0, wall.axis === 'z' ? upper.x1 : upper.z1, upper.y0, upper.y1, centerOf(wall));
      window(grid, wall, centerOf(wall), windowY(upper), false);
    }
  } else {
    const stone = layout.stone ?? false;
    for (const wall of [upperWalls.back, upperWalls.left, upperWalls.right]) {
      if (layout.leanTo && wall === upperWalls.right) continue; // the woodshed covers it
      if (!stone) braces(grid, wall, wall.axis === 'z' ? upper.x0 : upper.z0, wall.axis === 'z' ? upper.x1 : upper.z1, upper.y0, upper.y1, centerOf(wall));
      window(grid, wall, centerOf(wall), windowY(upper), stone);
    }
    door(grid, upperWalls.front, doorU, stone);
    window(grid, upperWalls.front, cx + 5, windowY(upper), stone);
  }
  if (layout.porch) porch(grid, upper, doorU);
  if (layout.leanTo) leanTo(grid, upper);

  const ridge = roof(grid, upper, layout.roofHeight, roofIndex);
  chimney(grid, upper, ridge);
  props(grid, twoStorey ? ground : upper, upper, doorU, twoStorey);
  return grid;
}
