// Voxel medieval houses at the world's 0.04 voxel scale (25 voxels = one
// tile). Each wall is built in depth layers so the relief reads at
// gameplay distance: plaster sits one voxel back, the timber frame stands
// proud of it, window glass is recessed behind its frame, sills, planters
// and lanterns project outward. Door faces -Z; the roof ridge runs along X.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor, voxelLine } from '../voxel/voxelShapes';
import { C, ROOF_SETS } from './housePalette';

export const HOUSE_VOXEL_SIZE = 0.04;
export const HOUSE_GRID: [number, number, number] = [25, 44, 25];
const MID = 12;
const FOUNDATION_TOP = 1; // plinth occupies y 0..1

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

// A wall seen from outside: `axis` is the axis its face is perpendicular
// to, `at` the coordinate of its outer face, `out` which way is outside.
interface Wall {
  axis: 'x' | 'z';
  at: number;
  out: 1 | -1;
}

type Voxel = [number, number, number];

// Voxel `u` along the wall, at height `y`, `depth` voxels inward from the
// outer face (negative = projecting outside).
function onWall(wall: Wall, u: number, y: number, depth: number): Voxel {
  const c = wall.at - wall.out * depth;
  return wall.axis === 'z' ? [u, y, c] : [c, y, u];
}

function put(grid: VoxelGrid, [x, y, z]: Voxel, color: number): void {
  if (x >= 0 && y >= 0 && z >= 0 && x < grid.size[0] && y < grid.size[1] && z < grid.size[2]) setColor(grid, x, y, z, color);
}

// Coursed stonework: blocks four voxels long, every other course offset by
// two, mostly mid stone with some dark and a few light blocks, so walls read
// as masonry without turning noisy. Runs around corners.
function masonry(x: number, y: number, z: number): number {
  const block = Math.floor((x + z + (y % 2) * 2) / 4);
  const pick = (block * 7 + y * 3) % 7;
  return pick < 4 ? C.stone : pick < 6 ? C.stoneDark : C.stoneLight;
}

interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

function wallsOf(b: Box): { front: Wall; back: Wall; left: Wall; right: Wall } {
  return {
    front: { axis: 'z', at: b.z0, out: -1 },
    back: { axis: 'z', at: b.z1, out: 1 },
    left: { axis: 'x', at: b.x0, out: -1 },
    right: { axis: 'x', at: b.x1, out: 1 },
  };
}

// Glass recessed one voxel behind a 5x5 frame ring, divided into four panes
// by a cross; a sill below. Timber windows add shutters and, on the front
// and back walls, a planter of flowers.
function window(grid: VoxelGrid, wall: Wall, u: number, y: number, stoneWall: boolean): void {
  const frame = stoneWall ? C.stoneLight : C.timber;
  for (let du = -2; du <= 2; du++) {
    for (let dy = -2; dy <= 2; dy++) {
      const ring = Math.max(Math.abs(du), Math.abs(dy)) === 2;
      put(grid, onWall(wall, u + du, y + dy, 0), ring ? frame : 0);
      if (!ring) put(grid, onWall(wall, u + du, y + dy, 1), du === 0 || dy === 0 ? frame : C.glass);
    }
  }
  for (let du = -2; du <= 2; du++) put(grid, onWall(wall, u + du, y - 2, -1), stoneWall ? C.stoneLight : C.timberLight);
  if (stoneWall) return;

  for (const side of [-3, 3]) for (let dy = -1; dy <= 1; dy++) put(grid, onWall(wall, u + side, y + dy, 0), C.door);
  if (wall.axis === 'z') {
    const flowers = [C.flowerRed, C.leaf, C.flowerYellow, C.leaf, C.flowerPurple];
    for (let du = -2; du <= 2; du++) {
      put(grid, onWall(wall, u + du, y - 3, -1), C.planter);
      put(grid, onWall(wall, u + du, y - 3, -2), C.planter);
      put(grid, onWall(wall, u + du, y - 2, -2), flowers[du + 2]);
    }
  }
}

// Plank door (alternating board shades) recessed behind its jambs, with two
// iron straps and a handle, a lintel, a stone step, and a lantern on an
// iron bracket to its left.
function door(grid: VoxelGrid, wall: Wall, u: number, stoneWall: boolean): void {
  const bottom = FOUNDATION_TOP + 1;
  const top = bottom + 7;
  const jamb = stoneWall ? C.stoneLight : C.timber;
  for (let y = bottom; y <= top; y++) {
    put(grid, onWall(wall, u - 2, y, 0), jamb);
    put(grid, onWall(wall, u + 2, y, 0), jamb);
    for (let du = -1; du <= 1; du++) {
      put(grid, onWall(wall, u + du, y, 0), 0);
      const strap = y === bottom + 2 || y === bottom + 5;
      put(grid, onWall(wall, u + du, y, 1), strap ? C.iron : du === 0 ? C.doorDark : C.door);
    }
  }
  for (let du = -3; du <= 3; du++) put(grid, onWall(wall, u + du, top + 1, 0), stoneWall ? C.stoneLight : C.timberLight);
  put(grid, onWall(wall, u + 1, bottom + 3, 0), C.iron); // handle
  for (let du = -2; du <= 2; du++) put(grid, onWall(wall, u + du, 0, -2), C.stoneLight); // step

  const lantern = u - 4;
  put(grid, onWall(wall, lantern, top, -1), C.iron);
  put(grid, onWall(wall, lantern, top, -2), C.iron);
  put(grid, onWall(wall, lantern, top - 1, -2), C.glass);
  put(grid, onWall(wall, lantern, top - 2, -2), C.iron);
}

// Diagonal braces rising from a wall's bottom corners toward its window,
// standing proud like the rest of the frame.
function braces(grid: VoxelGrid, wall: Wall, uMin: number, uMax: number, y0: number, y1: number, center: number): void {
  const span = (from: number, to: number) => {
    if (Math.abs(to - from) < 2) return;
    voxelLine(grid, onWall(wall, from, y0 + 1, 0), onWall(wall, to, y1 - 1, 0), C.timber);
  };
  span(uMin + 1, center - 4);
  span(uMax - 1, center + 4);
}

// A half-timbered storey: plaster one voxel inside `b` (weathered at the
// base and under the top beam), with corner posts and top/bottom beams on
// the outer face.
function timberStorey(grid: VoxelGrid, b: Box): void {
  fillBox(grid, b.x0 + 1, b.y0, b.z0 + 1, b.x1 - 1, b.y1, b.z1 - 1, (_x, y) =>
    y === b.y0 || y === b.y1 - 1 ? C.plasterShade : C.plaster,
  );
  for (const [x, z] of [
    [b.x0, b.z0],
    [b.x0, b.z1],
    [b.x1, b.z0],
    [b.x1, b.z1],
  ]) {
    fillBox(grid, x, b.y0, z, x, b.y1, z, C.timber);
  }
  for (const y of [b.y0, b.y1]) {
    fillBox(grid, b.x0, y, b.z0, b.x1, y, b.z0, C.timber);
    fillBox(grid, b.x0, y, b.z1, b.x1, y, b.z1, C.timber);
    fillBox(grid, b.x0, y, b.z0, b.x0, y, b.z1, C.timber);
    fillBox(grid, b.x1, y, b.z0, b.x1, y, b.z1, C.timber);
  }
}

// Stepped shingle roof over `b`: two voxels thick, overhanging the eaves and
// gable ends by two, courses alternating shade every two steps, darker at
// the ridge and eave edge. The attic under it is plaster, with a king post
// and raking struts on each gable face.
function roof(grid: VoxelGrid, b: Box, roofHeight: number, roofIndex: number): number {
  const shades = ROOF_SETS[roofIndex];
  const halfSpan = (b.z1 - b.z0) / 2;
  const ridge = b.y1 + roofHeight;
  const rowTop = (dz: number) => ridge - Math.round((dz * roofHeight) / (halfSpan + 1));
  const lastRow = halfSpan + 2;

  for (let dz = 0; dz <= lastRow; dz++) {
    const top = rowTop(dz);
    const color = dz === 0 || dz === lastRow ? shades.dark : Math.floor(dz / 2) % 2 === 0 ? shades.base : shades.light;
    for (const side of [-1, 1]) {
      const z = MID + side * dz;
      fillBox(grid, b.x0 - 2, top - 1, z, b.x1 + 2, top, z, color);
      if (dz <= halfSpan) fillBox(grid, b.x0 + 1, b.y1 + 1, z, b.x1 - 1, top - 2, z, C.plaster);
    }
  }

  for (const x of [b.x0, b.x1]) {
    fillBox(grid, x, b.y1 + 1, MID, x, ridge - 2, MID, C.timber);
    for (const side of [-1, 1]) {
      voxelLine(grid, [x, b.y1 + 1, MID + side * (halfSpan - 2)], [x, b.y1 + Math.floor(roofHeight / 2), MID], C.timber);
    }
  }
  return ridge;
}

function chimney(grid: VoxelGrid, b: Box, ridge: number): void {
  const x = b.x1 - 3;
  const z = MID + 4;
  fillBox(grid, x - 1, b.y1 + 1, z - 1, x + 1, ridge + 3, z + 1, masonry);
  fillBox(grid, x - 2, ridge + 4, z - 2, x + 2, ridge + 4, z + 2, C.stoneDark); // cap
  fillBox(grid, x, ridge + 5, z, x, ridge + 6, z, C.clayPot);
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
