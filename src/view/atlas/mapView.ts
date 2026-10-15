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
