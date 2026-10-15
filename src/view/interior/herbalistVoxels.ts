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
  COAL,
  BRASS,
  BRASS_DARK,
  CLAY,
  CLAY_DARK,
  GLASS_CLEAR,
  PARCHMENT,
  INK,
  LINEN,
  BREAD,
  MOSS,
  MOSS_DARK,
  MOSS_LIGHT,
  PLUM_LIGHT,
  BREW,
  BREW_GLOW,
  PALE_STONE,
  TWINE,
  ROOT,
  ROOT_LIGHT,
  CAP_RED,
  CAP_SPOT,
  CAP_TAN,
  SACKING,
  SACKING_DARK,
  BIRCH,
  BIRCH_MARK,
  HERB_GLASS_GREEN,
  HERB_GLASS_AMBER,
  HERB_GLASS_COBALT,
  HERB_GLASS_ROSE,
  BONE,
  BONE_DARK,
  BERRY,
  HERB_DEEP,
  HERB_SAGE,
  HERB_GOLD,
  HERB_LAVENDER,
  type Box,
} from './furniturePalette';
import type { Furniture } from '../../model/interiors/furniture';

export type HerbalistKind = 'cauldron' | 'herbCounter' | 'herbTable' | 'dryingRack' | 'potionShelf' | 'herbStores';

// A small corked flask standing at (u, y, v): a round body of `glass`, a neck, a cork.
function flask(box: Box, u: number, y: number, v: number, glass: number): void {
  box(u, y, v, u + 2, y + 2, v + 2, (uu, yy, vv) => ((uu === u || uu === u + 2) && (vv === v || vv === v + 2) && yy !== y + 1 ? 0 : glass)); // the body, rounded
  box(u + 1, y + 3, v + 1, u + 1, y + 3, v + 1, GLASS_CLEAR); // the neck
  box(u + 1, y + 4, v + 1, u + 1, y + 4, v + 1, WOOD_DARK); // the cork
}

// A bundle of herbs hung upside down from (u, y, v) to dry, `long` voxels in all: a twine tie, the stems bound under
// it, then the heads of `leaf` spreading out below, two voxels deep.
function bundle(box: Box, u: number, y: number, v: number, leaf: number, long = 7): void {
  box(u, y, v, u, y, v + 1, TWINE); // the tie
  box(u, y - 2, v, u, y - 1, v + 1, MOSS_DARK); // the stems
  box(u - 1, y - long + 1, v, u + 1, y - 3, v + 1, (uu, yy) => ((yy === y - 3 || yy === y - long + 1) && uu !== u ? 0 : leaf)); // the heads
}

// A round woven basket on the floor, its middle at (u, v): wicker in a checker of two tones, rounded at the corners,
// a darker rim, and what's in it heaped over it, higher in the middle (dried leaves, unless `heap` says otherwise).
function basket(box: Box, u: number, v: number, heap = [BREAD, MOSS_LIGHT, BREAD, PLUM_LIGHT, MOSS]): void {
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
  for (let y = 2; y <= 7; y++) {
    const r = y <= 5 ? R - 1.2 : y === 6 ? 2.6 : 1.3; // (filling it, then heaped)
    box(u - 4, y, v - 4, u + 4, y, v + 4, (uu, _y, vv) => (within(uu, vv, r) ? heap[(uu * 3 + vv * 5 + y) % heap.length] : 0));
  }
}

export const HERBALIST_PAINTERS: Record<HerbalistKind, (box: Box, len: number, dep: number, item: Furniture) => void> = {
  // A black iron cauldron, round-bellied, on three stubby legs over a bed of
  // embers: soot-black all over, a band of bare iron under its lip catching
  // the light, a green brew glowing in it (brightest at its heart, scum at
  // its edge; its bubbles: cauldronEffects.ts), a ladle leaning on the rim; a ring of pale
  // stones laid round it on the floor (her one uncanny mark), clay pots and
  // birch twigs in its back corners by the hearth, and her stool in the
  // front one, to sit and stir from.
  cauldron: (box) => {
    const c = 12;
    const at = (r: number) => (u: number, v: number) => Math.hypot(u - c, v - c) <= r + 0.3;
    const near = (u: number, v: number) => u + v - 2 * c; // (toward the camera: its lit side)
    for (let k = 0; k < 7; k++) { // the ring of pale stones (round from the stool's corner)
      const a = 2.36 + ((k + 1) * Math.PI * 2) / 8;
      const [u, v] = [Math.round(c + Math.cos(a) * 10.5), Math.round(c + Math.sin(a) * 10.5)];
      box(u, 1, v, u + 1, 1, v + 1, PALE_STONE);
    }
    box(c - 6, 1, c - 6, c + 6, 1, c + 6, (u, _y, v) => (at(6)(u, v) ? ((u * 5 + v * 3) % 7 === 0 ? FIRE : (u + v * 2) % 5 === 0 ? COAL : EMBER) : 0)); // the embers
    for (const a of [1.2, 3.3, 5.4]) { // its legs
      const [u, v] = [Math.round(c + Math.cos(a) * 4), Math.round(c + Math.sin(a) * 4)];
      box(u, 2, v, u, 3, v, SOOT);
    }
    const belly = [4, 6, 7, 8, 8, 8, 7, 7]; // its radius, from the bottom up
    belly.forEach((r, i) => box(c - r, 4 + i, c - r, c + r, 4 + i, c + r, (u, _y, v) => {
      if (!at(r)(u, v)) return 0;
      if (i < 2) return COAL; // (sooted from the fire)
      return i === 6 && near(u, v) > 0 ? IRON : SOOT; // (bare iron under the lip, on its lit side)
    }));
    const top = 4 + belly.length; // the brew's level, and its rim's
    box(c - 8, top, c - 8, c + 8, top, c + 8, (u, _y, v) => {
      if (!at(8)(u, v)) return 0;
      if (!at(6)(u, v)) return near(u, v) > 6 ? IRON : SOOT; // the lip
      const r = Math.hypot(u - c, v - c);
      return r < 2.6 || (r < 4 && (u * 3 + v) % 4 === 0) ? BREW_GLOW : r > 5 && (u + v) % 2 === 0 ? MOSS_LIGHT : BREW; // the brew, scum at its edge
    });
    for (let k = 3; k < 7; k++) box(c - 2 - k, top - 2 + k, c - 2 - (k >> 1), c - 2 - k, top - 2 + k, c - 2 - (k >> 1), WOOD_DARK); // the ladle's handle, leaning out over the rim
    // Clay pots stacked in the corner by the hearth, the top one upside down; a bundle of birch twigs, tied, leaning in
    // the other.
    for (const [y0, y1, r] of [[1, 4, 2.4], [5, 7, 1.9], [8, 9, 1.4]] as const) {
      box(19, y0, 0, 24, y1, 5, (u, y, v) => (Math.hypot(u - 21.5, v - 2.5) > r ? 0 : y === y1 ? CLAY_DARK : CLAY));
    }
    for (const [u, v] of [[1, 2], [2, 3], [3, 2], [2, 1], [1, 4]]) {
      for (let y = 1; y <= 16; y++) box(u + (y > 10 ? 1 : 0), y, v - (y > 12 ? 1 : 0), u + (y > 10 ? 1 : 0), y, v - (y > 12 ? 1 : 0), y === 8 ? TWINE : (y + u) % 4 === 0 ? BIRCH_MARK : BIRCH);
    }
    // Her stool, three-legged, in the near corner.
    for (const [u, v] of [[0, 19], [5, 19], [2, 24]]) box(u, 1, v, u, 8, v, WOOD_DARK);
    box(0, 9, 19, 5, 9, 24, (u, _y, v) => ((u === 0 || u === 5) && (v === 19 || v === 24) ? 0 : WOOD_DARK));
  },
  // Two tiles of oak, its front toward the door: on it a stone mortar and
  // its pestle, three flasks (rose, cobalt, green), a squat candle, the herbal open,
  // a brass balance, a bunch of herbs.
  herbCounter: (box, len) => {
    box(1, 1, 7, len - 2, 2, 19, WOOD_DARK); // plinth
    box(2, 3, 8, len - 3, 12, 18, (u, y, v) => (v === 18 && (u % 12 === 2 || y === 7) ? WOOD_DARK : WOOD)); // body, panelled
    box(0, 13, 6, len - 1, 14, 20, (_u, y, v) => (y === 13 ? WOOD_DARK : v === 20 ? WOOD_LIGHT : WOOD)); // the top, its edge lit
    box(5, 15, 11, 10, 17, 16, (u, y, v) => ((u === 5 || u === 10) && (v === 11 || v === 16) ? 0 : y > 15 && u > 5 && u < 10 && v > 11 && v < 16 ? (y === 16 ? MOSS_DARK : 0) : y === 17 ? STONE : STONE_DARK)); // the mortar, round, its rim lighter, herbs ground in it
    for (let k = 0; k <= 5; k++) box(8 + (k >> 1), 16 + k, 13, 8 + (k >> 1), 16 + k, 13, WOOD_LIGHT); // the pestle, leaning out of it
    flask(box, 15, 15, 12, HERB_GLASS_ROSE);
    flask(box, 19, 15, 14, HERB_GLASS_COBALT);
    flask(box, 23, 15, 12, HERB_GLASS_GREEN);
    box(25, 15, 15, 28, 15, 18, CLAY_DARK); // a squat candle on a dish, lit (its flame: cauldronEffects.ts)
    box(26, 16, 16, 27, 17, 17, LINEN);
    box(29, 15, 10, 40, 15, 17, (u, _y, v) => (u === 34 || u === 35 ? CLAY_DARK : (v === 12 || v === 14 || v === 16) && u !== 29 && u !== 40 ? INK : PARCHMENT)); // the herbal, open
    // A brass balance to weigh out the herbs: its foot, its post, its beam, a pan hung at each end, a pinch in one.
    box(44, 15, 13, 46, 15, 15, BRASS_DARK);
    box(45, 16, 14, 45, 21, 14, BRASS_DARK);
    box(42, 22, 14, 48, 22, 14, BRASS);
    for (const u of [42, 48]) {
      box(u, 19, 14, u, 21, 14, BRASS_DARK); // its cords
      box(u - 1, 18, 13, u + 1, 18, 15, BRASS); // its pan
    }
    box(42, 19, 14, 42, 19, 14, MOSS_LIGHT);
    for (let u = 2; u <= 4; u++) box(u, 15, 15 + (u % 2), u, 15, 18, u % 2 ? MOSS_LIGHT : MOSS); // a bunch of herbs, lying
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
    jar(39, 7, 5, HERB_GLASS_AMBER, HERB_GLASS_AMBER); // amber
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
    // (its flame, flickering, meshed apart: cauldronEffects.ts)
  },
  // Against the wall, shallow: two thin uprights and two poles across them,
  // crowded with bundles of herbs hung out in front of the poles to dry
  // (deep green, sage, gold, lavender, rose hips), a basket of dried leaves
  // in under it.
  dryingRack: (box, len) => {
    for (const u of [2, len - 3]) box(u, 1, 2, u, 36, 3, WOOD_DARK); // the uprights
    const leaves = [HERB_DEEP, HERB_GOLD, HERB_LAVENDER, HERB_SAGE, BERRY, HERB_GOLD, MOSS];
    for (const [y, start] of [[35, 5], [24, 6]] as const) {
      box(1, y, 3, len - 2, y, 3, WOOD); // a pole
      for (let u = start, i = 0; u < len - 4; u += 3, i++) bundle(box, u, y, 4, leaves[(i * 3 + y) % leaves.length], 5 + ((u * 7 + y) % 4));
    }
    basket(box, 14, 8); // a basket of dried leaves, in under it
  },
  // Her stores, heaped in a corner: a basket of roots, knobbly, a basket of
  // mushrooms (red caps spotted pale, tawny ones), and a hessian sack slumped
  // against them, its mouth open, roots showing, a root or two spilled.
  herbStores: (box) => {
    basket(box, 7, 7, [ROOT, ROOT_LIGHT, ROOT, CLAY_DARK, ROOT_LIGHT]);
    basket(box, 17, 9, [CAP_RED, CAP_TAN, CAP_RED, CAP_SPOT, CAP_TAN, MOSS_DARK]);
    const [su, sv] = [10, 18];
    [4, 4.5, 4.5, 4.2, 3.6, 2.8, 2.2].forEach((r, i) => { // the sack, bulging low, leaning
      const y = i + 1;
      const cu = su + i * 0.3;
      box(su - 5, y, sv - 5, su + 7, y, sv + 5, (u, _y, v) => {
        const d = Math.hypot((u - cu) * 0.9, v - sv);
        if (d > r) return 0;
        if (i === 6) return d > r - 1 ? SACKING_DARK : ROOT_LIGHT; // its mouth, open, the roots in it
        return (u + y) % 4 === 0 ? SACKING_DARK : SACKING; // (folds)
      });
    });
    box(su, 5, sv - 3, su + 2, 5, sv + 3, (u, _y, v) => (Math.hypot(u - su - 1.2, v - sv) > 3.2 ? 0 : TWINE)); // its tie
    for (const [u, v] of [[16, 19], [17, 20], [4, 15]]) box(u, 1, v, u + 1, 1, v, ROOT); // spilled
  },
  // A shelf of their potions against the wall: three boards, flasks on
  // each (rose, cobalt, green, amber), a clay jar or two, and on the middle
  // board an animal's skull.
  potionShelf: (box) => {
    for (const u of [1, 23]) box(u, 1, 0, u, 32, 8, WOOD_DARK); // its sides
    const colors = [HERB_GLASS_ROSE, HERB_GLASS_COBALT, HERB_GLASS_GREEN, HERB_GLASS_AMBER];
    [1, 12, 23].forEach((y, row) => {
      box(1, y, 0, 23, y, 8, WOOD); // a board
      for (let k = 0; k < 4; k++) {
        const u = 3 + k * 5;
        if (row === 1 && k === 2) { // the skull, its eyes and nose dark, its teeth
          box(u - 1, y + 1, 1, u + 2, y + 3, 5, (uu, yy, vv) => ((uu === u - 1 || uu === u + 2) && yy === y + 3 && (vv === 1 || vv === 5) ? 0 : BONE));
          for (const uu of [u - 1, u + 2]) box(uu, y + 2, 5, uu, y + 2, 5, SOOT);
          box(u, y + 1, 5, u + 1, y + 1, 5, BONE_DARK);
        } else if ((row + k) % 4 === 3) box(u, y + 1, 2, u + 2, y + 4, 4, (_u, yy) => (yy === y + 4 ? CLAY_DARK : CLAY)); // a jar
        else flask(box, u, y + 1, 2, colors[(row * 2 + k) % colors.length]);
      }
    });
    box(1, 33, 0, 23, 33, 8, WOOD_DARK); // its top
  },
};
