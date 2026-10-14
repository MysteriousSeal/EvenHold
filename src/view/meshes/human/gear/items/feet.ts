// How everything worn on the feet looks. Feet shells cover each leg's rows
// 0-1: the foot and the ankle (x -1..3; z -1..4, where 4 is in front of the
// toes and z 3 on row 1 is over them; the side toward the other foot stays
// open). Nothing goes under the sole.
//
// The new foot pieces (each its set's colours: setPalettes.ts):
// - headsmansBoots (headsman): heavy black boots to the ankle, iron toe caps, a strap and dull iron buckle across the
//   instep. Black 1c1a1c / leather 3e2a22, iron 5a5e66 / 7d838c.
// - flayersBoots (flayer): hide boots in patches, cross-stitched, the cuff turned down showing raw hide, a tooth on a
//   thong at the ankle. Hide c89a80 / 9a6e58, raw 9a5a4a, stitch 2a1c18, tooth efe6cc.
// - ashSandals (cinder): sooted soles under ash-grey cloth bindings wound up the ankle, toes bare and black with ash, an
//   ember speck or two. Ash 6a6460 / 8a847e, soot 2a2826, ember e0602a.
// - sunwardSabatons (sunward, epic): pointed gilded sabatons of overlapping lames, ivory enamel on the instep with a
//   small gold sun, gold toe. Gold d4b060 / f0d080 / a8862e, ivory f4f0e6, azure 3060c0.
// - poulaines (velvet): long-toed velvet shoes, the toe running a voxel past the foot, black and burgundy, a gold buckle
//   and an ermine cuff. Velvet 6e1a2a / 4e1220, black 1e1a1e, gold d4b060, ermine f0ece0.

import type { FEET_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette, type ShellCell } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { fur, mod } from '../patterns';
import { SET_PALETTES } from '../setPalettes';

// The ankle ring (row 1, behind the toes), as opposed to the foot itself.
const ankle = ({ y, z }: ShellCell) => y === 1 && z <= 2;

// Leather ankle boots: a folded cuff and darker toe caps.
const boot = namedPalette({ leather: 0x7a4e2c, dark: 0x5e3a20, cuff: 0x9a6a3e });
const leatherBoots: ItemModel = {
  palette: boot.palette,
  worn: {
    leg: (cell) => {
      const { c } = boot;
      if (cell.front) return c.dark; // toe caps
      if (cell.y === 1) return ankle(cell) ? c.cuff : c.leather;
      return cell.flank ? c.dark : c.leather;
    },
  },
};

const black = namedPalette({ boot: 0x2a2420, cuff: 0x3a322c });
const blackBoots: ItemModel = {
  palette: black.palette,
  worn: { leg: (cell) => (ankle(cell) ? black.c.cuff : black.c.boot) },
};

// Strips of undyed wool wound around the feet, strapped at the ankles.
const wraps = namedPalette({ wrap: 0xb0a288, dark: 0x958770, strap: 0x6b4a33 });
const footWraps: ItemModel = {
  palette: wraps.palette,
  worn: {
    leg: (cell) => {
      const { c } = wraps;
      if (ankle(cell)) return mod(cell.x + cell.z, 2) === 0 ? c.strap : c.dark;
      return mod(cell.z, 2) === 0 ? c.wrap : c.dark;
    },
  },
};

// Leather straps over bare feet: round the ankle and across the foot.
const strap = namedPalette({ strap: 0x8a5a35, sole: 0x5e3f28 });
const sandals: ItemModel = {
  palette: strap.palette,
  worn: {
    leg: (cell) => {
      if (ankle(cell)) return strap.c.strap;
      if (cell.front) return 0; // toes out
      return cell.y === 0 && cell.z === 2 ? strap.c.strap : cell.y === 0 && cell.flank ? strap.c.sole : 0;
    },
  },
};

// Steel foot plates in overlapping lames, a bright toe.
const steel = namedPalette({ steel: 0xb4bac2, dark: 0x7d838c, bright: 0xd2d6dc });
const sabatons: ItemModel = {
  palette: steel.palette,
  worn: { leg: (cell) => (cell.front ? steel.c.bright : ankle(cell) ? steel.c.dark : mod(cell.z, 2) === 0 ? steel.c.steel : steel.c.dark) },
};

const pelt = namedPalette({ light: 0xc4b69e, mid: 0xa8987f, dark: 0x7e6e5a, toe: 0x5e3f28 });
const furBoots: ItemModel = {
  palette: pelt.palette,
  worn: { leg: ({ x, y, z, front }) => (front ? pelt.c.toe : fur(x, y, z, [pelt.c.light, pelt.c.mid, pelt.c.dark])) },
};

// Low shoes (the ankle left bare), one color, with a trim or buckle at the side.
function shoes(color: number, dark: number, trim: number): ItemModel {
  const { palette, c } = namedPalette({ color, dark, trim });
  return {
    palette,
    worn: {
      leg: (cell) => {
        if (ankle(cell)) return 0;
        if (cell.flank && cell.y === 0 && cell.z === 2) return c.trim;
        return cell.front ? c.dark : c.color;
      },
    },
  };
}

// Pale wooden clogs with the grain running along the foot.
const wood = namedPalette({ wood: 0xc8a068, grain: 0xa8804a });
const woodenClogs: ItemModel = {
  palette: wood.palette,
  worn: { leg: (cell) => (ankle(cell) ? 0 : cell.flank && mod(cell.z, 2) === 1 ? wood.c.grain : wood.c.wood) },
};

// Brown boots with iron hobnails around the sole.
const hobnail = namedPalette({ leather: 0x6b4428, dark: 0x553520, nail: 0x9aa0a8 });
const hobnailBoots: ItemModel = {
  palette: hobnail.palette,
  worn: {
    leg: (cell) => {
      if (cell.y === 0 && !cell.front && mod(cell.x + cell.z, 2) === 0) return hobnail.c.nail;
      return ankle(cell) ? hobnail.c.dark : hobnail.c.leather;
    },
  },
};

// An inn's bouncer's: heavy black-brown boots, iron-capped at the toe, a
// dark band at the ankle, and hobnails round the sole.
const capped = namedPalette({ leather: 0x3e2a1e, dark: 0x2a1c14, iron: 0x9aa2aa, nail: 0x7a8088 });
const ironCapBoots: ItemModel = {
  palette: capped.palette,
  worn: {
    leg: (cell) => {
      const { c } = capped;
      if (cell.front && cell.y === 0) return c.iron; // the toe cap
      if (cell.y === 0 && !cell.front && mod(cell.x + cell.z, 2) === 0) return c.nail;
      return ankle(cell) ? c.dark : c.leather;
    },
  },
};

// The headsman's: heavy black boots, iron toe caps, a leather strap over the
// instep with a dull iron buckle, a pale stitch round the cuff.
const headsman = namedPalette({ ...SET_PALETTES.headsman });
const headsmansBoots: ItemModel = {
  palette: headsman.palette,
  worn: {
    leg: (cell) => {
      const { c } = headsman;
      if (cell.front) return cell.y === 0 ? c.iron : c.black; // the toe cap
      if (cell.y === 1 && cell.z === 3) return cell.x === 1 ? c.ironLight : c.leather; // the strap and its buckle
      if (ankle(cell)) return mod(cell.x + cell.z, 2) === 0 ? c.thread : c.blackLight;
      return cell.flank && cell.z === 3 ? c.leather : c.black;
    },
  },
};

// The flayer's: hide boots in patches, a black cross-stitch down the side,
// the cuff turned down to raw hide, a tooth on a thong at the outside ankle.
const flayer = namedPalette({ ...SET_PALETTES.flayer });
const flayersBoots: ItemModel = {
  palette: flayer.palette,
  worn: {
    leg: (cell) => {
      const { c } = flayer;
      const { x, z, flank } = cell;
      if (ankle(cell)) return flank && (x === -1 || x === 3) && z === 1 ? c.tooth : c.raw; // the cuff, the tooth on the outside
      if (flank && z === 2) return c.stitch;
      if (cell.front) return x === 1 ? c.stitch : c.hideDark;
      return mod(Math.floor(z / 2) + (flank ? 1 : x), 2) === 0 ? c.hide : c.hideDark;
    },
  },
};

// Cinder: soles sooted black, ash-grey bindings wound round the ankle and
// once over the foot and up its sides, the bare toes smudged black with
// ash, an ember in the soot.
const cinder = namedPalette({ ...SET_PALETTES.cinder });
const ashSandals: ItemModel = {
  palette: cinder.palette,
  worn: {
    leg: (cell) => {
      const { c } = cinder;
      if (ankle(cell)) return mod(cell.x + cell.z, 2) === 0 ? c.ash : c.ashLight; // wound round
      if (cell.front) return mod(cell.x, 2) === 0 ? c.soot : 0; // ashen toes
      if (cell.y === 1 && cell.z === 3) return c.ash; // over the foot
      if (cell.y === 0 && cell.flank) return cell.z === 0 ? c.ember : mod(cell.z, 2) === 1 ? c.sootDeep : 0; // the sole's straps
      return 0;
    },
  },
};

// Sunward: gilded sabatons of lames, the toe ridged to a point, an ivory
// enamelled instep with a small gold sun on azure in its middle.
const sun = namedPalette({ ...SET_PALETTES.sunward });
const sunwardSabatons: ItemModel = {
  palette: sun.palette,
  worn: {
    leg: (cell) => {
      const { c } = sun;
      const { x, y, z } = cell;
      if (cell.front) return x === 1 ? c.goldLight : c.goldDark; // the ridge
      if (y === 1 && z === 3) return x === 1 ? c.gold : c.azure; // the sun on the instep
      if (ankle(cell)) return cell.flank || cell.back ? c.ivoryShade : c.ivory;
      return mod(z, 2) === 0 ? c.gold : c.goldDark; // the lames
    },
  },
};

// The velvet court's poulaines: burgundy velvet, black over the instep, the
// long toe pointed with a gold tip, a gold buckle at the side, an ermine cuff.
const velvet = namedPalette({ ...SET_PALETTES.velvet });
const poulaines: ItemModel = {
  palette: velvet.palette,
  worn: {
    leg: (cell) => {
      const { c } = velvet;
      const { x, y, z } = cell;
      if (cell.front) return y === 0 && x === 1 ? c.gold : y === 0 ? c.velvet : c.black; // the toe, its gold tip
      if (ankle(cell)) return mod(x + z, 3) === 0 ? c.fleck : c.ermine;
      if (z === 3) return c.black;
      if (cell.flank && y === 0 && z === 1) return c.gold; // the buckle
      return cell.flank ? c.velvetDark : c.velvet;
    },
  },
};

export const FEET_MODELS: Record<keyof typeof FEET_ITEMS, ItemModel> = {
  leatherBoots,
  blackBoots,
  footWraps,
  sandals,
  sabatons,
  furBoots,
  redShoes: shoes(0x9a3a2a, 0x7a2a1e, 0xd4b060),
  woodenClogs,
  feltSlippers: shoes(0x6a8a5a, 0x557048, 0xe8dcc0),
  hobnailBoots,
  ironCapBoots,
  headsmansBoots,
  flayersBoots,
  ashSandals,
  sunwardSabatons,
  poulaines,
};
