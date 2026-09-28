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
}

export const HOUSE_LAYOUTS: readonly HouseLayout[] = [
  { width: 19, depth: 17, wallHeight: 12, roofHeight: 13 }, // cottage
  { width: 21, depth: 15, wallHeight: 11, roofHeight: 11 }, // longhouse
  { width: 15, depth: 15, wallHeight: 21, roofHeight: 13, groundHeight: 10 }, // townhouse, jettied upper floor
];

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
  const ground: Box = {
    x0: MID - hw,
    x1: MID + hw,
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
  timberStorey(grid, upper);

  const doorU = twoStorey ? MID : MID - 4;
  const groundWalls = wallsOf(twoStorey ? ground : upper);
  const upperWalls = wallsOf(upper);
  // Mid-wall: high enough for a planter underneath, low enough to clear the eaves.
  const windowY = (b: Box) => Math.round((b.y0 + b.y1) / 2);

  if (twoStorey) {
    const y = windowY({ ...ground, y1: upper.y0 - 1 });
    for (const [wall, u] of [
      [groundWalls.back, MID],
      [groundWalls.left, MID],
      [groundWalls.right, MID],
    ] as const) {
      window(grid, wall, u, y, true);
    }
    door(grid, groundWalls.front, doorU, true);
    for (const wall of [upperWalls.front, upperWalls.back, upperWalls.left, upperWalls.right]) {
      braces(grid, wall, wall.axis === 'z' ? upper.x0 : upper.z0, wall.axis === 'z' ? upper.x1 : upper.z1, upper.y0, upper.y1, MID);
      window(grid, wall, MID, windowY(upper), false);
    }
  } else {
    for (const wall of [upperWalls.back, upperWalls.left, upperWalls.right]) {
      braces(grid, wall, wall.axis === 'z' ? upper.x0 : upper.z0, wall.axis === 'z' ? upper.x1 : upper.z1, upper.y0, upper.y1, MID);
      window(grid, wall, MID, windowY(upper), false);
    }
    door(grid, upperWalls.front, doorU, false);
    window(grid, upperWalls.front, MID + 5, windowY(upper), false);
  }

  const ridge = roof(grid, upper, layout.roofHeight, roofIndex);
  chimney(grid, upper, ridge);
  props(grid, twoStorey ? ground : upper, upper, doorU, twoStorey);
  return grid;
}
