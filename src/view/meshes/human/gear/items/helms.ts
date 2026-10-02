// The finer helms, sculpted round the head (armorShell.ts buildHeadgear; its
// measures: headShape.ts) in relief: `d` is how many layers out a voxel is,
// 1 against the head, 2 and 3 standing out. Nothing rises more than two
// layers over the crown (the figure stays under its height), and nothing
// stands out low on the sides (the shoulders are there).

import type { HEAD_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { mail, mod } from '../patterns';
import { L, M, cornered, domed, edgeOf, onFace, ringed, riveted, within } from './headShape';

// A kettle hat: a round iron crown sat high on the head, a band riveted
// round its foot, and a wide brim standing out all round, its edge rolled.
const kettle = namedPalette({ iron: 0x7d838c, light: 0x9aa0a8, dark: 0x5a5e66, rivet: 0xc4cad2 });
const kettleHat: ItemModel = {
  palette: kettle.palette,
  headgear: (cell) => {
    const { x, y, z, d, top } = cell;
    const { c } = kettle;
    if (y < 9) return 0;
    if (top) return d === 1 ? (mod(x + z, 6) === 0 ? c.light : c.iron) : d === 2 && domed(cell) ? c.iron : 0; // the crown, domed
    if (y === 9) return d === 3 ? c.light : c.iron; // the brim, its rolled edge
    return d === 1 ? riveted(cell, c.rivet, c.dark) : 0; // the band
  },
};

// A bascinet: a rounded skull down to the neck, its visor pushed out in a
// hound's snout with eye slits and breathing holes, pivots on either side,
// and a mail aventail round the neck.
const basc = namedPalette({ steel: 0xa8aeb6, light: 0xc4c9d0, dark: 0x6e747c, slit: 0x1e1c1e, ring: 0x8d939c, gap: 0x6a7078 });
const bascinet: ItemModel = {
  palette: basc.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, flank } = cell;
    const { c } = basc;
    if (onFace(cell)) {
      const snout = within(x, 1) && y >= 2 && y <= 4 ? 3 : within(x, 3) && y >= 1 && y <= 6 ? 2 : 1; // how far the visor stands out here
      if (d > snout) return 0;
      if (d === snout && y === 5 && x !== M && snout === 2) return c.slit; // the eye slits, along the snout
      if (d === 3 && mod(x + y, 2) === 1) return c.slit; // the breaths, at its tip
      return x === M || d === 3 ? c.light : c.steel;
    }
    if (!top && y <= 2) return d === 1 ? mail(x, y, z, c.ring, c.gap) : 0; // the aventail
    if (d === 1) return top && x === M ? c.light : c.steel;
    if (d === 2 && top) return domed(cell) ? (x === M ? c.light : c.steel) : 0; // the skull, rounded
    return d === 2 && flank && y === 6 && z >= 8 && z <= 9 ? c.dark : 0; // the visor's pivots
  },
};

// A barbute: the whole head in steel, a T cut for the eyes and mouth, a
// ridge over the crown and down the back, its foot flaring at the nape.
const barbuteSteel = namedPalette({ steel: 0xb0b6be, light: 0xccd1d8, dark: 0x70767e });
const barbute: ItemModel = {
  palette: barbuteSteel.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back } = cell;
    const { c } = barbuteSteel;
    const face = onFace(cell);
    if (d === 1) {
      if (face && ((y >= 4 && y <= 6 && x >= 1 && x <= L - 1) || (y >= 1 && y <= 6 && within(x, 1)))) return 0; // the T
      return y === 0 ? c.dark : top && x === M ? c.light : c.steel;
    }
    if (d > 2) return 0;
    if (top) return x === M && z >= 0 && z <= L ? c.light : 0; // the ridge
    if (back) return x === M || y <= 1 ? c.light : 0; // down the back, and the flare at the nape
    return face && y === 7 && x >= 1 && x <= L - 1 ? c.steel : 0; // a lip over the eyes
  },
};

// A sallet: a crown with a visor down to the eyes, a dark sight cut across
// it, and a long tail sweeping out over the nape; the jaw left open.
const salletSteel = namedPalette({ steel: 0xa0a6ae, light: 0xbec3ca, dark: 0x666c74, slit: 0x1e1c1e });
const sallet: ItemModel = {
  palette: salletSteel.palette,
  headgear: (cell) => {
    const { x, y, d, top, back } = cell;
    const { c } = salletSteel;
    const face = onFace(cell);
    if (back && d >= 2) return (d === 2 ? y >= 3 && y <= 8 : y >= 2 && y <= 5) ? (y <= 3 ? c.dark : c.steel) : 0; // the tail
    if (y < (face ? 5 : 4)) return 0;
    if (d === 1) return face && y === 6 && x >= 1 && x <= L - 1 ? c.slit : top && x === M ? c.light : c.steel;
    if (d > 2) return 0;
    if (top) return x === M ? c.light : 0; // the ridge
    return face && y === 7 ? c.steel : 0; // the sight's upper lip
  },
};

// A horned helm: an iron cap with a bronze band round its foot and a
// bronze ridge, and a great horn curving out and up from either side.
const horned = namedPalette({ iron: 0x6e747c, light: 0x8a9098, bronze: 0xb08040, horn: 0xe6dcc0, hornShade: 0xc8b890, tip: 0x4a4038 });
const hornedHelm: ItemModel = {
  palette: horned.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, flank } = cell;
    const { c } = horned;
    const edge = edgeOf(cell, 9, 6);
    if (flank && z >= 4 && z <= 6 && d >= 2) {
      // The horn: out from the side at the band, then up.
      const reach = d === 2 ? y >= 7 && y <= 9 : y >= 8 && y <= 12;
      return reach ? (y === 12 ? c.tip : mod(y, 2) === 0 ? c.horn : c.hornShade) : 0;
    }
    if (y < edge) return 0;
    if (d === 1) return y === edge ? c.bronze : top && x === M ? c.bronze : top ? c.iron : mod(x + z + y, 7) === 0 ? c.light : c.iron;
    if (d === 2) return top ? (x === M && z >= 0 && z <= L ? c.bronze : domed(cell) ? c.iron : 0) : y === edge ? c.bronze : 0;
    return 0;
  },
};

// A winged helm: a silver cap, a band round it, and a white wing swept back
// and up from either side, its feathers in rows.
const winged = namedPalette({ silver: 0xc0c6ce, light: 0xdde2e8, dark: 0x8a9098, feather: 0xf4f2ec, featherShade: 0xd2d0ca, quill: 0xb0aaa0 });
const wingedHelm: ItemModel = {
  palette: winged.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, flank } = cell;
    const { c } = winged;
    if (flank && d >= 2) {
      // The wing: low and forward near the head, higher and further back out from it.
      const span = d === 2 ? y >= 7 && y <= 11 && z >= 2 && z <= 7 : y >= 8 && y <= 12 && z >= 0 && z <= 5 && z - 1 <= y - 7;
      return span ? (z === (d === 2 ? 7 : 5) ? c.quill : mod(y + z, 2) === 0 ? c.feather : c.featherShade) : 0;
    }
    const edge = edgeOf(cell, 9, 7);
    if (y < edge) return 0;
    if (d === 1) return y === edge ? c.dark : top && (x === M || z === M) ? c.light : c.silver;
    if (d === 2) return top ? (domed(cell) ? c.silver : 0) : y === edge ? c.light : 0;
    return 0;
  },
};

// An elven circlet: a fine band of pale gold round the brow, leaves of
// green enamel raised along it, and a tall leaf over the brow set with a
// moonstone.
const elven = namedPalette({ gold: 0xe0c878, dark: 0xb89a48, leaf: 0x5aa060, leafLight: 0x8ad08a, moon: 0xe8f2f4 });
const elvenCirclet: ItemModel = {
  palette: elven.palette,
  headgear: (cell) => {
    const { x, y, z, d, top } = cell;
    const { c } = elven;
    const face = onFace(cell);
    if (top || d > 2) return 0;
    if (face && within(x, 1) && y >= 9 && y <= 11 && d === 2) return x === M ? (y === 9 ? c.moon : y === 11 ? c.leafLight : c.leaf) : y === 10 ? c.leaf : 0; // the brow leaf, its stone
    if (y !== 9) return 0;
    if (d === 1) return mod(x + z, 5) === 0 ? c.dark : c.gold;
    return !face && !cornered(cell) && mod(x + z, 3) === 0 ? (mod(x + z, 6) === 0 ? c.leafLight : c.leaf) : 0; // the leaves along it
  },
};

// A bone helm: a great beast's skull worn as a helm, its brow jutting over
// the face, dark sockets in it and teeth hanging from its jaw, strapped on
// with leather.
const bone = namedPalette({ bone: 0xe8dcc0, shade: 0xc8b894, dark: 0x3a3028, tooth: 0xf4ecd8, strap: 0x6b4a33 });
const boneHelm: ItemModel = {
  palette: bone.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, flank } = cell;
    const { c } = bone;
    const face = onFace(cell);
    if (face) {
      if (d === 1) return y >= 9 ? c.bone : 0;
      if (d === 2) return y === 10 && (x === 2 || x === L - 2) ? c.dark : y >= 9 ? c.bone : y === 8 && mod(x, 2) === 1 ? c.tooth : 0; // its sockets; its teeth over the brow
      return y === 9 && within(x, 2) ? c.shade : 0; // its snout
    }
    if (flank && d === 1 && (y === 5 || y === 6) && z >= 3 && z <= 7) return c.strap; // the straps
    if (y < 7) return 0;
    if (d === 1) return mod(x * 3 + y + z * 5, 9) === 0 ? c.shade : c.bone;
    return d === 2 && top && within(x, 2) && within(z, 3) ? (x === M ? c.shade : c.bone) : 0; // its crown, a ridge along it
  },
};

// A dragonscale helm: green scales over the whole head, the face open, a
// row of horn spikes from brow to nape, a jaw jutting over the brow with
// two fangs, and scaled cheek guards.
const dragon = namedPalette({ scale: 0x3f7a4a, dark: 0x2d5a38, light: 0x5a9a5e, horn: 0xe0d0a0, hornDark: 0xb8a070 });
const dragonHelm: ItemModel = {
  palette: dragon.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back, flank } = cell;
    const { c } = dragon;
    const face = onFace(cell);
    const scales = mod(x + z + (mod(y, 2) === 0 ? 0 : 1), 2) === 0 ? c.scale : mod(x * 3 + y + z, 5) === 0 ? c.light : c.dark;
    if (d === 1) return face && x >= 1 && x <= L - 1 && y >= 1 && y <= 8 ? 0 : scales;
    if (face) {
      if (d === 2) return y >= 9 ? scales : y === 8 && (x === 3 || x === L - 3) ? c.horn : 0; // the jaw; its fangs
      return y === 9 && within(x, 2) ? c.dark : 0; // its snout
    }
    if (d > 2) return 0;
    if (x === M && (top || back) && mod(top ? z : y, 2) === 0) return top ? c.horn : y >= 4 ? c.hornDark : 0; // the spikes
    return flank && y >= 3 && y <= 8 && z >= 7 ? scales : 0; // the cheek guards
  },
};

// An old king's crown: a gold band set with a ruby in front and sapphires
// at the sides, its points rising round a cap of red velvet, a gold knob
// on top.
const crown = namedPalette({ gold: 0xd4b060, dark: 0xa8862e, light: 0xf0d080, ruby: 0xb02838, sapphire: 0x3050b0, velvet: 0x8a2030, velvetDark: 0x681828 });
const royalCrown: ItemModel = {
  palette: crown.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, flank } = cell;
    const { c } = crown;
    const face = onFace(cell);
    if (ringed(cell)) {
      if (y === 8 || y === 9) return y === 8 && mod(x + z, 2) === 0 ? c.dark : c.gold; // the band
      if (y >= 10 && y <= 12) return mod(x + z, 4) === 0 ? (y === 12 ? c.light : c.gold) : y === 10 ? c.gold : 0; // its points
      return 0;
    }
    if (top) return d === 1 ? (mod(x + z, 3) === 0 ? c.velvetDark : c.velvet) : d === 2 && domed(cell, 2) ? (x === M && z === M ? c.light : c.velvet) : 0; // the velvet cap, its knob
    if (d === 2 && (y === 8 || y === 9)) return face && x === M ? c.ruby : flank && z === M ? c.sapphire : 0; // the stones
    return 0;
  },
};

// (head.ts's HEAD_MODELS holds these with the rest: every head item's model, checked there.)
export const HELM_MODELS = {
  kettleHat,
  bascinet,
  barbute,
  sallet,
  hornedHelm,
  wingedHelm,
  elvenCirclet,
  boneHelm,
  dragonHelm,
  royalCrown,
} satisfies Partial<Record<keyof typeof HEAD_ITEMS, ItemModel>>;
