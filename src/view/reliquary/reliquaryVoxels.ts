// The reliquary in voxels (model/reliquary/), at a crypt's scale and in its palette (crypt/cryptVoxels.ts: its stone,
// bone, wax and flame), and the reliquary's own after it: gilt in three tones, red silk and its folds, rock crystal,
// the old kingdom's weathered bronze-green and the cold blue of its seal (glowing). Built as a crypt's pieces are:
// facing local +Z (a wall piece out of the rock toward the floor), centred on its tiles, its floor at y 0.
// - the bone wall: the crypt's rock, its faces lined with bones: courses of skulls, sockets dark, and courses of long
//   bones' ends between, as an ossuary's walls are stacked;
// - a reliquary casket: a little gilt house on a stone foot, its roof pitched, crystal windows down its side, a
//   bone behind each, red silk under it;
// - a pillar of skulls: a square column stacked of them, a gilt band at its foot and top;
// - a saint's plinth: a low block of stone, a gilt edge;
// - the Deacon's shrine: a stepped altar heaped with reliquaries (caskets, a monstrance, an arm, candles burning), red
//   silk over its steps; once he's formed out of it, the steps bare but for silk and broken gilt;
// - the old door: a great round arch of the old kingdom's green stone in the rock, sealed by a slab carved with a tower
//   in a ring (EvenHold's old sign), the cold light of its seal in the cuts.

import * as THREE from 'three';
import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import { greedyMesh, type VoxelGrid } from '../meshes/voxel/greedyMesh';
import { CRYPT_PALETTE, CRYPT_VOXEL, C, GLOW, OUT, TALL, TILE, wallTile, type Box } from '../crypt/cryptVoxels';
import { hashUnit } from '../../util/random';

const OWN = { gilt: 0xd8a838, giltLight: 0xf2d070, giltDark: 0x9a6e1e, silk: 0x9a1c24, silkDark: 0x5e1018, crystal: 0xcfe8f0, green: 0x4e5e52, greenDark: 0x37433a, seal: 0x8fd8ff } as const;
export const RELIQUARY_PALETTE = [...CRYPT_PALETTE, ...Object.values(OWN)];
const R = Object.fromEntries(Object.keys(OWN).map((name, i) => [name, CRYPT_PALETTE.length + i + 1])) as Record<keyof typeof OWN, number>;
const SHINING = new Set([...GLOW, R.seal]); // drawn unlit

// A piece of the reliquary meshed from `origin`: what's lit, or what glows (`glow`).
export function reliquaryGeometry(grid: VoxelGrid, origin: THREE.Vector3, glow: boolean): THREE.BufferGeometry {
  return greedyMesh(grid, RELIQUARY_PALETTE, CRYPT_VOXEL, origin, (c) => SHINING.has(c) === glow);
}

const boxIn = (grid: VoxelGrid): Box => (u0, y0, v0, u1, y1, v1, color) => fillBox(grid, u0, y0, v0, u1, y1, v1, typeof color === 'number' ? () => color : color);

const COURSE = 6; // voxels a course of bones is high
const LINED = [3, TALL - 6] as const; // the bones' first and last rows, up a face

// The colour of the bone lining at `along` a face and `y` up it (null: the stone's own). Courses of skulls (five
// across, sockets dark, a voxel's dark gap between) and of long bones' knobbed ends, by turns.
function lining(along: number, y: number): number | null {
  if (y < LINED[0] || y > LINED[1]) return null;
  const row = (y - LINED[0]) % COURSE;
  const course = Math.floor((y - LINED[0]) / COURSE);
  if (row === COURSE - 1) return C.socket; // (between the courses)
  if (course % 2 === 0) {
    const k = (along + course) % 6;
    if (k === 5) return C.socket;
    if (row === 0) return C.boneShade; // the jaw
    if (row >= 2 && row <= 3 && (k === 1 || k === 3)) return C.socket; // the sockets
    return C.bone;
  }
  const k = (along + course * 2) % 3;
  return k === 0 ? C.boneDark : (row + k) % 4 === 0 ? C.boneShade : C.bone; // the long bones' ends, knobbed
}

// A tile of rock lined with bone on every face (`variant` a crypt wall's look, under it).
export function boneWall(variant: number): VoxelGrid {
  const grid = wallTile(TALL, variant);
  for (let u = 0; u < TILE; u++) for (let v = 0; v < TILE; v++) {
    const depth = Math.min(u, v, TILE - 1 - u, TILE - 1 - v);
    if (depth > 0) continue;
    const along = Math.min(v, TILE - 1 - v) <= Math.min(u, TILE - 1 - u) ? u : v;
    for (let y = 0; y < TALL; y++) {
      const c = lining(along, y);
      if (c) fillBox(grid, u, y, v, u, y, v, c);
    }
  }
  return grid;
}

// A gilt casket (a little house: its roof pitched along u) at (u0, y0, v0), `w` long.
function casketAt(box: Box, u0: number, y0: number, v0: number, w: number, salt: number): void {
  box(u0, y0, v0, u0 + w - 1, y0 + 1, v0 + 8, R.giltDark); // its foot
  box(u0 + 1, y0 + 2, v0 + 1, u0 + w - 2, y0 + 7, v0 + 7, R.gilt); // its body
  for (let u = u0 + 3; u <= u0 + w - 4; u += 4) {
    box(u, y0 + 3, v0 + 8 - 1, u + 1, y0 + 6, v0 + 8 - 1, R.crystal); // a window down its side
    box(u, y0 + 4, v0 + 8 - 1, u + 1, y0 + 4, v0 + 8 - 1, C.bone); // a bone behind it
  }
  for (let k = 0; k <= 3; k++) box(u0 + 1, y0 + 8 + k, v0 + 1 + k, u0 + w - 2, y0 + 8 + k, v0 + 7 - k, k === 3 ? R.giltLight : R.gilt); // the roof, pitched
  box(u0 + Math.floor(w / 2), y0 + 12, v0 + 4, u0 + Math.floor(w / 2), y0 + 13 + (salt % 2), v0 + 4, R.giltLight); // a finial
}

const PIECES = {
  // A casket on a stone foot, red silk laid under it.
  casket: { size: [TILE, 18, TILE] as [number, number, number], paint: (box: Box, variant: number) => {
    box(3, 0, 4, 21, 3, 20, C.stone);
    box(3, 3, 4, 21, 3, 20, C.stoneLight);
    box(4, 4, 6, 20, 4, 18, R.silk);
    box(4, 4, 18, 20, 4, 18, R.silkDark);
    casketAt(box, 5, 5, 8, 15, variant);
  } },
  // A column of skulls (gilt bands at its foot and its top), five a face, course on course.
  pillar: { size: [TILE, TALL, TILE] as [number, number, number], paint: (box: Box) => {
    const [a, b] = [5, 19];
    box(a - 1, 0, a - 1, b + 1, 2, b + 1, R.giltDark);
    for (let y = 3; y < TALL - 3; y++) for (let u = a; u <= b; u++) for (let v = a; v <= b; v++) {
      const face = u === a || u === b || v === a || v === b;
      if (!face) continue;
      const along = u === a || u === b ? v : u;
      box(u, y, v, u, y, v, lining(along - a, y) ?? C.bone);
    }
    box(a - 1, TALL - 3, a - 1, b + 1, TALL - 2, b + 1, R.gilt);
    box(a, TALL - 1, a, b, TALL - 1, b, R.giltLight);
  } },
  // A saint's plinth: a low stone block, a gilt edge round its top.
  plinth: { size: [TILE, 3, TILE] as [number, number, number], paint: (box: Box) => {
    box(1, 0, 1, TILE - 2, 2, TILE - 2, C.stone);
    box(1, 2, 1, TILE - 2, 2, TILE - 2, R.giltDark);
    box(3, 2, 3, TILE - 4, 2, TILE - 4, C.stoneLight);
  } },
} as const;
export type ReliquaryPiece = keyof typeof PIECES;

export function reliquaryPiece(kind: ReliquaryPiece, variant: number): VoxelGrid {
  const grid = createGrid(PIECES[kind].size);
  PIECES[kind].paint(boxIn(grid), variant);
  return grid;
}

export const SHRINE_TILES = [4, 2] as const; // its tiles, across and deep

// The Deacon's shrine: three steps up, red silk down them; heaped on top, caskets, a monstrance, an arm in gilt, and
// candles burning at its corners. `formed`: he's come out of it, the heap gone, broken gilt and bone left on the steps.
export function shrine(formed: boolean): VoxelGrid {
  const [w, d] = [TILE * SHRINE_TILES[0], TILE * SHRINE_TILES[1]];
  const grid = createGrid([w, 52, d]);
  const box = boxIn(grid);
  for (let k = 0; k < 3; k++) box(2 + k * 4, k * 3, 2 + k * 3, w - 3 - k * 4, k * 3 + 2, d - 3 - k * 3, k % 2 ? C.stoneLight : C.stone); // the steps
  box(w / 2 - 12, 0, d - 3, w / 2 + 11, 8, d - 3, R.silk); // red silk down their front
  for (let u = w / 2 - 12; u <= w / 2 + 11; u += 3) box(u, 0, d - 3, u, 8, d - 3, R.silkDark);
  const top = 9;
  if (formed) {
    for (const [u, v] of [[20, 20], [55, 24], [70, 14]]) box(u, top, v, u + 3, top, v + 2, R.giltDark); // broken gilt
    for (const [u, v] of [[34, 18], [62, 30]]) box(u, top, v, u + 5, top, v + 1, C.bone); // and bone
    return grid;
  }
  casketAt(box, 16, top, 10, 19, 1);
  casketAt(box, 62, top, 12, 17, 2);
  casketAt(box, 38, top + 13, 16, 21, 3); // (one on another)
  box(36, top, 14, 60, top + 12, 26, R.giltDark); // what it stands on
  // The monstrance, high in the middle: a gilt sunburst on a stem, the crystal at its heart.
  box(49, top + 26, 21, 50, top + 31, 22, R.giltDark);
  for (let u = 42; u <= 57; u++) for (let y = top + 31; y <= top + 30 + 9; y++) if (Math.hypot(u - 49.5, y - (top + 35)) < 5) box(u, y, 21, u, y, 22, (u + y) % 2 ? R.giltLight : R.gilt);
  box(48, top + 33, 23, 51, top + 37, 23, R.crystal);
  // A gilt arm laid along the front, its hand raised.
  box(22, top, 30, 40, top + 3, 33, R.gilt);
  box(40, top, 30, 42, top + 7, 33, R.giltLight);
  box(28, top + 1, 34, 33, top + 2, 34, R.crystal);
  // Candles at its corners, burning.
  for (const [u, v] of [[5, 5], [w - 9, 5], [5, d - 9], [w - 9, d - 9]]) {
    const high = 9 + Math.floor(hashUnit(u, v, 471) * 6);
    box(u, 0, v, u + 2, high, v + 2, C.wax);
    box(u + 1, high + 1, v + 1, u + 1, high + 2, v + 1, C.flame);
    box(u + 1, high + 3, v + 1, u + 1, high + 3, v + 1, C.core);
  }
  return grid;
}

// The old door, a wall piece two tiles across: a round arch of green stone standing out from the bone, a slab in it
// carved with a tower in a ring, its cuts lit by the seal's cold light.
export function oldDoor(): VoxelGrid {
  const w = TILE * 2;
  const grid = createGrid([w, TALL, TILE + OUT]);
  const box = boxIn(grid);
  const mid = w / 2 - 0.5;
  const archTop = (u: number) => 22 + Math.round(8 * Math.sqrt(Math.max(0, 1 - ((u - mid) / 15) ** 2)));
  for (let u = 6; u < w - 6; u++) {
    const top = archTop(u);
    const inside = u >= 10 && u < w - 10;
    for (let y = 0; y <= top + 2; y++) {
      const ring = !inside || y > archTop(u) - 3;
      box(u, y, TILE, u, y, TILE + (ring ? 2 : 1), ring ? ((u + y) % 4 === 0 ? R.greenDark : R.green) : C.stoneDark);
    }
  }
  // The tower in its ring, cut into the slab, the seal's light in the cuts.
  const [cu, cy] = [mid, 13];
  for (let u = 11; u < w - 11; u++) for (let y = 3; y < 24; y++) {
    const r = Math.hypot(u - cu, y - cy);
    const tower = Math.abs(u - cu) <= 3 && y >= 7 && y <= 17 && !(y === 17 && Math.abs(u - cu) % 2 === 1);
    if ((r >= 8 && r < 9) || tower) box(u, y, TILE + 2, u, y, TILE + 2, R.seal);
  }
  return grid;
}
