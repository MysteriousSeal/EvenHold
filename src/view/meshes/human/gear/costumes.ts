// What a job dresses the hero in while they're at it (model/jobs/: a shift at the inn's tables), only to be seen:
// never an item (not in the catalog, never worn in a slot, never dropped, sold or looted), their own gear kept on
// them, its stats and all, under it. Each a look per slot, painted on the body's shells as gear is (armorShell.ts),
// by its own id (`costume:…`), which no item's can be.
// A tavern server's: a red kerchief over the hair knotted behind; a cream linen shirt, its sleeves rolled to the
// elbow (bare forearms: the look's signature at a distance), under a wine-red bodice laced either side of a long
// white apron's bib; the apron falling to the knee over a brown skirt (or breeches), tied at the waist; plain dark
// shoes strapped over the instep.
// A tapster's (behind the bar): bare-headed; the same cream shirt, sleeves rolled, under a forest-green waistcoat,
// brass-buttoned either side; over it a long dark leather cellarman's apron from the chest to the shin, a tan strap
// round the neck and tied behind, a white bar cloth tucked at the hip; charcoal breeches, dark boots cuffed at the
// ankle. Apart from the server's at a glance: no kerchief, and one dark length down the front, not a white bib.

import type { ArmorSlot } from '../../../../model/human/equipment';
import type { JobId } from '../../../../model/jobs/jobs';
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

const vest = namedPalette({
  linen: 0xeee3c8,
  linenShade: 0xd7c8a4,
  roll: 0xc9b78f,
  vest: 0x2f5a3a,
  vestShade: 0x244630,
  brass: 0xd9b04a,
  hide: 0x5b3b24,
  hideShade: 0x47301c,
  strap: 0x9a7048,
});
const breeches = namedPalette({ hide: 0x5b3b24, hideShade: 0x47301c, strap: 0x9a7048, cloth: 0xf2ede2, wool: 0x3d3632, woolShade: 0x2f2a27 });
const boots = namedPalette({ leather: 0x3a2a1e, toe: 0x2a1e15, cuff: 0x5a4330 });

// The waistcoat over the shirt (its collar at the throat), brass buttons either side of the apron's bib, the bib's
// strap up round the neck and the apron's tie behind; the shirt's sleeves rolled up (the forearms bare).
const tapsterVest: ItemModel = {
  palette: vest.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = vest;
      if (front && (x === 2 || x === 4) && y === 5) return c.strap; // the bib's strap, up round the neck
      if (front && x >= 2 && x <= 4) return y === 5 ? c.linen : y === 4 ? c.hideShade : c.hide; // the bib (its fold at the top); the collar over it
      if (front && (x === 1 || x === 5) && (y === 2 || y === 4)) return c.brass; // buttoned either side
      if (back && x === 3 && (y === 2 || y === 5)) return c.strap; // the tie behind, the strap over the neck
      return flank || back ? c.vestShade : c.vest;
    },
    arm: ({ y, flank, top }) => {
      const { c } = vest;
      if (y < 4) return 0; // rolled up: the forearms bare
      if (y === 4) return c.roll;
      return flank && !top ? c.linenShade : c.linen;
    },
  },
};

// The apron on down the front to the shin over charcoal breeches, its band at the waist, a bar cloth tucked at the hip.
const tapsterBreeches: ItemModel = {
  palette: breeches.palette,
  worn: {
    torso: ({ x, y, front, back }) => {
      const { c } = breeches;
      if (front && x === 5) return c.cloth; // the bar cloth, tucked in at the hip
      if (front && x >= 1 && x <= 5) return y === 1 ? c.strap : c.hide; // (its band, at the waist)
      if (back && x === 3 && y === 1) return c.strap; // (tied behind)
      return c.wool;
    },
    leg: ({ y, front, flank }) => {
      const { c } = breeches;
      if (front) return y === 2 ? c.hideShade : c.hide; // (to the shin, its hem darker)
      return flank ? c.woolShade : c.wool;
    },
  },
};

// Dark boots, a folded cuff round the ankle and darker toes.
const tapsterBoots: ItemModel = {
  palette: boots.palette,
  worn: { leg: ({ y, z }) => (y === 1 && z <= 2 ? boots.c.cuff : z >= 3 ? boots.c.toe : boots.c.leather) },
};

// Every costume look, by its id: what slot it dresses, and how.
export const COSTUME_LOOKS: Record<CostumeLookId, { slot: ArmorSlot; model: ItemModel }> = {
  'costume:server:head': { slot: 'head', model: serverKerchief },
  'costume:server:torso': { slot: 'torso', model: serverBodice },
  'costume:server:legs': { slot: 'legs', model: serverSkirt },
  'costume:server:feet': { slot: 'feet', model: serverShoes },
  'costume:tapster:torso': { slot: 'torso', model: tapsterVest },
  'costume:tapster:legs': { slot: 'legs', model: tapsterBreeches },
  'costume:tapster:feet': { slot: 'feet', model: tapsterBoots },
};

// A job's whole costume (each slot's look; the rest bare: no hat, no gloves, no shoulders, nothing in hand).
export const COSTUMES: Record<JobId, Partial<Record<ArmorSlot, CostumeLookId>>> = {
  innServer: { head: 'costume:server:head', torso: 'costume:server:torso', legs: 'costume:server:legs', feet: 'costume:server:feet' },
  innBarkeep: { torso: 'costume:tapster:torso', legs: 'costume:tapster:legs', feet: 'costume:tapster:feet' },
};
