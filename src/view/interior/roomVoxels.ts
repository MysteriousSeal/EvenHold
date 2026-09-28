// A room's floor and walls in voxels, at the world's 0.04 scale (25 voxels
// to a floor tile). The two walls away from the camera (-X and -Z) stand
// full height; the two toward it (+X and +Z) are cut low, so the room can
// be seen into, and the +Z one has the doorway. Grid-aligned only.
//
// Floors: planks (long boards in staggered lengths), boards (short, wide,
// laid across) or flagstones (squarish stones in mortar). Walls: plaster
// between timber posts, all timber, or coursed stone; a skirting runs
// along their foot.

import type { Room } from '../../model/interiors/interiors';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';

export const ROOM_VOXEL = 0.04;
const TILE = 25;
const WALL = 5; // wall thickness, in voxels
const HIGH = 34; // the back walls' height
const LOW = 4; // the near walls'

export const ROOM_PALETTE = [
  0x9a6a3e, // 1 plank
  0x87592f, // 2 plank, dark
  0xa87a4a, // 3 plank, light
  0x5e3f28, // 4 seam
  0x8d8a82, // 5 flagstone
  0x77746c, // 6 flagstone, dark
  0x5a5750, // 7 mortar
  0xe8dcc0, // 8 plaster
  0xd6c9a8, // 9 plaster, shade
  0x6b4226, // 10 timber
  0x9a948a, // 11 stone
  0x7e786e, // 12 stone, dark
  0x4e2f1a, // 13 skirting
];

// Floor color at a voxel (x, z) of the floor, by style.
function floorColor(style: Room['floor'], x: number, z: number): number {
  if (style === 'flagstones') {
    // Stones 8-12 voxels across in staggered rows, a voxel of mortar between.
    const row = Math.floor(z / 10);
    const shifted = x + (row % 2) * 5;
    if (z % 10 === 0 || shifted % 12 === 0) return 7;
    return (row * 7 + Math.floor(shifted / 12) * 3) % 4 === 0 ? 6 : 5;
  }
  if (style === 'boards') {
    // Wide boards laid along z, eight voxels across, seams between.
    const board = Math.floor(x / 8);
    if (x % 8 === 0) return 4;
    return [1, 2, 3][board % 3];
  }
  // Long planks along x, five voxels wide, their ends staggered.
  const plank = Math.floor(z / 5);
  const length = 30 + (plank % 3) * 10;
  const offset = (plank * 17) % length;
  if (z % 5 === 0 || (x + offset) % length === 0) return 4;
  return [1, 3, 2][plank % 3];
}

// Wall color at a voxel along a wall (u along it, y up), by style.
function wallColor(style: Room['wall'], u: number, y: number): number {
  if (y < 3) return 13; // skirting
  if (style === 'stone') return y % 6 === 0 || (u + (Math.floor(y / 6) % 2) * 6) % 12 === 0 ? 12 : 11;
  if (style === 'timber') return u % 8 === 0 ? 2 : u % 8 < 4 ? 10 : 1;
  return u % TILE === 0 || y === HIGH - 1 ? 10 : y % 9 === 0 ? 9 : 8; // plaster between posts
}

export function buildRoomVoxels(room: Room): VoxelGrid {
  const w = room.width * TILE;
  const d = room.depth * TILE;
  const grid = createGrid([w + WALL * 2, HIGH + 1, d + WALL * 2]);
  const x0 = WALL;
  const z0 = WALL;
  // The floor, one voxel thick, at y 0.
  fillBox(grid, x0, 0, z0, x0 + w - 1, 0, z0 + d - 1, (x, _y, z) => floorColor(room.floor, x - x0, z - z0));
  // Back walls, full height: along -Z (the far one) and -X (the left one).
  fillBox(grid, 0, 0, 0, w + WALL * 2 - 1, HIGH, WALL - 1, (x, y) => wallColor(room.wall, x, y));
  fillBox(grid, 0, 0, 0, WALL - 1, HIGH, d + WALL * 2 - 1, (_x, y, z) => wallColor(room.wall, z, y));
  // Near walls, cut low: +X, and +Z with the doorway.
  fillBox(grid, x0 + w, 0, 0, w + WALL * 2 - 1, LOW, d + WALL * 2 - 1, (_x, y, z) => wallColor(room.wall, z, y));
  fillBox(grid, 0, 0, z0 + d, w + WALL * 2 - 1, LOW, d + WALL * 2 - 1, (x, y) => wallColor(room.wall, x, y));
  const doorX = x0 + room.door * TILE;
  fillBox(grid, doorX + 2, 1, z0 + d, doorX + TILE - 3, LOW, d + WALL * 2 - 1, 0); // the doorway
  fillBox(grid, doorX + 2, 0, z0 + d, doorX + TILE - 3, 0, d + WALL * 2 - 1, 4); // its threshold
  return grid;
}

// Where floor tile (0, 0)'s middle is in the grid, in voxels (x, z).
export const ROOM_ORIGIN_VOXELS = WALL + TILE / 2;
