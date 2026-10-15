// How the map's laid on the screen: turned as the game's camera is (view/constants.ts CAMERA_YAW: it looks along
// -X-Z), so up the map is up the screen in the game; the words and marks on it kept upright.

import { CAMERA_YAW } from '../constants';
import type { MapLook } from './mapPaint';

const [COS, SIN] = [Math.cos(CAMERA_YAW), Math.sin(CAMERA_YAW)];
export const TURN = CAMERA_YAW; // (the ctx.rotate that lays a north-up picture so)

// Tile (x, z) on a `width` by `height` map, in its pixels.
export function toScreen(look: MapLook, width: number, height: number, x: number, z: number): [number, number] {
  const [dx, dz] = [(x - look.x) * look.scale, (z - look.z) * look.scale];
  return [width / 2 + dx * COS - dz * SIN, height / 2 + dx * SIN + dz * COS];
}

// How far across the land (x, z) a step of (dx, dy) pixels is, at `scale`.
export function along(scale: number, dx: number, dy: number): [number, number] {
  return [(dx * COS + dy * SIN) / scale, (dy * COS - dx * SIN) / scale];
}

const [FIT_LEAST, FIT_MOST] = [0.5, 4]; // as it opens, drawn to fit all that's been seen: no farther out, nor closer in (past 4, a fresh hero's land a few blocks)
const FIT_MARGIN = 0.9; // of the window the land seen fills, fitted

// `look` drawn to fit the cells seen (their corners, CELL tiles a side) on a `width` by `height` map: the land seen as it
// lies turned, not the box round it (a fresh hero's round of land, the box's corners turned out, came out a third
// smaller); `look` kept at the middle if the land seen fits round it, else the land's middle (each way across).
export function fitLook(look: MapLook, cells: Iterable<[number, number]>, cell: number, width: number, height: number): void {
  const at = { ...look, scale: 1 };
  let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity]; // (kept as it goes: a long road's thousands of cells)
  for (const [x, z] of cells) {
    for (const [ox, oz] of [[0, 0], [cell, 0], [0, cell], [cell, cell]]) {
      const [sx, sy] = toScreen(at, 0, 0, x + ox, z + oz);
      [x0, x1, y0, y1] = [Math.min(x0, sx), Math.max(x1, sx), Math.min(y0, sy), Math.max(y1, sy)];
    }
  }
  if (x0 === Infinity) return;
  const around = (lo: number, hi: number) => 2 * Math.max(-lo, hi);
  look.scale = Math.min(FIT_MOST, Math.max(FIT_LEAST, FIT_MARGIN * Math.min(width / around(x0, x1), height / around(y0, y1))));
  const round = (lo: number, hi: number, room: number) => (around(lo, hi) * look.scale <= room ? 0 : (lo + hi) / 2);
  const [dx, dz] = along(1, round(x0, x1, width), round(y0, y1, height));
  [look.x, look.z] = [look.x + dx, look.z + dz];
}

// The tile under pixel (sx, sy).
export function toMap(look: MapLook, width: number, height: number, sx: number, sy: number): [number, number] {
  const [dx, dz] = along(look.scale, sx - width / 2, sy - height / 2);
  return [look.x + dx, look.z + dz];
}

// The hero's facing (sin, cos across x, z) as the screen's (sin, cos across x, y).
export const screenFacing = (facing: number) => facing - CAMERA_YAW;

// A point off the map held at its edge (a margin `m` in from it: left/right `m.x`, top `m.top`, bottom `m.bottom`), on
// the line from the middle toward it: so it points the way to go.
export function atRim(x: number, y: number, width: number, height: number, m = { x: 8, top: 16, bottom: 4 }): [number, number] {
  const [cx, cy] = [width / 2, height / 2];
  const [dx, dy] = [x - cx, y - cy];
  const room = (d: number, less: number, more: number) => (d > 0 ? more / d : d < 0 ? -less / d : Infinity);
  const t = Math.min(1, room(dx, cx - m.x, width - m.x - cx), room(dy, cy - m.top, height - m.bottom - cy));
  return [cx + dx * t, cy + dy * t];
}

// A little compass in the corner: an arrow for north (-z) and its N.
export function compass(ctx: CanvasRenderingContext2D, x: number, y: number, ink: string): void {
  const [nx, ny] = [SIN, -COS]; // (north, (0, -1), on the screen)
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - nx * 7, y - ny * 7);
  ctx.lineTo(x + nx * 7, y + ny * 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + nx * 9, y + ny * 9);
  ctx.lineTo(x + nx * 3 - ny * 3, y + ny * 3 + nx * 3);
  ctx.lineTo(x + nx * 3 + ny * 3, y + ny * 3 - nx * 3);
  ctx.closePath();
  ctx.fill();
  ctx.font = "700 10px 'Fredoka', system-ui, sans-serif";
  ctx.textAlign = 'center';
  ctx.fillText('N', x + nx * 15, y + ny * 15 + 4);
}
