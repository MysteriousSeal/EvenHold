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
import type { Furniture } from '../../model/interiors/furniture';
import { FURNITURE_PALETTE } from './furniturePalette';
import { paintFurniture } from './furnitureVoxels';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';

export const ROOM_VOXEL = 0.04;
const TILE = 25;
const WALL = 5; // wall thickness, in voxels
const HIGH = 34; // the back walls' height
const HEADROOM = 8; // over them, for what reaches up into the floor above (the stairs' handrail)
const LOW = 4; // the near walls'
const DOOR_HEIGHT = 28; // the door frame, standing tall above the near wall

const ROOM_COLORS = [
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
// Floors, kept calm (seams only a shade off the boards) so what stands on
// them reads clearly.
const FLOOR_COLORS = [
  0xa27a4e, // 30 board
  0x9a7248, // 31 board, a shade darker
  0x8c663f, // 32 seam
  0x8f8c84, // 33 flagstone
  0x86837b, // 34 flagstone, a shade darker
  0x7a776f, // 35 mortar
  0xaa8456, // 36 board, a shade lighter
  0x6b4a2c, // 37 nail head, knot
];
export const ROOM_PALETTE = [...ROOM_COLORS, ...FURNITURE_PALETTE, ...FLOOR_COLORS];
const [BOARD, BOARD_DARK, SEAM, FLAG, FLAG_DARK, FLAG_MORTAR, BOARD_LIGHT, NAIL] = FLOOR_COLORS.map(
  (_, i) => ROOM_COLORS.length + FURNITURE_PALETTE.length + 1 + i,
);

// Floor color at a voxel (x, z) of the floor, by style: long boards or
// flagstones, their seams only a shade off, so furniture stands out.
function floorColor(style: Room['floor'], x: number, z: number): number {
  if (style === 'tavern') return tavernFloor(x, z);
  if (style === 'flagstones') {
    // Stones 10-14 voxels across in staggered rows, a voxel of soft mortar between.
    const row = Math.floor(z / 12);
    const shifted = x + (row % 2) * 7;
    if (z % 12 === 0 || shifted % 14 === 0) return FLAG_MORTAR;
    return (row * 7 + Math.floor(shifted / 14) * 3) % 3 === 0 ? FLAG_DARK : FLAG;
  }
  if (style === 'boards') {
    // Wide boards laid along z, eight voxels across.
    if (x % 8 === 0) return SEAM;
    return Math.floor(x / 8) % 2 === 0 ? BOARD : BOARD_DARK;
  }
  // Long planks along x, six voxels wide, their ends staggered far apart.
  const plank = Math.floor(z / 6);
  const length = 60 + (plank % 3) * 15;
  const offset = (plank * 29) % length;
  if (z % 6 === 0 || (x + offset) % length === 0) return SEAM;
  return plank % 2 === 0 ? BOARD : BOARD_DARK;
}

// A quick integer hash, for plank lengths, knots and tones.
const hash = (a: number, b: number) => ((a * 73856093) ^ (b * 19349663)) >>> 0;

// The inn's floor: planks five voxels wide along x in random lengths and
// three close tones, a pair of nail heads at each plank's end, and the odd knot.
function tavernFloor(x: number, z: number): number {
  const row = Math.floor(z / 5);
  if (z % 5 === 0) return SEAM;
  // Where along its row this plank starts and ends (lengths 30-70 voxels).
  let start = -(hash(row, 1) % 40);
  let plank = 0;
  for (;;) {
    const length = 30 + (hash(row, plank + 2) % 41);
    if (x < start + length) {
      if (x === start) return SEAM; // the joint
      const dz = z % 5;
      if ((x === start + 2 || x === start + length - 2) && (dz === 1 || dz === 3)) return NAIL; // nail heads at each end
      if (hash(row * 31 + plank, x) % 211 === 0) return NAIL; // a knot
      return [BOARD, BOARD_DARK, BOARD_LIGHT][hash(row, plank) % 3];
    }
    start += length;
    plank++;
  }
}

// Wall color at a voxel along a wall (u along it, y up), by style:
// - timber: planks of varying widths in three tones, dark gaps between, the
//   odd knot;
// - plaster: wooden wainscot panels to knee height under a dado rail, then
//   dappled plaster between timber posts (one a tile), a beam along the top;
// - stone: irregular coursed stones in four shades, dark mortar between.
function wallColor(style: Room['wall'], u: number, y: number): number {
  if (y < 3) return 13; // skirting
  if (style === 'stone') {
    const course = Math.floor(y / 4);
    if (y % 4 === 0) return 7; // mortar between courses
    const shifted = u + course * 5;
    const width = 6 + (course % 3);
    if (shifted % width === 0) return 7;
    return [11, 12, 5, 6][hash(Math.floor(shifted / width), course) % 4];
  }
  if (style === 'timber') {
    // Planks 5-7 voxels wide, each its own tone.
    let start = 0;
    let plank = 0;
    for (;;) {
      const width = 5 + (hash(plank, 7) % 3);
      if (u < start + width) break;
      start += width;
      plank++;
    }
    if (u === start) return 4; // the gap
    if (hash(plank, y) % 97 === 0) return 15; // a knot
    return [1, 2, 3][hash(plank, 3) % 3];
  }
  // Plaster over wainscoting.
  if (y < 10) return u % 8 === 0 ? 15 : y === 3 || y === 9 ? 15 : 14; // panels, framed
  if (y === 10 || y === 11) return 16; // dado rail
  if (u % TILE === 0 || u % TILE === 1) return 10; // posts
  if (y >= HIGH - 2) return 10; // top beam
  return hash(u, y) % 11 === 0 ? 9 : 8; // plaster, dappled
}

// `door`: whether the near wall has its door (not upstairs: no way to the street there).
export function buildRoomVoxels(room: Room, furniture: readonly Furniture[] = [], door = true): VoxelGrid {
  const w = room.width * TILE;
  const d = room.depth * TILE;
  const grid = createGrid([w + WALL * 2, HIGH + 1 + HEADROOM, d + WALL * 2]);
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
  if (door) {
    const doorX = x0 + room.door * TILE;
    fillBox(grid, doorX + 2, 1, z0 + d, doorX + TILE - 3, LOW, d + WALL * 2 - 1, 0); // the doorway
    fillBox(grid, doorX + 2, 0, z0 + d, doorX + TILE - 3, 0, d + WALL * 2 - 1, 4); // its threshold
    // The door, standing tall over the cut-down wall: a timber frame (posts
    // and a lintel) with the planked door shut in it, iron hinges and a ring
    // on the face the camera sees, and a woven mat before it.
    const TIMBER = 10;
    const DOOR = 15; // dark wood
    const DOOR_LIGHT = 14;
    const IRON = 22;
    const MAT = 17;
    const MAT_EDGE = 19;
    for (const x of [doorX, doorX + TILE - 2]) fillBox(grid, x, 0, z0 + d, x + 1, DOOR_HEIGHT, z0 + d + WALL - 1, TIMBER); // posts
    fillBox(grid, doorX, DOOR_HEIGHT + 1, z0 + d, doorX + TILE - 1, DOOR_HEIGHT + 2, z0 + d + WALL - 1, TIMBER); // lintel
    const leaf = { x0: doorX + 2, x1: doorX + TILE - 3, z0: z0 + d + 1, z1: z0 + d + 2 };
    fillBox(grid, leaf.x0, 1, leaf.z0, leaf.x1, DOOR_HEIGHT, leaf.z1, (x) => ((x - leaf.x0) % 5 === 0 ? DOOR : DOOR_LIGHT)); // planks, shut
    for (const y of [5, DOOR_HEIGHT - 4]) fillBox(grid, leaf.x0, y, leaf.z1 + 1, leaf.x0 + 8, y, leaf.z1 + 1, IRON); // hinges
    fillBox(grid, leaf.x1 - 4, 12, leaf.z1 + 1, leaf.x1 - 3, 13, leaf.z1 + 1, IRON); // ring handle
    fillBox(grid, doorX + 3, 1, z0 + d - 12, doorX + TILE - 4, 1, z0 + d - 3, (x, _y, z) =>
      x === doorX + 3 || x === doorX + TILE - 4 || z === z0 + d - 12 || z === z0 + d - 3 ? MAT_EDGE : MAT,
    ); // doormat
  }
  paintFurniture(grid, furniture, x0, z0);
  return grid;
}

// Where floor tile (0, 0)'s middle is in the grid, in voxels (x, z).
export const ROOM_ORIGIN_VOXELS = WALL + TILE / 2;

// Only the given pieces, on an empty grid the size of the room's: meshed on
// their own (the wall lanterns, which mustn't shadow the wall behind them).
export function buildPieceVoxels(room: Room, pieces: readonly Furniture[]): VoxelGrid {
  const grid = createGrid([room.width * TILE + WALL * 2, HIGH + 1 + HEADROOM, room.depth * TILE + WALL * 2]);
  paintFurniture(grid, pieces, WALL, WALL);
  return grid;
}
