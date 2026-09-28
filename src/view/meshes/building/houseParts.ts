// Building blocks shared by the voxel buildings (houses, the inn, the
// smithy), at the world's 0.04 voxel scale: walls built in depth layers,
// windows, doors, timber framing, stepped shingle roofs and chimneys. A
// building's grid may be any width along X, but its depth along Z must be
// centered on MID (roofs and chimneys are laid out around it). Doors face
// -Z; roof ridges run along X.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { fillBox, setColor, voxelLine } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { C, ROOF_SETS } from './housePalette';

export const MID = 12;
export const FOUNDATION_TOP = 1; // plinth occupies y 0..1

// A wall seen from outside: `axis` is the axis its face is perpendicular
// to, `at` the coordinate of its outer face, `out` which way is outside.
export interface Wall {
  axis: 'x' | 'z';
  at: number;
  out: 1 | -1;
}

export type Voxel = [number, number, number];

// Voxel `u` along the wall, at height `y`, `depth` voxels inward from the
// outer face (negative = projecting outside).
export function onWall(wall: Wall, u: number, y: number, depth: number): Voxel {
  const c = wall.at - wall.out * depth;
  return wall.axis === 'z' ? [u, y, c] : [c, y, u];
}

export function put(grid: VoxelGrid, [x, y, z]: Voxel, color: number): void {
  if (x >= 0 && y >= 0 && z >= 0 && x < grid.size[0] && y < grid.size[1] && z < grid.size[2]) setColor(grid, x, y, z, color);
}

// Coursed stonework: blocks four voxels long, every other course offset by
// two, mostly mid stone with some dark and a few light blocks, so walls read
// as masonry without turning noisy. Runs around corners.
export function masonry(x: number, y: number, z: number): number {
  const block = Math.floor((x + z + (y % 2) * 2) / 4);
  const pick = (block * 7 + y * 3) % 7;
  return pick < 4 ? C.stone : pick < 6 ? C.stoneDark : C.stoneLight;
}

export interface Box {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y0: number;
  y1: number;
}

export function wallsOf(b: Box): { front: Wall; back: Wall; left: Wall; right: Wall } {
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
export function window(grid: VoxelGrid, wall: Wall, u: number, y: number, stoneWall: boolean): void {
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
export function door(grid: VoxelGrid, wall: Wall, u: number, stoneWall: boolean): void {
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
export function braces(grid: VoxelGrid, wall: Wall, uMin: number, uMax: number, y0: number, y1: number, center: number): void {
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
export function timberStorey(grid: VoxelGrid, b: Box): void {
  // Limewash, lightly dithered with warm and shaded specks so it reads as
  // hand-applied rather than flat paint.
  fillBox(grid, b.x0 + 1, b.y0, b.z0 + 1, b.x1 - 1, b.y1, b.z1 - 1, (x, y, z) => {
    if (y === b.y0 || y === b.y1 - 1) return C.plasterShade;
    const h = hashUnit(x, y, z);
    return h < 0.06 ? C.plasterShade : h < 0.14 ? C.plasterWarm : C.plaster;
  });
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
// gable ends by two. Each course is cut into 3-voxel shingles, staggered
// course to course, each with its own shade (courses still alternate
// lighter and darker every two steps); the eave is dark, the ridge capped
// light, and moss creeps up from the eaves. The attic under it is plaster, with a king post
// and raking struts on each gable face.
export function roof(grid: VoxelGrid, b: Box, roofHeight: number, roofIndex: number): number {
  const shades = ROOF_SETS[roofIndex];
  const halfSpan = (b.z1 - b.z0) / 2;
  const ridge = b.y1 + roofHeight;
  const rowTop = (dz: number) => ridge - Math.round((dz * roofHeight) / (halfSpan + 1));
  const lastRow = halfSpan + 2;

  for (let dz = 0; dz <= lastRow; dz++) {
    const top = rowTop(dz);
    for (const side of [-1, 1]) {
      const z = MID + side * dz;
      fillBox(grid, b.x0 - 2, top - 1, z, b.x1 + 2, top, z, (x) => {
        if (dz === lastRow) return shades.dark;
        if (dz === 0) return shades.highlight; // ridge cap
        const shingle = Math.floor((x + dz * 2) / 3);
        const h = hashUnit(shingle, dz, side);
        const moss = hashUnit(x, dz, side + 7) < 0.35 * Math.max(0, (dz - lastRow + 4) / 4);
        if (moss) return h < 0.5 ? C.roofMoss : C.roofMossLight;
        const light = Math.floor(dz / 2) % 2 === 1;
        return h < 0.15 ? shades.dark : h < 0.3 ? shades.highlight : light ? shades.light : shades.base;
      });
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

export function chimney(grid: VoxelGrid, b: Box, ridge: number): void {
  const x = b.x1 - 3;
  const z = MID + 4;
  fillBox(grid, x - 1, b.y1 + 1, z - 1, x + 1, ridge + 3, z + 1, masonry);
  fillBox(grid, x - 2, ridge + 4, z - 2, x + 2, ridge + 4, z + 2, C.stoneDark); // cap
  fillBox(grid, x, ridge + 5, z, x, ridge + 6, z, C.clayPot);
}
