// How everything worn on the hands looks. Hand shells cover each arm's rows
// -1 to 1 (-1 under the fist, 1 the wrist; x -1..2, z -1..2 with 2 the
// front; the side toward the body stays open).

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
};
