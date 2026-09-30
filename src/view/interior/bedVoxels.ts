// A bed in voxels (u along the wall, head at u 0; v out from it): a wooden
// frame, a panelled headboard, posts with knobs, a mattress in ticking, the
// sheet turned down over a blanket (one of four colours, `cloth`) edged in a
// trim and hanging over the sides. As wide as its piece: a double (two pillows, the headboard parted
// by a stile) or a single.

import { WOOD, WOOD_DARK, WOOD_LIGHT, TEAL, LINEN, RED, RED_DARK, RED_LIGHT, PARCHMENT, BRASS, INDIGO, INDIGO_DARK, INDIGO_LIGHT, MOSS, MOSS_DARK, MOSS_LIGHT, PLUM, PLUM_DARK, PLUM_LIGHT, type Box } from './furniturePalette';

// The blankets (a bed's `cloth`, 0-3): main, shadow, light, and the trim along their edges.
const BLANKETS = [
  { main: RED, dark: RED_DARK, light: RED_LIGHT, trim: TEAL },
  { main: INDIGO, dark: INDIGO_DARK, light: INDIGO_LIGHT, trim: BRASS },
  { main: MOSS, dark: MOSS_DARK, light: MOSS_LIGHT, trim: PARCHMENT },
  { main: PLUM, dark: PLUM_DARK, light: PLUM_LIGHT, trim: LINEN },
];

export function paintBed(box: Box, len: number, dep: number, double = false, cloth = 0): void {
  const { main, dark, light, trim } = BLANKETS[cloth % BLANKETS.length];
  box(1, 1, 2, len - 2, 4, dep - 3, WOOD); // the frame
  box(2, 1, 3, 3, 13, dep - 4, (_u, y, v) => (y === 13 || v === 3 || v === dep - 4 ? WOOD_DARK : WOOD)); // headboard, panelled
  box(len - 4, 1, 3, len - 3, 8, dep - 4, WOOD_DARK); // footboard
  const mid = Math.floor(dep / 2);
  if (double) box(2, 1, mid - 1, 3, 13, mid, WOOD_DARK); // the headboard's middle stile
  for (const u of [1, len - 2]) {
    for (const v of [2, dep - 3]) {
      const top = u === 1 ? 15 : 10;
      box(u, 1, v, u, top, v, WOOD_DARK); // a post
      box(u, top + 1, v, u, top + 1, v, WOOD_LIGHT); // its knob
    }
  }
  box(4, 5, 3, len - 5, 7, dep - 4, (u) => (u % 3 === 0 ? PARCHMENT : LINEN)); // mattress, in ticking
  const pillows: Array<[number, number]> = double ? [[5, mid - 3], [mid + 2, dep - 6]] : [[5, dep - 6]];
  for (const [v0, v1] of pillows) box(5, 8, v0, 12, 10, v1, (_u, y, v) => (y === 8 || v === v0 ? PARCHMENT : LINEN)); // pillow
  box(14, 8, 3, 16, 8, dep - 4, LINEN); // the sheet, turned down
  box(17, 8, 3, len - 5, 8, dep - 4, (u, _y, v) => (v === 3 || v === dep - 4 ? trim : u === 17 ? light : main)); // blanket, its fold lit
  for (const v of [2, dep - 3]) box(17, 5, v, len - 5, 8, v, (_u, y) => (y === 5 ? trim : dark)); // hanging over the sides
}

// A nightstand, by a bed's head (back at v 0, against the wall): a small
// cabinet on short dark legs, its top overhanging and lit, a drawer framed
// in dark wood with a brass knob, and a candle on a brass dish; its top
// between the mattress and the headboard's.
export const CANDLE_FLAME = { u: 10.5, y: 19, v: 6.5 }; // where its candle's flame stands: over the candle's middle, on its top
export function paintNightstand(box: Box): void {
  for (const u of [6, 17]) for (const v of [2, 11]) box(u, 1, v, u + 1, 2, v + 1, WOOD_DARK); // legs
  box(6, 3, 2, 18, 11, 12, (_u, y) => (y === 3 ? WOOD_DARK : WOOD)); // the cabinet, its foot shaded
  box(5, 12, 1, 19, 12, 13, (u, _y, v) => (v === 13 || u === 5 || u === 19 ? WOOD_LIGHT : WOOD)); // its top, overhanging, the edge lit
  box(8, 5, 13, 16, 10, 13, (u, y) => (u === 8 || u === 16 || y === 5 || y === 10 ? WOOD_DARK : WOOD)); // the drawer, framed
  box(12, 7, 14, 12, 8, 14, BRASS); // its knob
  box(9, 13, 5, 12, 13, 8, BRASS); // the candle's dish
  box(10, 14, 6, 11, 18, 7, LINEN); // the candle
  // (its flame, flickering, meshed apart: candleFlame.ts)
}
