// A herbalist's own furniture in voxels (see furnitureVoxels.ts for how
// pieces are painted; laid out by herbalist/herbalistLayout.ts): the
// cauldron bubbling green on its embers, the counter they trade over (a
// mortar and pestle, three flasks, the herbal open), their worktable (a
// chopping board, jars of clay and glass, a candle), a rack of herbs
// hanging to dry, and a shelf of potions.

import {
  WOOD,
  WOOD_DARK,
  WOOD_LIGHT,
  IRON,
  IRON_LIGHT,
  SOOT,
  STONE,
  STONE_DARK,
  EMBER,
  FIRE,
  RED,
  RED_LIGHT,
  CLAY,
  CLAY_DARK,
  GLASS_GREEN,
  GLASS_AMBER,
  GLASS_CLEAR,
  PARCHMENT,
  INK,
  LINEN,
  BREAD,
  MOSS,
  MOSS_DARK,
  MOSS_LIGHT,
  PLUM_LIGHT,
  INDIGO_LIGHT,
  type Box,
} from './furniturePalette';
import type { Furniture } from '../../model/interiors/furniture';

export type HerbalistKind = 'cauldron' | 'herbCounter' | 'herbTable' | 'dryingRack' | 'potionShelf';

// A small corked flask standing at (u, y, v): a round body of `glass`, a neck, a cork.
function flask(box: Box, u: number, y: number, v: number, glass: number): void {
  box(u, y, v, u + 2, y + 2, v + 2, (uu, yy, vv) => ((uu === u || uu === u + 2) && (vv === v || vv === v + 2) && yy !== y + 1 ? 0 : glass)); // the body, rounded
  box(u + 1, y + 3, v + 1, u + 1, y + 3, v + 1, GLASS_CLEAR); // the neck
  box(u + 1, y + 4, v + 1, u + 1, y + 4, v + 1, WOOD_DARK); // the cork
}

// A bundle of herbs hanging from (u, y, v): a twine tie, then a tapering bunch of `leaf` three voxels long.
function bundle(box: Box, u: number, y: number, v: number, leaf: number): void {
  box(u, y, v, u, y, v, BREAD); // the tie
  box(u - 1, y - 3, v, u + 1, y - 1, v, (uu, yy) => (yy === y - 3 && uu !== u ? 0 : leaf));
}

// A table's legs and planked top over (u0..u1, v0..v1), `top` high.
function table(box: Box, u0: number, u1: number, v0: number, v1: number, top: number): void {
  for (const [u, v] of [[u0 + 1, v0 + 1], [u1 - 1, v0 + 1], [u0 + 1, v1 - 1], [u1 - 1, v1 - 1]]) box(u, 1, v, u, top - 2, v, WOOD_DARK);
  box(u0, top - 1, v0, u1, top, v1, (u, y) => (y === top - 1 ? WOOD_DARK : u % 6 === 0 ? WOOD : WOOD_LIGHT));
}

// A round woven basket on the floor, its middle at (u, v): wicker in a checker of two tones, rounded at the corners,
// a darker rim, and dried leaves heaped over it (gold, green, lavender), higher in the middle.
function basket(box: Box, u: number, v: number): void {
  const R = 4.6; // its radius, in voxels
  const within = (uu: number, vv: number, r: number) => Math.hypot(uu - u, vv - v) <= r;
  for (let y = 1; y <= 5; y++) {
    box(u - 5, y, v - 5, u + 5, y, v + 5, (uu, _y, vv) => {
      if (!within(uu, vv, R)) return 0;
      if (within(uu, vv, R - 1.2) && y > 1) return 0; // (hollow, its floor woven too)
      if (y === 5) return WOOD_DARK; // the rim
      return (uu + vv + y) % 2 === 0 ? WOOD_LIGHT : BREAD; // the weave
    });
  }
  const leaves = [BREAD, MOSS_LIGHT, BREAD, PLUM_LIGHT, MOSS];
  for (let y = 2; y <= 7; y++) {
    const r = y <= 5 ? R - 1.2 : y === 6 ? 2.6 : 1.3; // (filling it, then heaped)
    box(u - 4, y, v - 4, u + 4, y, v + 4, (uu, _y, vv) => (within(uu, vv, r) ? leaves[(uu * 3 + vv * 5 + y) % leaves.length] : 0));
  }
}

export const HERBALIST_PAINTERS: Record<HerbalistKind, (box: Box, len: number, dep: number, item: Furniture) => void> = {
  // An iron cauldron on three stones over a bed of embers, round-bellied,
  // its rim pale, a green brew bubbling in it, a ladle leaning in.
  cauldron: (box) => {
    const c = 12;
    const round = (r: number) => (u: number, _y: number, v: number) => (Math.hypot(u - c, v - c) <= r + 0.3 ? 1 : 0);
    for (const [u, v] of [[5, 12], [17, 6], [17, 18]]) box(u - 2, 1, v - 2, u + 2, 3, v + 2, (uu, yy, vv) => (Math.hypot(uu - u, vv - v) > 2.3 ? 0 : (uu + yy + vv) % 3 === 0 ? STONE_DARK : STONE)); // the stones
    box(6, 1, 6, 18, 1, 18, (u, y, v) => (round(5)(u, y, v) ? ((u + v) % 3 === 0 ? FIRE : EMBER) : 0)); // the embers
    const belly = [5, 7, 8, 8, 8, 8, 7, 7]; // its radius, from the bottom up
    belly.forEach((r, i) => box(c - r, 4 + i, c - r, c + r, 4 + i, c + r, (u, y, v) => (round(r)(u, y, v) ? (i < 2 ? SOOT : IRON) : 0)));
    const top = 4 + belly.length;
    box(c - 8, top, c - 8, c + 8, top, c + 8, (u, y, v) => (round(8)(u, y, v) ? (round(6)(u, y, v) ? ((u * 3 + v) % 7 === 0 ? MOSS_LIGHT : GLASS_GREEN) : IRON_LIGHT) : 0)); // its rim, and the brew
    box(c + 1, top + 1, c - 1, c + 1, top + 1, c - 1, MOSS_LIGHT); // a bubble
    box(c - 3, top - 2, c + 2, c - 3, top + 6, c + 2, WOOD); // the ladle's handle, leaning in
  },
  // Two tiles of oak, its front toward the door: on it a stone mortar and
  // its pestle, three flasks (red, blue, green), the herbal open, a bunch
  // of herbs.
  herbCounter: (box, len) => {
    box(1, 1, 7, len - 2, 2, 19, WOOD_DARK); // plinth
    box(2, 3, 8, len - 3, 12, 18, (u, y, v) => (v === 18 && (u % 12 === 2 || y === 7) ? WOOD_DARK : WOOD)); // body, panelled
    box(0, 13, 6, len - 1, 14, 20, (_u, y, v) => (y === 13 ? WOOD_DARK : v === 20 ? WOOD_LIGHT : WOOD)); // the top, its edge lit
    box(5, 15, 11, 10, 17, 16, (u, y, v) => (y > 15 && u > 5 && u < 10 && v > 11 && v < 16 ? (y === 17 ? MOSS : 0) : STONE)); // the mortar, herbs in it
    box(8, 16, 13, 10, 21, 13, WOOD_LIGHT); // the pestle, standing in it
    flask(box, 15, 15, 12, RED);
    flask(box, 19, 15, 14, INDIGO_LIGHT);
    flask(box, 23, 15, 12, GLASS_GREEN);
    box(29, 15, 10, 40, 15, 17, (u, _y, v) => (u === 34 || u === 35 ? CLAY_DARK : (v === 12 || v === 14 || v === 16) && u !== 29 && u !== 40 ? INK : PARCHMENT)); // the herbal, open
    for (let u = 43; u <= 46; u++) box(u, 15, 12 + (u % 2), u, 15, 15 + (u % 2), u % 2 ? MOSS_LIGHT : MOSS); // a bunch of herbs, lying
  },
  // Their worktable: a chopping board of herbs and a knife, jars of clay
  // and glass in a row, a candle at the end.
  herbTable: (box, len) => {
    table(box, 1, len - 2, 3, 21, 13);
    box(4, 14, 7, 16, 14, 17, WOOD); // the board
    for (const [u, v] of [[6, 9], [9, 13], [12, 10], [8, 16], [14, 15]]) box(u, 15, v, u + 1, 15, v, (u + v) % 2 ? MOSS_LIGHT : MOSS); // chopped herbs
    box(11, 15, 15, 15, 15, 15, IRON_LIGHT); // the knife's blade,
    box(16, 15, 15, 18, 15, 15, WOOD_DARK); // its handle
    for (const [u, color, lid] of [[22, CLAY, CLAY_DARK], [27, CLAY_DARK, WOOD_DARK], [32, GLASS_GREEN, WOOD_DARK], [37, GLASS_AMBER, WOOD_DARK]] as const) {
      box(u, 14, 8, u + 3, 18, 11, color); // a jar
      box(u, 19, 8, u + 3, 19, 11, lid); // its lid
    }
    box(43, 14, 12, 44, 18, 13, LINEN); // the candle
    box(43, 19, 12, 43, 19, 12, EMBER); // its flame
  },
  // Against the wall: two uprights and two poles across them, bundles of
  // herbs hanging under each (green, sage, dried gold, lavender).
  dryingRack: (box, len) => {
    for (const u of [2, len - 3]) box(u, 1, 2, u + 1, 34, 4, WOOD_DARK); // the uprights
    const leaves = [MOSS, MOSS_LIGHT, BREAD, PLUM_LIGHT, MOSS_DARK];
    for (const [y, start] of [[33, 6], [23, 8]] as const) {
      box(2, y, 3, len - 3, y, 3, WOOD); // a pole
      for (let u = start, i = 0; u < len - 5; u += 5, i++) bundle(box, u, y - 1, 3, leaves[(i + y) % leaves.length]);
    }
    basket(box, 15, 9); // a basket of dried leaves below
  },
  // A shelf of their potions against the wall: three boards, flasks on
  // each (red, blue, green, amber), a clay jar or two.
  potionShelf: (box) => {
    for (const u of [1, 23]) box(u, 1, 0, u, 32, 8, WOOD_DARK); // its sides
    const colors = [RED, INDIGO_LIGHT, GLASS_GREEN, GLASS_AMBER, RED_LIGHT];
    [1, 12, 23].forEach((y, row) => {
      box(1, y, 0, 23, y, 8, WOOD); // a board
      for (let k = 0; k < 4; k++) {
        const u = 3 + k * 5;
        if ((row + k) % 4 === 3) box(u, y + 1, 2, u + 2, y + 4, 4, (_u, yy) => (yy === y + 4 ? CLAY_DARK : CLAY)); // a jar
        else flask(box, u, y + 1, 2, colors[(row * 2 + k) % colors.length]);
      }
    });
    box(1, 33, 0, 23, 33, 8, WOOD_DARK); // its top
  },
};
