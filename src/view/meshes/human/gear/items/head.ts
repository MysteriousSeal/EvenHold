// How everything worn on the head looks (the finer helms: helms.ts): each
// piece sculpted round the head (armorShell.ts buildHeadgear), at its own
// voxels (its measures: headShape.ts). `d` is how many layers out a voxel
// is: 1 lies against the head, 2 and 3 stand out in relief (a rim, a ridge,
// a nose guard, a brim, a hood's folds).

import type { HEAD_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { mail, mod, weave } from '../patterns';
import { L, M, cornered, domed, edgeOf, onFace, riveted, within } from './headShape';
import { HELM_MODELS } from './helms';


// A leather cap: a crown of four panels, seams raised over it, down to the
// brow in front and the ears at the sides, a rolled rim round its edge set
// with brass rivets.
const cap = namedPalette({ leather: 0x8a5a35, light: 0xa06c42, dark: 0x6b4226, seam: 0x4e2f1a, rivet: 0xd4b060 });
const leatherCap: ItemModel = {
  palette: cap.palette,
  headgear: (cell) => {
    const { x, y, z, d, top } = cell;
    const { c } = cap;
    const edge = edgeOf(cell, 9, 5, 4);
    if (y < edge || d > 2) return 0;
    if (d === 1) return top ? (x === M || z === M ? c.seam : mod(x + z, 5) === 0 ? c.light : c.leather) : y === edge ? c.dark : c.leather;
    if (top) return within(x, 5) && within(z, 5) && (x === M || z === M) ? c.seam : 0; // the seams, raised
    return y === edge ? riveted(cell, c.rivet, c.dark) : 0; // the rolled rim
  },
};

// A deep hood over the crown, the back and the sides, falling in folds; a brim over the brow, and a dark cloth mask over mouth
// and nose, a fold across it: only the eyes show.
const hood = namedPalette({ hood: 0x6b4a33, light: 0x7f5a3e, dark: 0x4e3524, mask: 0x2e2a28, maskDark: 0x1f1c1b });
const maskedHood: ItemModel = {
  palette: hood.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back, flank } = cell;
    const { c } = hood;
    if (onFace(cell)) {
      if (d === 1) return y >= 9 ? (y === 9 ? c.dark : c.hood) : y <= 4 ? c.mask : 0;
      if (d === 2) return y === 9 ? c.dark : y === 2 && x >= 1 && x <= L - 1 ? c.maskDark : 0; // the brim; the mask's fold
      return 0;
    }
    const fold = back ? mod(x, 4) === 1 : flank ? mod(z, 4) === 1 : false;
    if (d === 1) return fold ? c.dark : top && mod(x, 3) === 0 ? c.light : c.hood;
    if (d === 2) return y >= 2 ? (fold ? c.dark : top && mod(x + z, 4) === 0 ? c.light : c.hood) : 0;
    return back && fold && y >= 2 && y <= 9 ? c.dark : 0; // the folds, standing out down the back
  },
};

// A madder-red bandana woven with darker stripes and a few ochre flecks,
// tight over the crown, a band across the brow, a rolled edge all round,
// knotted at the back, its ends hanging down the nape.
const bandana = namedPalette({ red: 0x9a3a2a, dark: 0x7a2a1e, fleck: 0xc89a4a });
const bandanaCloth = (a: number, b: number) => (mod(a * 7 + b * 3, 13) === 0 ? bandana.c.fleck : mod(b, 3) === 0 ? bandana.c.dark : bandana.c.red);
const redBandana: ItemModel = {
  palette: bandana.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back, flank } = cell;
    const { c } = bandana;
    const edge = edgeOf(cell, 9, 7);
    if (back && d === 1 && y < edge && ((x === M - 1 && y >= 3) || (x === M + 1 && y >= 4))) return c.dark; // the ends, down the nape
    if (y < edge) return 0;
    if (d === 1) return top ? bandanaCloth(x, z) : y === edge ? c.dark : flank ? bandanaCloth(z, y) : bandanaCloth(x, y);
    if (d === 2 && back && within(x, 1) && y <= edge + 2) return x === M ? c.dark : c.red; // the knot
    return d === 2 && !top && y === edge ? c.dark : 0; // the rolled edge
  },
};

// An iron cap rising to a low dome, a ridge raised from brow to nape over
// it, a riveted rim round its edge, and a nose guard standing out between
// the eyes.
const iron = namedPalette({ iron: 0x7d838c, light: 0x9aa0a8, dark: 0x5a5e66, rivet: 0xc4cad2 });
const nasalCap: ItemModel = {
  palette: iron.palette,
  headgear: (cell) => {
    const { x, y, d, top, back } = cell;
    const { c } = iron;
    const face = onFace(cell);
    const guard = face && x === M; // the nose guard's column
    const edge = face ? 9 : 6;
    if (y < edge && !(guard && y >= (d === 1 ? 3 : 4) && d <= 2)) return 0;
    if (guard && y < edge) return d === 1 ? c.iron : c.light;
    if (d === 1) return x === M && (top || face || back) ? c.light : c.iron;
    if (d === 2) {
      if (top) return domed(cell) ? (x === M ? c.light : c.iron) : 0; // the cap rising to its point, the ridge along it
      if (y === edge) return riveted(cell, c.rivet, c.dark); // the rim
      return x === M && (face || back) ? c.light : 0; // the ridge, down the brow and the nape
    }
    return 0;
  },
};

// A close white linen coif over the hair, the ears and the cheeks, framing
// the face with a raised hem, a seam over the crown, tied with a bow at
// each side.
const coif = namedPalette({ linen: 0xece2c8, shade: 0xd6c9a8, deep: 0xbcae8c, tie: 0x8a6a45 });
const linenCoif: ItemModel = {
  palette: coif.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, front, flank } = cell;
    const { c } = coif;
    if (y < 1 || d > 2) return 0;
    if (onFace(cell)) return y >= 9 ? (d === 1 ? c.linen : y === 9 ? c.shade : 0) : 0; // over the brow, its hem standing out
    if (d === 1) return top ? (x === M ? c.shade : c.linen) : flank && y <= 3 && !front ? c.shade : c.linen;
    if (front) return c.shade; // the hem round the face
    if (flank && y <= 2 && z >= 7 && z <= 8) return c.tie; // the bows
    return top && x === M && z >= 0 && z <= L ? c.deep : 0; // the seam
  },
};

// A woven straw hat: a domed crown, a red ribbon round its foot tied in a
// bow at the back, and a wide flat brim, its edge a shade darker.
const straw = namedPalette({ straw: 0xd8b865, dark: 0xb8964a, light: 0xe8cc80, ribbon: 0x9a3a2a, ribbonDark: 0x7a2a1e });
const strawHat: ItemModel = {
  palette: straw.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back, flank } = cell;
    const { c } = straw;
    if (y < 9) return 0;
    if (top) {
      if (d === 1) return weave(x, z, c.straw, c.light);
      return d === 2 && within(x, 4) && within(z, 4) ? weave(x, z, c.straw, c.dark) : 0; // the dome
    }
    if (y === 9) return d === 3 ? c.dark : weave(x, z, c.straw, c.dark); // the brim
    if (d === 1) return weave(flank ? z : x, y, c.straw, c.dark);
    if (d === 2 && y === 10) return c.ribbon;
    return d === 3 && back && y === 10 && within(x, 1) ? c.ribbonDark : 0; // the bow
  },
};

// A great helm hiding the whole head: a ridge down its middle and over the
// top, a brow plate jutting over the dark eye slit, breathing holes below,
// a riveted band round it and a flared rim at its foot.
const helm = namedPalette({ steel: 0xa8aeb6, light: 0xc4c9d0, dark: 0x6e747c, slit: 0x1e1c1e, rivet: 0xd0d5dc });
const greatHelm: ItemModel = {
  palette: helm.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back } = cell;
    const { c } = helm;
    const face = onFace(cell);
    if (d === 1) {
      if (face && (y === 5 || y === 6) && x >= 1 && x <= L - 1) return c.slit;
      if (face && y >= 1 && y <= 2 && (x <= 3 || x >= L - 3) && x >= 2 && x <= L - 2 && mod(x + y, 2) === 0) return c.slit; // breaths
      return top ? (x === M ? c.light : c.steel) : y === 0 ? c.dark : c.steel;
    }
    if (d > 2) return 0;
    if (top) return x === M && z >= 0 && z <= L ? c.light : 0; // the ridge over the top
    if (y === 0) return c.dark; // the flared foot
    if (y === 9) return riveted(cell, c.rivet, c.dark); // the riveted band
    if (face && y === 7) return c.steel; // the brow plate over the slit
    return x === M && (face || back) && y !== 5 && y !== 6 ? c.light : 0; // the ridge, down the front and back
  },
};

// A mail coif over the head and down the neck, the face framed in it, a
// leather band round the brow, thick over the crown and down the back.
const coifMail = namedPalette({ ring: 0x8d939c, gap: 0x6a7078, band: 0x5e3f28, bandLight: 0x7a5436 });
const mailCoif: ItemModel = {
  palette: coifMail.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, flank } = cell;
    const { c } = coifMail;
    const face = onFace(cell);
    const ring = mail(x, y, z, c.ring, c.gap);
    if (d === 1) return face && x >= 1 && x <= L - 1 && y >= 1 && y <= 8 ? 0 : ring; // the face, open
    if (!top && y === 9) return d === 2 ? (mod(x + z, 4) === 0 ? c.bandLight : c.band) : 0; // the brow band
    if (d === 2) return top ? (domed(cell) ? ring : 0) : face ? ((x === 0 || x === L) && y >= 1 && y <= 8 ? ring : 0) : y >= 3 || (!flank && z < 0) ? ring : 0; // (its skirt thick down the back, clear of the shoulders)
    return 0;
  },
};

// A forest-green hunter's hood, its face edged in leather, deep folds down
// the sides, and a long tail (a liripipe) down the back.
const hunter = namedPalette({ green: 0x4e6a3a, light: 0x5f7d48, dark: 0x3c5230, trim: 0x8a6a45, trimDark: 0x6b5034 });
const huntersHood: ItemModel = {
  palette: hunter.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, front, back, flank } = cell;
    const { c } = hunter;
    if (onFace(cell)) return y >= 9 && d <= 2 ? (y === 9 ? (d === 2 ? c.trim : c.trimDark) : d === 1 ? c.green : 0) : 0;
    if (front) return d <= 2 ? c.trim : 0; // the edge round the face
    const fold = flank ? mod(z, 4) === 2 : back ? mod(x, 4) === 2 : false;
    if (d === 1) return fold ? c.dark : top && mod(x + z, 3) === 0 ? c.light : c.green;
    if (d === 2) return y >= 2 ? (fold ? c.dark : c.green) : 0;
    return back && x === M && y >= 2 && y <= L ? (y <= 4 ? c.dark : c.green) : 0; // the tail, down the back
  },
};

// A thin gold band round the brow, studs raised along it, a turquoise
// stone set in front with a small point of gold over it.
const gold = namedPalette({ gold: 0xd4b060, dark: 0xa8862e, light: 0xf0d080, gem: 0x3dbdb8, gemLight: 0x7ae0dc });
const circlet: ItemModel = {
  palette: gold.palette,
  headgear: (cell) => {
    const { x, z, y, d, top } = cell;
    const { c } = gold;
    const face = onFace(cell);
    if (top || d > 2) return 0;
    if (face && x === M && (y === 10 || y === 9)) return d === 2 ? (y === 9 ? c.gem : c.gold) : c.light; // the stone, the point over it
    if (y !== 9) return 0;
    if (d === 1) return mod(x + z, 4) === 0 ? c.dark : c.gold;
    return face && within(x, 1) ? c.gold : !face && !cornered(cell) && mod(x + z, 4) === 2 ? c.light : 0; // its setting; the studs
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
  ...HELM_MODELS,
};
