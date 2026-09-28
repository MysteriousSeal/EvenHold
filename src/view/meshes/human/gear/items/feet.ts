// How everything worn on the feet looks. Feet shells cover each leg's rows
// 0-1: the foot and the ankle (x -1..3; z -1..4, where 4 is in front of the
// toes and z 3 on row 1 is over them; the side toward the other foot stays
// open). Nothing goes under the sole.

import type { FEET_ITEMS } from '../../../../../model/items/armor';
import { namedPalette, type ShellCell } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { fur, mod } from '../patterns';

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
};
