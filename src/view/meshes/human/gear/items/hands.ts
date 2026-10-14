// How everything worn on the hands looks. Hand shells cover each arm's rows
// -1 to 1 (-1 under the fist, 1 the wrist; x -1..2, z -1..2 with 2 the
// front; the side toward the body stays open).
//
// The new hand pieces (each a STAND-IN below till it's drawn; its set's colours: setPalettes.ts):
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
  headsmansGloves: gloves(0x1c1a1c, 0x2e2a2c), // STAND-IN: long black gauntlet gloves, wide flared stitched cuff, stained palms
  knucklebones: gloves(0xe0d4b4, 0x2a2220), // STAND-IN: finger bones wired along each finger over dark leather, knucklebones across, bone wrist ring
  cinderWraps: handWraps, // STAND-IN: ash-grey cloth wound round palm and wrist, sooted bare fingertips, ember glow between windings
  watchVambraces: gauntlets, // STAND-IN: leather gloves under steel vambraces, teal wrist band with two brass rivets
  sunwardGauntlets: gloves(0xd4b060, 0xf4f0e6), // STAND-IN: articulated gilded gauntlets, ivory cuffs, a small sun on azure on each hand's back
};
