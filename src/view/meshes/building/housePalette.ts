// House palette, designed before the models: a small set of materials, each
// with a shade or two so voxel detail reads through color (weathered plaster
// at the base and under the eaves, alternating shingle courses, coursed
// stone) rather than extra geometry. Index + 1 is what the voxel grid stores.

import {
  HOUSE_DOOR_COLOR,
  HOUSE_PLASTER_COLOR,
  HOUSE_ROOF_COLORS,
  HOUSE_STONE_COLOR,
  HOUSE_TIMBER_COLOR,
  HOUSE_WINDOW_COLOR,
  IRON_COLOR,
} from '../../constants';

const ENTRIES = {
  plaster: HOUSE_PLASTER_COLOR,
  plasterShade: 0xd6caad,
  plasterWarm: 0xf3e4c4,
  timber: HOUSE_TIMBER_COLOR,
  timberLight: 0x4e3726,
  stone: HOUSE_STONE_COLOR,
  stoneDark: 0x75726a,
  stoneLight: 0xa4a097,
  door: HOUSE_DOOR_COLOR,
  doorDark: 0x46301c,
  glass: HOUSE_WINDOW_COLOR, // glowing windows and lanterns
  iron: IRON_COLOR,
  flowerRed: 0xc4413a,
  flowerYellow: 0xe8c547,
  flowerPurple: 0x8a5ab5,
  leaf: 0x4d7a3a,
  planter: 0x6b4a2c,
  barrel: 0x7a5230,
  bark: 0x5c4330,
  endGrain: 0xd9b98a,
  clayPot: 0xa0522d,
  sign: 0x8a6238,
  ember: 0xff8a3a, // forge coals (glowing)
  emberHot: 0xffc85a, // forge heart (glowing)
  coal: 0x2b2522,
  soot: 0x3a3431,
  earth: 0x5e4630, // packed-earth forge yard
  earthDark: 0x4a3624,
  anvil: 0x4a4a52,
  anvilLight: 0x70707a,
  quench: 0x2a9aac,
  hay: 0xd9b95a,
  hayDark: 0xb89440,
  pewter: 0xb8bcc2,
  beer: 0xd89a2c,
  beerFoam: 0xf6f0de,
  tableWood: 0x7a5433,
  roofMoss: 0x6f9148,
  roofMossLight: 0x88a955,
  herbFresh: 0x5f9a48, // a herbalist's hut (herbalistHouse.ts): herbs drying under its eaves
  herbSage: 0x8aa878,
  herbDry: 0xb89a4a,
  mud: 0x8a7356, // its daubed walls
  mudDark: 0x6e5a42,
  thatch: 0x9a8048, // its shaggy thatch
  thatchDark: 0x6e5a32,
  thatchLight: 0xb89a58,
} as const;

type Entry = keyof typeof ENTRIES;

export const HOUSE_PALETTE: number[] = [...Object.values(ENTRIES)];

// Palette index + 1 for each named color.
export const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<Entry, number>;

// Roofs: one set of [base, light, dark, highlight] per roof color (clay
// tile, slate, straw thatch), appended after the named entries.
export const ROOF_SETS: Array<{ base: number; light: number; dark: number; highlight: number }> = HOUSE_ROOF_COLORS.map((hex) => {
  const shade = (factor: number) => {
    const r = Math.min(255, Math.round(((hex >> 16) & 255) * factor));
    const g = Math.min(255, Math.round(((hex >> 8) & 255) * factor));
    const b = Math.min(255, Math.round((hex & 255) * factor));
    return (r << 16) | (g << 8) | b;
  };
  const start = HOUSE_PALETTE.length;
  HOUSE_PALETTE.push(hex, shade(1.15), shade(0.8), shade(1.3));
  return { base: start + 1, light: start + 2, dark: start + 3, highlight: start + 4 };
});

// Colors meshed with the emissive (glowing) material.
export const GLOWING = new Set([C.glass, C.ember, C.emberHot]);
