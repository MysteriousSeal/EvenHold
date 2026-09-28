// How everything worn on the head looks. Head shells run x -1..7, y 0..7
// (7 is over the crown) and z -1..7 (7 is in front of the face); the face
// has eyes at x 2 and 4 on rows 2-3, cheeks and mouth on row 1.

import type { HEAD_ITEMS } from '../../../../../model/items/armor';
import { namedPalette, type ShellCell } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { mail, mod, weave } from '../patterns';

// A leather cap: a seamed crown, down to the ears at the sides and back,
// a brow band in front, brass rivets along its rim.
const cap = namedPalette({ leather: 0x8a5a35, rim: 0x6b4226, seam: 0x4e2f1a, rivet: 0xd4b060 });
const leatherCap: ItemModel = {
  palette: cap.palette,
  worn: {
    head: ({ x, y, z, front, top }) => {
      const { c } = cap;
      if (top) return x === 3 || z === 3 ? c.seam : c.leather;
      const rim = front ? 6 : 4;
      if (y < rim) return 0;
      if (y > rim) return c.leather;
      return !front && mod(x + z, 3) === 0 ? c.rivet : c.rim;
    },
  },
};

// A hood over the crown, back and sides, with a brim over the brow and a
// dark cloth mask over mouth and nose: only the eyes show.
const hood = namedPalette({ hood: 0x6b4a33, dark: 0x523826, mask: 0x2e2a28 });
const maskedHood: ItemModel = {
  palette: hood.palette,
  worn: {
    head: ({ x, y, front, flank, top }) => {
      const { c } = hood;
      if (top) return mod(x, 3) === 0 ? c.dark : c.hood;
      if (front && !flank) {
        if (y >= 5) return y === 5 ? c.dark : c.hood; // brim
        return y <= 1 ? c.mask : 0;
      }
      return flank ? c.dark : c.hood;
    },
  },
};

// A madder-red bandana woven with darker stripes and a few ochre flecks,
// over the crown and tied at the back, its ends hanging down the nape.
const bandana = namedPalette({ red: 0x9a3a2a, dark: 0x7a2a1e, fleck: 0xc89a4a });
const bandanaCloth = (a: number, b: number) => (mod(a * 7 + b * 3, 13) === 0 ? bandana.c.fleck : mod(b, 3) === 0 ? bandana.c.dark : bandana.c.red);
const redBandana: ItemModel = {
  palette: bandana.palette,
  worn: {
    head: ({ x, y, z, front, back, flank, top }) => {
      const { c } = bandana;
      if (top) return bandanaCloth(x, z);
      if (front && !flank) return y >= 6 ? c.dark : 0; // a band across the brow
      if (back && !flank && y < 4) return (x === 3 && y >= 1) || (x === 4 && y >= 2) ? c.dark : 0; // the tied ends
      if (y < 4) return 0;
      if (back && y === 4 && x >= 2 && x <= 4) return c.dark; // the knot
      return y === 4 ? c.dark : flank ? bandanaCloth(z, y) : bandanaCloth(x, y);
    },
  },
};

// A dented iron cap with a nose guard: a raised ridge over the crown, a
// riveted rim, and rust in the dents.
const iron = namedPalette({ iron: 0x7d838c, ridge: 0x9aa0a8, rim: 0x5a5e66, rivet: 0xb8bec6, rust: 0x8a5a3a });
const nasalCap: ItemModel = {
  palette: iron.palette,
  worn: {
    head: ({ x, y, z, front, flank, top }) => {
      const { c } = iron;
      if (top) return x === 3 ? c.ridge : mod(x * 7 + z * 3, 11) === 0 ? c.rust : c.iron;
      if (front && !flank) {
        if (x === 3 && y >= 2) return y === 6 ? c.rim : c.iron; // nose guard, between the eyes
        return y === 6 ? c.rim : 0;
      }
      if (y < 5) return 0;
      if (y === 5) return mod(x + z, 3) === 0 ? c.rivet : c.rim;
      return mod(x * 5 + z, 9) === 0 ? c.rust : c.iron;
    },
  },
};

// A close white linen coif over the hair and ears, tied at the sides.
const coif = namedPalette({ linen: 0xece2c8, shade: 0xd6c9a8, tie: 0x8a6a45 });
const linenCoif: ItemModel = {
  palette: coif.palette,
  worn: {
    head: ({ y, z, front, flank, top }) => {
      const { c } = coif;
      if (top) return z === 3 ? c.shade : c.linen; // the seam over the crown
      if (front && !flank) return y === 6 ? c.shade : 0;
      if (y < 1) return 0;
      if (flank) return y === 1 ? c.tie : c.shade;
      return c.linen;
    },
  },
};

// A flat-topped straw hat, woven, with a red ribbon round it.
const straw = namedPalette({ straw: 0xd8b865, strawDark: 0xb8964a, ribbon: 0x9a3a2a });
const strawHat: ItemModel = {
  palette: straw.palette,
  worn: {
    head: ({ x, y, z, front, flank, top }) => {
      const { c } = straw;
      if (top) return weave(x, z, c.straw, c.strawDark);
      if (y < 5) return 0;
      if (y === 6) return c.ribbon;
      return weave(front || !flank ? x : z, y, c.straw, c.strawDark);
    },
  },
};

// A great helm hiding the whole head: a dark eye slit, breathing holes,
// a brass cross below the slit, a riveted band and a ridge over the top.
const helm = namedPalette({ steel: 0xa8aeb6, dark: 0x6e747c, slit: 0x1e1c1e, brass: 0xd4b060 });
const greatHelm: ItemModel = {
  palette: helm.palette,
  worn: {
    head: ({ x, y, z, front, flank, top }) => {
      const { c } = helm;
      if (top) return x === 3 ? c.dark : c.steel;
      if (front && !flank) {
        if (y === 3) return c.slit;
        if (y === 1 && (x === 0 || x === 6)) return c.slit;
        if ((x === 3 && y <= 2) || (y === 1 && x >= 2 && x <= 4)) return c.brass;
      }
      if (y === 0) return c.dark;
      if (y === 5 && mod(x + z, 3) === 0) return c.brass;
      return c.steel;
    },
  },
};

// A mail coif over the head, down the neck and around the face.
const coifMail = namedPalette({ ring: 0x8d939c, gap: 0x6a7078, band: 0x5e3f28 });
const mailCoif: ItemModel = {
  palette: coifMail.palette,
  worn: {
    head: ({ x, y, z, front, flank }: ShellCell) => {
      const { c } = coifMail;
      if (front && !flank && x >= 1 && x <= 5 && y >= 1 && y <= 5) return y === 5 ? c.band : 0; // the face, framed by a leather band
      return mail(x, y, z, c.ring, c.gap);
    },
  },
};

// A forest-green hood, face open, edged in leather.
const hunter = namedPalette({ green: 0x4e6a3a, dark: 0x3c5230, trim: 0x8a6a45 });
const huntersHood: ItemModel = {
  palette: hunter.palette,
  worn: {
    head: ({ x, y, front, flank, top }) => {
      const { c } = hunter;
      if (top) return mod(x, 3) === 0 ? c.dark : c.green;
      if (front && !flank) return y >= 5 ? (y === 5 ? c.trim : c.green) : 0;
      if (front) return c.trim; // the edge around the face
      return flank ? c.dark : c.green;
    },
  },
};

// A thin gold band around the brow, set with a turquoise stone.
const gold = namedPalette({ gold: 0xd4b060, dark: 0xa8862e, gem: 0x3dbdb8 });
const circlet: ItemModel = {
  palette: gold.palette,
  worn: {
    head: ({ x, y, z, front, flank, top }) => {
      const { c } = gold;
      if (top || y !== 5) return 0;
      if (front && !flank && x === 3) return c.gem;
      return mod(x + z, 4) === 0 ? c.dark : c.gold;
    },
  },
};

export const HEAD_MODELS: Record<keyof typeof HEAD_ITEMS, ItemModel> = {
  leatherCap,
  maskedHood,
  redBandana,
  nasalCap,
  linenCoif,
  strawHat,
  greatHelm,
  mailCoif,
  huntersHood,
  circlet,
};
