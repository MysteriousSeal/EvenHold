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
  // Their worktable, sturdy and worn: legs braced by stretchers, an apron
  // under its top, the planks' grooves sunk into it, its edge worn pale. On
  // it: a chopping board with a raised rim, herbs chopped on it and a knife;
  // a stone mortar, herbs in its hollow, its pestle leaning in; jars of
  // three heights, glass ones showing the herbs inside, clay ones under
  // cloth tied with twine; a squat amber bottle; a bunch of herbs lying by
  // the board, loose leaves about; a candle on a dish, wax run down it.
  herbTable: (box, len) => {
    const [u0, u1, v0, v1, top] = [1, len - 2, 3, 21, 13];
    for (const [u, v] of [[u0 + 1, v0 + 1], [u1 - 2, v0 + 1], [u0 + 1, v1 - 2], [u1 - 2, v1 - 2]]) box(u, 1, v, u + 1, top - 3, v + 1, WOOD_DARK); // the legs, two voxels square
    box(u0 + 3, 3, v0 + 1, u1 - 3, 3, v0 + 1, WOOD_DARK); // the stretchers, low: along the back,
    box(u0 + 3, 3, v1 - 1, u1 - 3, 3, v1 - 1, WOOD_DARK); // the front,
    for (const u of [u0 + 1, u1 - 1]) box(u, 3, v0 + 3, u, 3, v1 - 3, WOOD_DARK); // and the ends
    box(u0 + 1, top - 2, v0 + 1, u1 - 1, top - 2, v1 - 1, (u, _y, v) => (u === u0 + 1 || u === u1 - 1 || v === v0 + 1 || v === v1 - 1 ? WOOD_DARK : 0)); // the apron
    // The top: planks along it, a groove sunk between each, its edge worn lighter.
    box(u0, top - 1, v0, u1, top - 1, v1, WOOD_DARK);
    box(u0, top, v0, u1, top, v1, (u, _y, v) => ((v - v0) % 6 === 5 ? 0 : u === u0 || u === u1 || v === v0 || v === v1 ? WOOD_LIGHT : (u * 7 + v) % 23 === 0 ? WOOD_DARK : WOOD));
    const on = top + 1; // what stands on it
    // The chopping board: raised, its rim a voxel up, herbs chopped on it, a knife across it.
    box(3, on, 6, 17, on, 17, WOOD);
    box(3, on + 1, 6, 17, on + 1, 17, (u, _y, v) => (u === 3 || u === 17 || v === 6 || v === 17 ? WOOD_DARK : 0));
    for (const [u, v] of [[6, 9], [7, 9], [9, 12], [12, 10], [13, 10], [8, 15], [14, 14], [11, 14]]) box(u, on + 1, v, u, on + 1, v, (u + v) % 3 ? MOSS_LIGHT : MOSS); // chopped herbs
    box(10, on + 1, 15, 15, on + 1, 15, IRON_LIGHT); // the knife's blade,
    box(16, on + 1, 15, 19, on + 2, 15, WOOD_DARK); // its handle, off the board's edge
    // The mortar: a stone bowl, hollow, herbs ground in it, the pestle leaning out of it.
    box(21, on, 13, 26, on + 3, 18, (u, y, v) => {
      const edge = u === 21 || u === 26 || v === 13 || v === 18;
      if ((u === 21 || u === 26) && (v === 13 || v === 18)) return 0; // (rounded)
      if (!edge && y > on) return y === on + 1 ? MOSS_DARK : 0; // (its hollow, herbs at the bottom)
      return y === on + 3 ? STONE : STONE_DARK;
    });
    for (let k = 0; k <= 4; k++) box(24 + Math.floor(k / 2), on + 2 + k, 15, 24 + Math.floor(k / 2), on + 2 + k, 15, WOOD_LIGHT); // the pestle
    // Jars: a tall glass one, herbs showing through; a squat clay one under cloth tied with twine; a glass one of
    // something amber; a clay one, corked.
    const jar = (u: number, v: number, high: number, glass: number, inside: number) => {
      box(u, on, v, u + 3, on + high, v + 3, (uu, y, vv) => ((uu === u || uu === u + 3) && (vv === v || vv === v + 3) ? 0 : y < on + high - 1 && (uu + y) % 3 === 0 ? inside : glass));
    };
    jar(29, 7, 7, GLASS_CLEAR, MOSS); // tall, glass, herbs in it
    box(30, on + 7, 8, 31, on + 7, 9, WOOD_DARK); // its cork
    jar(34, 8, 4, CLAY, CLAY);
    box(34, on + 4, 8, 37, on + 4, 11, LINEN); // its cloth,
    box(34, on + 3, 8, 37, on + 3, 11, (uu, _y, vv) => (uu === 34 || uu === 37 || vv === 8 || vv === 11 ? BREAD : CLAY)); // tied round with twine
    jar(39, 7, 5, GLASS_AMBER, GLASS_AMBER); // amber
    box(40, on + 5, 8, 41, on + 6, 9, GLASS_CLEAR); // its neck
    box(40, on + 7, 8, 41, on + 7, 9, WOOD_DARK); // its cork
    jar(30, 13, 3, CLAY_DARK, CLAY_DARK); // a small dark one
    box(31, on + 3, 14, 32, on + 3, 15, WOOD_DARK);
    // A bunch of herbs lying by the board, a leaf or two loose.
    for (let u = 4; u <= 9; u++) box(u, on, 19, u, on + (u < 7 ? 1 : 0), 20, u < 7 ? (u % 2 ? MOSS : MOSS_LIGHT) : BREAD);
    for (const [u, v] of [[20, 9], [28, 19], [36, 17]]) box(u, on, v, u, on, v, MOSS_LIGHT);
    // The candle: on a clay dish, wax run down its side, its flame.
    box(43, on, 13, 46, on, 16, CLAY_DARK);
    box(44, on + 1, 14, 45, on + 5, 15, LINEN);
    box(46, on + 1, 15, 46, on + 2, 15, LINEN); // a drip, run down to the dish
    box(44, on + 6, 14, 44, on + 6, 14, EMBER);
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
