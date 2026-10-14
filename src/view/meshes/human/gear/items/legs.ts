// How everything worn on the legs looks. Legs shells cover the hips (torso
// rows 0-1, x -1..7, z -1..4 with 4 the front; row 1 is where a belt sits)
// and each leg's rows 2-4 (x -1..3, z -1..3 with 3 the front of the shin;
// the side toward the other leg stays open).
//
// The new leg pieces (each its set's colours: setPalettes.ts):
// - barrowGreaves (barrow): rusted plate cuisses and knee cops over rotten mail at the hips, a verdigris strap with a
//   grave-gold buckle. Rust 8a4a22 / 5e2e16 / a8642e, pitted 7d7a72, verdigris 4e7a64, buckle a89048, mould 3e4a32.
// - flayedLeggings (flayer): tight leggings of cured hide patches, three tones, black cross-stitches down the outside
//   seam, a belt of raw hide with a bone toggle. Hide c89a80 / dcb8a0 / 9a6e58, raw 9a5a4a, stitch 2a1c18, toggle efe6cc.
// - watchCuisses (watch): steel cuisses and knee cops over teal hose, a sand stripe down the outside, a leather belt with
//   a brass buckle. Steel b4bac2 / d2d6dc / 7d838c, teal 2f9c9a / 217c7a, sand efdcb8, leather 5e3f28, brass d4b060.
// - particolouredHose (velvet): hose burgundy on one leg and black on the other, slashed at the thigh showing gold, a
//   gold-braided belt. Velvet 6e1a2a / 4e1220, black 1e1a1e, gold d4b060.
// - blackbannerTrews (blackbanner): baggy black trews bound at the knee with blackened iron rings, a white sash knotted
//   at the hip, its ends hanging. Cloth 26242a / 3a3840, iron 3e4046, band e8e2d4.

import type { LEGS_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { mail, mod } from '../patterns';
import { SET_PALETTES } from '../setPalettes';

// Wool hose dyed with woad, held up by a belt with a brass buckle.
const hose = namedPalette({ wool: 0x5a7196, shade: 0x485c7c, belt: 0x5e3f28, buckle: 0xd4b060 });
const woolHose: ItemModel = {
  palette: hose.palette,
  worn: {
    torso: ({ y, front, flank, center }) => {
      const { c } = hose;
      if (y === 1) return front && center ? c.buckle : c.belt;
      return flank ? c.shade : c.wool;
    },
    leg: ({ flank, back }) => (flank || back ? hose.c.shade : hose.c.wool),
  },
};

// Trousers of one cloth up to a belt with a buckle in front.
function trousers(cloth: number, dark: number, belt: number, buckle: number): ItemModel {
  const { palette, c } = namedPalette({ cloth, dark, belt, buckle });
  return {
    palette,
    worn: {
      torso: ({ y, front, center }) => (y === 1 ? (front && center ? c.buckle : c.belt) : c.cloth),
      leg: ({ flank }) => (flank ? c.dark : c.cloth),
    },
  };
}

// Grey-green trousers held up by a knotted rope, a patch on each knee.
const rope = namedPalette({ cloth: 0x5e6450, dark: 0x4b5040, rope: 0xb89a6a, ropeDark: 0x9a7e52, patch: 0x7a6a4e });
const ropeTrousers: ItemModel = {
  palette: rope.palette,
  worn: {
    torso: ({ x, y, z, front, flank, center }) => {
      const { c } = rope;
      if (y === 1) return front && center ? c.ropeDark : mod(x + z, 2) === 0 ? c.rope : c.ropeDark; // twisted rope, knot in front
      return flank ? c.dark : c.cloth;
    },
    leg: ({ x, y, z, flank }) => {
      const { c } = rope;
      if (z === 3 && y === 3 && x === 1) return c.patch; // the knee
      return flank ? c.dark : c.cloth;
    },
  },
};

const rings = namedPalette({ ring: 0x8d939c, gap: 0x6a7078, belt: 0x5e3f28 });
const mailChausses: ItemModel = {
  palette: rings.palette,
  worn: {
    torso: ({ x, y, z }) => (y === 1 ? rings.c.belt : mail(x, y, z, rings.c.ring, rings.c.gap)),
    leg: ({ x, y, z }) => mail(x, y, z, rings.c.ring, rings.c.gap),
  },
};

// Plate over the legs with bright knee cops, and a leather skirt at the hips.
const plate = namedPalette({ steel: 0xb4bac2, bright: 0xd2d6dc, dark: 0x7d838c, leather: 0x5e3f28, buckle: 0xd4b060 });
const plateGreaves: ItemModel = {
  palette: plate.palette,
  worn: {
    torso: ({ y, front, center }) => (y === 1 ? (front && center ? plate.c.buckle : plate.c.dark) : plate.c.leather),
    leg: ({ y, z, flank }) => (z === 3 && y === 3 ? plate.c.bright : flank ? plate.c.dark : plate.c.steel),
  },
};

// A green plaid kilt to above the knee, a red line through the check.
const plaid = namedPalette({ green: 0x3e6a4a, dark: 0x2c4e36, red: 0x9a3a2a, belt: 0x5e3f28 });
const plaidCheck = (a: number, b: number) => (mod(a, 3) === 0 ? plaid.c.red : mod(a + b, 2) === 0 ? plaid.c.green : plaid.c.dark);
const plaidKilt: ItemModel = {
  palette: plaid.palette,
  worn: {
    torso: ({ x, y, z, flank }) => (y === 1 ? plaid.c.belt : plaidCheck(flank ? z : x, y)),
    leg: ({ x, y, z, flank }) => (y < 3 ? 0 : plaidCheck(flank ? z : x, y)), // bare knees
  },
};

// Tan leather breeches buckled below the knee, shins bare.
const breeches = namedPalette({ leather: 0xa07850, dark: 0x7e5c3a, buckle: 0xd4b060 });
const leatherBreeches: ItemModel = {
  palette: breeches.palette,
  worn: {
    torso: ({ y, front, center }) => (y === 1 ? (front && center ? breeches.c.buckle : breeches.c.dark) : breeches.c.leather),
    leg: ({ y, flank }) => (y < 3 ? 0 : y === 3 ? breeches.c.dark : flank ? breeches.c.dark : breeches.c.leather),
  },
};

// Hose striped red and cream, tied with a cord.
const stripes = namedPalette({ red: 0xa8402e, cream: 0xe8dcc0, cord: 0x8a6a45 });
const stripedHose: ItemModel = {
  palette: stripes.palette,
  worn: {
    torso: ({ y }) => (y === 1 ? stripes.c.cord : stripes.c.red),
    leg: ({ y }) => (mod(y, 2) === 0 ? stripes.c.red : stripes.c.cream),
  },
};

// Quilted linen legs, like a gambeson's, a channel across the knee.
const quilt = namedPalette({ linen: 0xdccba2, shade: 0xc9b58a, channel: 0xb39e74, trim: 0x8a6a45 });
const paddedChausses: ItemModel = {
  palette: quilt.palette,
  worn: {
    torso: ({ y, flank }) => (y === 1 ? quilt.c.trim : flank ? quilt.c.shade : quilt.c.linen),
    leg: ({ y, flank }) => (y === 3 ? quilt.c.channel : flank ? quilt.c.shade : quilt.c.linen),
  },
};

// Loose linen trousers, rolled up at the shin, a cord at the waist.
const linen = namedPalette({ linen: 0xe4d8bc, shade: 0xc9bb98, cord: 0x8a6a45 });
const linenTrousers: ItemModel = {
  palette: linen.palette,
  worn: {
    torso: ({ y, flank }) => (y === 1 ? linen.c.cord : flank ? linen.c.shade : linen.c.linen),
    leg: ({ y, flank }) => (y === 2 || flank ? linen.c.shade : linen.c.linen),
  },
};

// Barrow: rusted cuisses with knee cops, bright pitted steel showing through
// the rust, a band of verdigris round their upper edge; rotten mail at the
// hips under a verdigris strap with a grave-gold buckle.
const barrow = namedPalette({ ...SET_PALETTES.barrow });
const rusted = (x: number, y: number, z: number) => (mod(x * 3 + y * 5 + z * 2, 4) === 0 ? barrow.c.pitted : barrow.c.rust);
const barrowGreaves: ItemModel = {
  palette: barrow.palette,
  worn: {
    torso: ({ x, y, z, front, center }) => {
      const { c } = barrow;
      if (y === 1) return front && center ? c.graveGold : c.verdigris;
      return mail(x, y, z, c.rustDark, c.mould);
    },
    leg: ({ x, y, z, flank, back }) => {
      const { c } = barrow;
      if (y === 4) return back ? c.mould : c.verdigris; // the green-gold edge
      if (z === 3 && !flank && y === 3) return x === 1 ? c.pitted : c.rustLight; // the knee cop
      return back || flank ? (mod(y + z, 3) === 0 ? c.pitted : c.rustDark) : rusted(x, y, z);
    },
  },
};

// The flayer's: tight leggings of hide in patches of three tones, black
// cross-stitches down the outside seam, a raw-hide belt with a bone toggle.
const flayer = namedPalette({ ...SET_PALETTES.flayer });
const patch = (a: number, b: number) => [flayer.c.hideDark, flayer.c.raw, flayer.c.hide, flayer.c.hideDark][mod(Math.floor(a / 2) * 2 + Math.floor(b / 2) * 3 + (a > 2 ? 1 : 0), 4)];
const flayedLeggings: ItemModel = {
  palette: flayer.palette,
  worn: {
    torso: ({ x, y, z, front, flank, center }) => {
      const { c } = flayer;
      if (y === 1) return front && center ? c.tooth : c.raw;
      return patch(flank ? z : x, y + (flank ? 1 : 0));
    },
    leg: ({ x, y, z, flank }) => {
      const { c } = flayer;
      if (flank && (x === -1 || x === 3) && z === 1) return mod(y, 2) === 0 ? c.stitch : c.hidePale; // the seam
      if (z === 3 && !flank && y === 3) return mod(x, 2) === 0 ? c.stitch : c.hidePale; // cross-stitched over the knee
      return patch(flank ? z : x, y);
    },
  },
};

// The watch's: steel cuisses and bright knee cops on the front of the thigh
// over teal hose, a sand stripe down the outside, brass rivets in a pair; a
// leather belt with a brass buckle.
const watch = namedPalette({ ...SET_PALETTES.watch });
const watchCuisses: ItemModel = {
  palette: watch.palette,
  worn: {
    torso: ({ y, front, flank, center }) => {
      const { c } = watch;
      if (y === 1) return front && center ? c.brass : c.leather;
      return flank ? c.tealDark : c.teal;
    },
    leg: ({ x, y, z, flank, back }) => {
      const { c } = watch;
      if (z === 3 && !flank) {
        if (y === 3) return c.steelLight; // the knee cop
        return y === 4 && (x === 0 || x === 2) ? c.brass : c.steel;
      }
      if (flank && (x === -1 || x === 3)) return z === 1 ? c.sand : z >= 2 ? c.steelDark : c.tealDark; // the outside: stripe, the cuisse's edge
      return back ? c.tealDark : c.teal;
    },
  },
};

// Blackbanner: black trews bound under the knee with blackened iron rings,
// and the one white thing, a sash round the hips knotted on the right, its
// ends hanging down that thigh.
const banner = namedPalette({ ...SET_PALETTES.blackbanner });
const blackbannerTrews: ItemModel = {
  palette: banner.palette,
  worn: {
    torso: ({ x, y, flank }) => {
      const { c } = banner;
      if (y === 1) return c.band;
      return flank && x < 0 ? c.band : flank ? c.clothLight : c.cloth; // the knot
    },
    leg: ({ x, y, z, flank }) => {
      const { c } = banner;
      if (y === 3) return mod(x + z, 3) === 0 ? c.ironLight : c.iron; // the ring
      if (flank && x === -1 && z === 1 && y === 4) return c.band; // the sash's end
      return flank ? (mod(z, 2) === 0 ? c.clothLight : c.cloth) : y === 2 && mod(x, 2) === 0 ? c.clothLight : c.cloth; // folds bagging under the ring
    },
  },
};

// The velvet court's parti-coloured hose: the right leg burgundy, the left
// black, each slashed up the thigh to show gold beneath, under a braided
// gold belt.
const velvet = namedPalette({ ...SET_PALETTES.velvet });
const particolouredHose: ItemModel = {
  palette: velvet.palette,
  worn: {
    torso: ({ x, y, z, flank }) => {
      const { c } = velvet;
      if (y === 1) return mod(x + z, 2) === 0 ? c.gold : c.velvetDark; // the braid
      if (x < 3) return flank ? c.velvetDark : c.velvet; // (the right is -X)
      return c.black;
    },
    leg: ({ x, y, z, flank, side }) => {
      const { c } = velvet;
      const slash = y >= 3 && ((z === 3 && !flank && x === 1) || (flank && z === 1));
      if (slash) return c.gold;
      if (side === 'right') return flank ? c.velvetDark : c.velvet;
      return c.black;
    },
  },
};

export const LEGS_MODELS: Record<keyof typeof LEGS_ITEMS, ItemModel> = {
  woolHose,
  beltedTrousers: trousers(0x4a3b2e, 0x3b2f25, 0x2e2622, 0xb89a5a),
  ropeTrousers,
  mailChausses,
  plateGreaves,
  plaidKilt,
  leatherBreeches,
  stripedHose,
  paddedChausses,
  linenTrousers,
  barrowGreaves,
  flayedLeggings,
  watchCuisses,
  particolouredHose,
  blackbannerTrews,
};
