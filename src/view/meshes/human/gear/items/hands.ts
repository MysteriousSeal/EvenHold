// How everything worn on the hands looks. Hand shells cover each arm's rows
// -1 to 1 (-1 under the fist, 1 the wrist; x -1..2, z -1..2 with 2 the
// front; the side toward the body stays open).
//
// The new hand pieces, as each was drawn (its set's colours: setPalettes.ts):
// - headsmansGloves (headsman): long black leather gauntlet gloves, a wide flared cuff, the palms and fingers darkened
//   with old stains. Black 1c1a1c / 2e2a2c, stain 3a0e10, cuff stitched in thread b8a986.
// - knucklebones (ossuary): finger bones wired along the back of each finger over a leather glove, a row of knucklebones
//   across the knuckles, a bone wrist ring. Bone e0d4b4 / b8a986, glove socket 2a2220, wire 6e747c.
// - cinderWraps (cinder): ash-grey cloth wound round palm and wrist, the fingertips bare and sooted black, a faint ember
//   glow between the windings. Ash 6a6460 / 8a847e, soot 2a2826, ember e0602a.
// - watchVambraces (watch): leather gloves under steel vambraces, a teal cloth band at the wrist with two brass rivets.
//   Steel b4bac2 / d2d6dc, leather 5e3f28, teal 2f9c9a, brass d4b060.
// - sunwardGauntlets (sunward, epic): articulated gilded gauntlets, the cuffs ivory enamel with a small sun on azure on
//   the back of each hand, gold knuckle plates. Gold d4b060 / f0d080 / a8862e, ivory f4f0e6, azure 3060c0.

import type { HANDS_ITEMS } from '../../../../../model/human/items/armor';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { fur, mail, mod } from '../patterns';
import { SET_PALETTES } from '../setPalettes';

// Plain gloves: one color, a cuff at the wrist, fingertips left bare if `bare`.
function gloves(color: number, cuff: number, bare = false): ItemModel {
  const { palette, c } = namedPalette({ color, cuff });
  return { palette, worn: { arm: ({ y }) => (bare && y === -1 ? 0 : y === 1 ? c.cuff : c.color) } };
}

const knuckles = namedPalette({ steel: 0xb4bac2, dark: 0x7d838c, cuff: 0xd2d6dc });
const gauntlets: ItemModel = {
  palette: knuckles.palette,
  worn: { arm: ({ y, front }) => (y === 1 ? knuckles.c.cuff : front && y === 0 ? knuckles.c.dark : knuckles.c.steel) }, // flared cuff, dark knuckle plate
};

const rings = namedPalette({ ring: 0x8d939c, gap: 0x6a7078, cuff: 0x5e3f28 });
const mailMittens: ItemModel = {
  palette: rings.palette,
  worn: { arm: ({ x, y, z }) => (y === 1 ? rings.c.cuff : mail(x, y, z, rings.c.ring, rings.c.gap)) },
};

// Strips of linen wound around the palms, fingertips bare.
const wraps = namedPalette({ linen: 0xe8dcc0, shade: 0xc9bb98 });
const handWraps: ItemModel = {
  palette: wraps.palette,
  worn: { arm: ({ y }) => (y === -1 ? 0 : mod(y, 2) === 1 ? wraps.c.linen : wraps.c.shade) },
};

const pelt = namedPalette({ light: 0xc4b69e, mid: 0xa8987f, dark: 0x7e6e5a });
const furMittens: ItemModel = {
  palette: pelt.palette,
  worn: { arm: ({ x, y, z }) => fur(x, y, z, [pelt.c.light, pelt.c.mid, pelt.c.dark]) },
};

// Dark red gloves with a gold-stitched cuff.
const stitched = namedPalette({ red: 0x6e2430, gold: 0xd4b060 });
const embroideredGloves: ItemModel = {
  palette: stitched.palette,
  worn: { arm: ({ x, y, z }) => (y === 1 && mod(x + z, 2) === 0 ? stitched.c.gold : stitched.c.red) },
};

// Just a leather bracer round each wrist, with a brass stud; hands bare.
const bracer = namedPalette({ leather: 0x6b4a33, stud: 0xd4b060 });
const leatherBracers: ItemModel = {
  palette: bracer.palette,
  worn: { arm: ({ y, flank }) => (y !== 1 ? 0 : flank ? bracer.c.stud : bracer.c.leather) },
};

// An inn's bouncer's: broad oxblood bracers, two rows deep, studded with iron
// on the outside; hands bare (for grabbing collars).
const broad = namedPalette({ leather: 0x6e2c22, shade: 0x561f18, stud: 0x9aa2aa });
const studdedBracers: ItemModel = {
  palette: broad.palette,
  worn: { arm: ({ y, flank, x, z }) => (y < 1 || y > 2 ? 0 : flank && mod(x + y + z, 2) === 0 ? broad.c.stud : y === 2 ? broad.c.shade : broad.c.leather) },
};

// The headsman's: black leather gauntlet gloves, the fingers darkened with
// old stains, a wide cuff stitched round in pale thread.
const headsman = namedPalette({ ...SET_PALETTES.headsman });
const headsmansGloves: ItemModel = {
  palette: headsman.palette,
  worn: {
    arm: ({ x, y, z, flank }) => {
      const { c } = headsman;
      if (y === 1) return mod(x + z, 2) === 0 ? c.thread : c.blackLight;
      if (y === -1) return c.stain;
      return flank ? c.blackLight : c.black;
    },
  },
};

// The ossuary's: finger bones wired along dark leather fingers, a row of
// knucklebones across the knuckles, a ring of bone round the wrist.
const ossuary = namedPalette({ ...SET_PALETTES.ossuary });
const knucklebones: ItemModel = {
  palette: ossuary.palette,
  worn: {
    arm: ({ x, y, z, flank }) => {
      const { c } = ossuary;
      if (y === 1) return c.boneShade;
      if (y === 0) return mod(x + z, 2) === 0 ? c.bone : c.wire;
      return flank && mod(z, 2) === 0 ? c.bone : c.socket; // a finger bone on each finger's back
    },
  },
};

// Cinder: ash-grey cloth wound round the palm and wrist, an ember glowing
// between the windings, the bare fingertips black with soot.
const cinder = namedPalette({ ...SET_PALETTES.cinder });
const cinderWraps: ItemModel = {
  palette: cinder.palette,
  worn: {
    arm: ({ y, z, flank }) => {
      const { c } = cinder;
      if (y === -1) return c.soot;
      if (y === 0) return flank && z === 0 ? c.ember : c.ash;
      return c.ashLight;
    },
  },
};

// The watch's: leather gloves, a steel plate over the back of the hand, a
// teal band round the wrist with two brass rivets on the outside.
const watch = namedPalette({ ...SET_PALETTES.watch });
const watchVambraces: ItemModel = {
  palette: watch.palette,
  worn: {
    arm: ({ y, z, flank, front }) => {
      const { c } = watch;
      if (y === 1) return flank && (z === 0 || z === 1) ? c.brass : c.teal;
      if (y === 0) return flank ? c.steel : front ? c.steelLight : c.steelDark;
      return c.leather;
    },
  },
};

// Sunward's: gilded gauntlets, the fingers jointed in two golds, a small gold
// sun on azure on the back of each hand, gold knuckle plates, ivory cuffs.
const sunward = namedPalette({ ...SET_PALETTES.sunward });
const sunwardGauntlets: ItemModel = {
  palette: sunward.palette,
  worn: {
    arm: ({ x, y, z, flank }) => {
      const { c } = sunward;
      if (y === 1) return flank ? c.ivoryShade : c.ivory;
      if (y === -1) return mod(x + z, 2) === 0 ? c.gold : c.goldDark;
      if (flank) return z === 0 || z === 1 ? c.goldLight : c.azure; // the sun on its azure
      return c.gold;
    },
  },
};

// The Reliquary's: arm-reliquaries for gauntlets, gilt, a crystal window on the back of each hand, a bone behind
// it, red silk at the cuff.
const reliquary = namedPalette({ ...SET_PALETTES.reliquary });
const reliquaryGauntlets: ItemModel = {
  palette: reliquary.palette,
  worn: {
    arm: ({ x, y, z, flank }) => {
      const { c } = reliquary;
      if (y === 1) return flank ? c.silkDark : c.silk; // the cuff
      if (y === -1) return mod(x + z, 2) === 0 ? c.gilt : c.giltDark; // the fingers
      if (flank) return z === 0 ? c.bone : c.crystal; // the window, the bone behind
      return c.gilt;
    },
  },
};

export const HANDS_MODELS: Record<keyof typeof HANDS_ITEMS, ItemModel> = {
  ridingGloves: gloves(0x3a2e26, 0x4c3c30),
  workGloves: gloves(0xb08a5a, 0x8a6a42),
  mailMittens,
  gauntlets,
  handWraps,
  fingerlessGloves: gloves(0x4a3a2e, 0x5e4a3a, true),
  furMittens,
  embroideredGloves,
  leatherBracers,
  studdedBracers,
  silkGloves: gloves(0xf0ece0, 0x3dbdb8),
  headsmansGloves,
  knucklebones,
  cinderWraps,
  watchVambraces,
  sunwardGauntlets,
  reliquaryGauntlets,
};
