// What a job dresses the hero in while they're at it (model/jobs/: a shift at the inn's tables), only to be seen:
// never an item (not in the catalog, never worn in a slot, never dropped, sold or looted), their own gear kept on
// them, its stats and all, under it. Each a look per slot, painted on the body's shells as gear is (armorShell.ts),
// by its own id (`costume:…`), which no item's can be.
// A tavern server's: a red kerchief over the hair knotted behind; a cream linen shirt, its sleeves rolled to the
// elbow (bare forearms: the look's signature at a distance), under a wine-red bodice laced either side of a long
// white apron's bib; the apron falling to the knee over a brown skirt (or breeches), tied at the waist; plain dark
// shoes strapped over the instep.

import type { ArmorSlot } from '../../../../model/human/equipment';
import { namedPalette } from './armorShell';
import type { ItemModel } from './itemModel';
import { mod } from './patterns';
import { edgeOf, within } from './items/headShape';

export type CostumeLookId = `costume:${string}`;
export const isCostume = (look: string): look is CostumeLookId => look.startsWith('costume:');

const kerchief = namedPalette({ cloth: 0xb5452e, shade: 0x963625, dot: 0xe9dcc0, knot: 0x7e2c1e });
const dress = namedPalette({
  linen: 0xeee3c8,
  linenShade: 0xd7c8a4,
  roll: 0xc9b78f,
  bodice: 0x7a2e2a,
  bodiceDark: 0x5e2220,
  lace: 0xd1a868,
  apron: 0xf3ecdc,
  apronHem: 0xd9cfb8,
  string: 0xbba987,
});
const skirt = namedPalette({ apron: 0xf3ecdc, apronHem: 0xd9cfb8, string: 0xbba987, wool: 0x6b4a33, woolDark: 0x553a28 });
const shoes = namedPalette({ leather: 0x3e2c20, strap: 0x6b5038 });

// A red kerchief over the crown and down the back, a cream band at its hem, a few cream spots on top, knotted at the
// nape (the knot standing out behind).
const serverKerchief: ItemModel = {
  palette: kerchief.palette,
  headgear: (cell) => {
    const { x, y, z, d, top, back } = cell;
    const { c } = kerchief;
    if (back && d === 2 && within(x, 1) && y >= 2 && y <= 4) return c.knot; // (the knot, at the nape)
    const edge = edgeOf(cell, 8, 6, 3); // (over the brow in front, the ears' tops at the sides, the nape behind)
    if (y < edge || d > 1) return 0;
    if (y === edge && !back) return c.dot; // the hem, a cream band
    if (top) return mod(x * 3 + z * 5, 7) === 0 ? c.dot : c.cloth;
    return back ? c.shade : c.cloth;
  },
};

// The shirt at the neck and shoulders, its sleeves rolled up (the forearms bare); the bodice round the chest, laced
// either side of the apron's bib, the apron's tie behind.
const serverBodice: ItemModel = {
  palette: dress.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = dress;
      if (front && x >= 2 && x <= 4 && y >= 2) return y === 5 ? c.apronHem : c.apron; // the bib
      if (y === 5) return flank ? c.linenShade : c.linen; // the shirt, over the bodice's top
      if (front && (x === 1 || x === 5) && y >= 3) return c.lace; // laced either side of the bib
      if (back && x === 3 && y === 2) return c.string; // the apron's tie
      return flank || back ? c.bodiceDark : c.bodice;
    },
    arm: ({ y, flank, top }) => {
      const { c } = dress;
      if (y < 4) return 0; // rolled up: the forearms bare
      if (y === 4) return c.roll; // the roll, at the elbow
      return flank && !top ? c.linenShade : c.linen;
    },
  },
};

// The apron from the waist to the knee in front, tied at the waist; the skirt (or breeches) under it, brown wool.
const serverSkirt: ItemModel = {
  palette: skirt.palette,
  worn: {
    torso: ({ x, y, front, back }) => {
      const { c } = skirt;
      if (front && x >= 1 && x <= 5) return y === 1 ? c.string : c.apron; // (its band, at the waist)
      if (back && x === 3 && y === 1) return c.string; // (tied behind)
      return c.wool;
    },
    leg: ({ y, front, flank }) => {
      const { c } = skirt;
      if (front) return y === 2 ? c.apronHem : c.apron; // (to the knee)
      return flank ? c.woolDark : c.wool;
    },
  },
};

// Plain dark leather shoes, a strap over the instep.
const serverShoes: ItemModel = {
  palette: shoes.palette,
  worn: { leg: ({ y, front }) => (y === 1 && front ? shoes.c.strap : shoes.c.leather) },
};

// Every costume look, by its id: what slot it dresses, and how.
export const COSTUME_LOOKS: Record<CostumeLookId, { slot: ArmorSlot; model: ItemModel }> = {
  'costume:server:head': { slot: 'head', model: serverKerchief },
  'costume:server:torso': { slot: 'torso', model: serverBodice },
  'costume:server:legs': { slot: 'legs', model: serverSkirt },
  'costume:server:feet': { slot: 'feet', model: serverShoes },
};

// A job's whole costume (each slot's look; the rest bare: no gloves, no shoulders, nothing in hand).
export const COSTUMES = {
  innServer: { head: 'costume:server:head', torso: 'costume:server:torso', legs: 'costume:server:legs', feet: 'costume:server:feet' },
} as const satisfies Record<string, Partial<Record<ArmorSlot, CostumeLookId>>>;
