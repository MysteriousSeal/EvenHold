// How everything worn on the legs looks. Legs shells cover the hips (torso
// rows 0-1, x -1..7, z -1..4 with 4 the front; row 1 is where a belt sits)
// and each leg's rows 2-4 (x -1..3, z -1..3 with 3 the front of the shin;
// the side toward the other leg stays open).

import type { LEGS_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { mail, mod } from '../patterns';

// Wool hose dyed with woad, held up by a belt with a brass buckle.
const hose = namedPalette({ wool: 0x5a7196, shade: 0x485c7c, belt: 0x5e3f28, buckle: 0xd4b060 });
const woolHose: ItemModel = {
  palette: hose.palette,
  worn: {
    torso: ({ x, y, front, flank }) => {
      const { c } = hose;
      if (y === 1) return front && x === 3 ? c.buckle : c.belt;
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
      torso: ({ x, y, front }) => (y === 1 ? (front && x === 3 ? c.buckle : c.belt) : c.cloth),
      leg: ({ flank }) => (flank ? c.dark : c.cloth),
    },
  };
}

// Grey-green trousers held up by a knotted rope, a patch on each knee.
const rope = namedPalette({ cloth: 0x5e6450, dark: 0x4b5040, rope: 0xb89a6a, ropeDark: 0x9a7e52, patch: 0x7a6a4e });
const ropeTrousers: ItemModel = {
  palette: rope.palette,
  worn: {
    torso: ({ x, y, z, front, flank }) => {
      const { c } = rope;
      if (y === 1) return front && x === 3 ? c.ropeDark : mod(x + z, 2) === 0 ? c.rope : c.ropeDark; // twisted rope, knot in front
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
    torso: ({ x, y, front }) => (y === 1 ? (front && x === 3 ? plate.c.buckle : plate.c.dark) : plate.c.leather),
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
    torso: ({ x, y, front }) => (y === 1 ? (front && x === 3 ? breeches.c.buckle : breeches.c.dark) : breeches.c.leather),
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
};
