// The witch-finders' own (the bishop's men in grey, model/roads/patrols.ts), told apart on the road by their outline
// before their colours: a tall hat where a guard has a kettle hat and a pilgrim a wide brim, and a long grey coat
// with a white falling band at the throat and white cuffs (the one bright thing about them, by day and by torchlight).
// Palette first, a few greys and the one white:
// - findersHat: a capotain, its crown tall and a little narrower at the top, a stiff narrow brim; charcoal felt
//   3c3b40 / 4c4b52 (its crown the two rows a hat may stand over the head), its brim's edge 2a292e, a black band 1c1b1f with a pewter buckle a8acb0 at the front.
// - findersCoat: grey wool 6e6e6c over mail, darker down the sides 565654, a black leather belt 2e2620 with a pewter
//   buckle, pewter buttons down the front, the white band e8e4d6 at the throat, white cuffs, the sleeves' outsides
//   shaded.
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { mod } from '../patterns';
import { L, onFace, within } from './headShape';

const hat = namedPalette({ felt: 0x3c3b40, light: 0x4c4b52, edge: 0x2a292e, band: 0x1c1b1f, buckle: 0xa8acb0 });
const BRIM = 9; // the brim's row (over the brows)
const findersHat: ItemModel = {
  palette: hat.palette,
  headgear: (cell) => {
    const { x, y, z, d, top } = cell;
    const { c } = hat;
    if (y < BRIM) return 0;
    if (y === BRIM) return d === 1 ? c.felt : d === 2 ? c.edge : 0; // the brim, stiff and narrow, all round
    if (!top) return d === 1 ? (y === BRIM + 1 ? (onFace(cell) && within(x, 0) ? c.buckle : c.band) : c.felt) : 0; // the crown's foot, its band and buckle
    // Over the head: the crown standing up two rows (as high as a hat goes), a voxel in at the top (a capotain's taper), flat-topped.
    if (d > 2) return 0;
    const inset = d === 2 ? 1 : 0;
    if (x < inset || x > L - inset || z < inset || z > L - inset) return 0;
    return mod(x + z + d, 5) === 0 ? c.light : c.felt;
  },
};

const coat = namedPalette({ wool: 0x6e6e6c, shade: 0x565654, belt: 0x2e2620, pewter: 0xa8acb0, white: 0xe8e4d6 });
const findersCoat: ItemModel = {
  palette: coat.palette,
  worn: {
    torso: ({ x, y, front, flank, top }) => {
      const { c } = coat;
      if (y === 2) return front && x === 3 ? c.pewter : c.belt; // the belt, its buckle
      if (front && !top && y === 5 && x >= 2 && x <= 4) return c.white; // the falling band at the throat
      if (front && x === 3 && (y === 3 || y === 4)) return c.pewter; // buttons
      return flank ? c.shade : c.wool;
    },
    arm: ({ y, flank, top }) => (y === 2 ? coat.c.white : flank && !top ? coat.c.shade : coat.c.wool), // white cuffs
  },
};

export const FINDER_HEAD = { findersHat };
export const FINDER_TORSO = { findersCoat };
