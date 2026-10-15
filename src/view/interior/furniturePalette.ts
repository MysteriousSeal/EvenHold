// The palette furniture is painted in (its colors come after the room's own,
// roomVoxels.ts ROOM_PALETTE), and what every piece's painter shares.

// A herbalist's own (herbalistVoxels.ts): peat, moss and green glass. Her brew glowing, the pale stones ringing it;
// roots, mushrooms, sacking, birch twigs, rowan berries, garlic and chillies; her herbs; her glass; her patched blanket.
const HERBAL_COLORS = [
  0x8aff6a, // brew, its glowing heart
  0x3e9a3a, // brew
  0xb8b0a0, // pale stone
  0x8a6a48, // root
  0xc8b088, // root, light
  0xc04a30, // toadstool cap
  0xe8dcc8, // toadstool's spots, garlic
  0xc89a5a, // mushroom cap
  0x9a8458, // sacking
  0x7a6844, // sacking, shade
  0xd8d0c0, // birch bark
  0x3a3430, // birch's marks
  0xc83a2a, // rowan berries, chillies
  0x5aa86a, // glass, green
  0xc88a2a, // glass, amber
  0x3a5aa8, // glass, cobalt
  0xb04a5a, // glass, rose
  0x5e5a3a, // blanket
  0x7a6a48, // blanket's patch
  0x4a5a3a, // blanket's other patch
  0xb89a58, // plait, twine
  0x4d6e34, // herb, deep green
  0x8aa878, // herb, sage
  0xb08f48, // herb, dried gold
  0x8a6aa0, // herb, lavender
];

// Colors, after the room's own (roomVoxels.ts ROOM_PALETTE): palette index + 1.
export const FURNITURE_PALETTE = [
  0x8a5a35, // 14 wood
  0x5e3f28, // 15 wood, dark
  0xb08a5a, // 16 wood, light
  0x9a3a2a, // 17 red cloth
  0x2f9c9a, // 18 teal cloth
  0xe8dcc0, // 19 linen
  0xff8a2a, // 20 fire
  0xffd070, // 21 embers
  0x5a5e66, // 22 iron
  0x8d939c, // 23 iron, light
  0x2e2a28, // 24 soot
  0xd4b060, // 25 brass
  0x3dbdb8, // 26 water
  0x1e1c1a, // 27 coal
  0x9a948a, // 28 stone
  0x7e786e, // 29 stone, dark
  // Each material its own ramp (shadow, mid, light), so what a thing is made
  // of reads at a glance: cloth, fur, bone, clay, glass, food, paper.
  0x6e2a20, // 30 red cloth, shadow
  0xbc5442, // 31 red cloth, light
  0x3e2a1c, // 32 fur, dark
  0x5c3e28, // 33 fur
  0x7c5838, // 34 fur, light
  0xe6d8b4, // 35 bone
  0xb4a27c, // 36 bone, shadow
  0xa85c36, // 37 clay
  0x7a3e22, // 38 clay, shadow
  0x3f7c4a, // 39 green glass
  0xc07a2c, // 40 amber glass
  0x6a1e2e, // 41 wine
  0xa4d0c6, // 42 clear glass
  0xcc9440, // 43 bread
  0x7c3c20, // 44 roast
  0xe4d4a4, // 45 parchment
  0x6a5840, // 46 ink
  0x9a7834, // 47 brass, shadow
  // Bed blankets, besides the red (bedVoxels.ts): main, shadow, light.
  0x3e5a96, // 48 indigo
  0x2a3e6c, // 49 indigo, shadow
  0x5e7cba, // 50 indigo, light
  0x4e7a3e, // 51 moss
  0x36582a, // 52 moss, shadow
  0x6e9a5a, // 53 moss, light
  0x74406e, // 54 plum
  0x522c50, // 55 plum, shadow
  0x965e90, // 56 plum, light
  // The smithy's (smithyVoxels.ts, smithyShell.ts): its quench water dark, catching the light at its rim; iron glowing
  // from the fire; cinders, mill scale and soot; a bright edge on worked iron; its own cold stone and flags.
  0x26343a, // 57 quench water
  0x4a5e66, // 58 quench water, its rim catching the light
  0xff5a1e, // 59 hot iron
  0x8a4a22, // 60 cinder (and a rim lit from below by the fire)
  0x3c3f45, // 61 mill scale (iron, dark)
  0x3a3633, // 62 soot, lighter
  0xb4bac2, // 63 iron, its worn edge
  0x6a6660, // 64 smithy stone
  0x56524d, // 65 smithy stone, dark
  0x34312e, // 66 smithy mortar
  0x4f4b47, // 67 smithy flagstone
  0x45423e, // 68 smithy flagstone, dark
  0x2c2a28, // 69 smithy flagstone mortar
  0x2a2624, // 70 soot plume
  ...HERBAL_COLORS,
];
export const [WOOD, WOOD_DARK, WOOD_LIGHT, RED, TEAL, LINEN, FIRE, EMBER, IRON, IRON_LIGHT, SOOT, BRASS, WATER, COAL, STONE, STONE_DARK] = FURNITURE_PALETTE.map((_, i) => 14 + i);
export const [RED_DARK, RED_LIGHT, FUR_DARK, FUR, FUR_LIGHT, BONE, BONE_DARK, CLAY, CLAY_DARK, GLASS_GREEN, GLASS_AMBER, WINE, GLASS_CLEAR, BREAD, ROAST, PARCHMENT, INK, BRASS_DARK] =
  FURNITURE_PALETTE.slice(16, 34).map((_, i) => 30 + i);
export const [INDIGO, INDIGO_DARK, INDIGO_LIGHT, MOSS, MOSS_DARK, MOSS_LIGHT, PLUM, PLUM_DARK, PLUM_LIGHT, QUENCH, QUENCH_LIGHT, HOT_IRON, CINDER, SCALE, SOOT_LIGHT, IRON_EDGE, SMITHY_STONE, SMITHY_STONE_DARK, SMITHY_MORTAR, SMITHY_FLAG, SMITHY_FLAG_DARK, SMITHY_FLAG_MORTAR, PLUME] = FURNITURE_PALETTE.slice(34).map((_, i) => 48 + i);
// (A herbalist's, found by color: wherever in the palette they fall.)
export const [BREW_GLOW, BREW, PALE_STONE, ROOT, ROOT_LIGHT, CAP_RED, CAP_SPOT, CAP_TAN, SACKING, SACKING_DARK, BIRCH, BIRCH_MARK, BERRY, HERB_GLASS_GREEN, HERB_GLASS_AMBER, HERB_GLASS_COBALT, HERB_GLASS_ROSE, BLANKET, BLANKET_PATCH, BLANKET_PATCH_DARK, TWINE, HERB_DEEP, HERB_SAGE, HERB_GOLD, HERB_LAVENDER] =
  HERBAL_COLORS.map((c) => 14 + FURNITURE_PALETTE.indexOf(c));

// A tankard standing at (u, y, v): a wooden body with iron hoops and a
// handle on its side; full, a white head of foam on top; empty, open at the
// top, its dark bottom showing. Full or empty, the same shape.
export function tankard(box: Box, u: number, y: number, v: number, full: boolean): void {
  box(u, y, v, u + 2, y + 3, v + 2, (_u, yy) => (yy === y || yy === y + 2 ? IRON : WOOD_LIGHT)); // a wooden lip on top
  box(u + 3, y + 1, v + 1, u + 3, y + 2, v + 1, IRON); // handle
  if (full) box(u, y + 4, v, u + 2, y + 4, v + 2, LINEN); // foam
  else {
    box(u + 1, y + 2, v + 1, u + 1, y + 3, v + 1, 0); // open
    box(u + 1, y + 1, v + 1, u + 1, y + 1, v + 1, WOOD_DARK); // down to its bottom
  }
}

// A glass of wine standing at (u, y, v), as tall as a tankard: a foot, a
// stem, a bowl widening to its rim; full, the wine showing through the glass
// and at its top; empty, the bowl clear and hollow.
export function goblet(box: Box, u: number, y: number, v: number, full: boolean): void {
  const cross = (yy: number, color: number) => {
    box(u + 1, yy, v, u + 1, yy, v + 2, color);
    box(u, yy, v + 1, u + 2, yy, v + 1, color);
  };
  cross(y, GLASS_CLEAR); // the foot
  box(u + 1, y + 1, v + 1, u + 1, y + 1, v + 1, GLASS_CLEAR); // the stem
  cross(y + 2, full ? WINE : GLASS_CLEAR); // the bowl's bottom
  box(u, y + 3, v, u + 2, y + 3, v + 2, (uu, _y, vv) => ((uu === u || uu === u + 2) && (vv === v || vv === v + 2) ? 0 : full ? WINE : uu === u + 1 && vv === v + 1 ? 0 : GLASS_CLEAR)); // its belly
  cross(y + 4, GLASS_CLEAR); // the rim
  box(u + 1, y + 4, v + 1, u + 1, y + 4, v + 1, full ? WINE : 0); // the wine's top, or the hollow
}

// A meat pie on a plate at (u, y, v), as wide as a tankard and low: full,
// a golden crust crimped darker round its edge, domed, a steam vent on top;
// eaten, the plate and a crumb or two.
export function piePlate(box: Box, u: number, y: number, v: number, full: boolean): void {
  box(u, y, v, u + 3, y, v + 2, LINEN); // the plate
  if (!full) {
    box(u + 1, y + 1, v, u + 1, y + 1, v, BREAD); // crumbs
    box(u + 2, y + 1, v + 2, u + 2, y + 1, v + 2, BREAD);
    return;
  }
  const edge = (uu: number, vv: number) => uu === u || uu === u + 3 || vv === v || vv === v + 2;
  box(u, y + 1, v, u + 3, y + 1, v + 2, (uu, _y, vv) => (edge(uu, vv) && (uu + vv) % 2 === 0 ? ROAST : BREAD)); // the crust, crimped
  box(u + 1, y + 2, v, u + 2, y + 2, v + 2, BREAD); // its dome
  box(u + 1, y + 2, v + 1, u + 1, y + 2, v + 1, ROAST); // the steam vent
}

// A drink set down at (u, y, v): full and empty by turns (`i` counts them),
// so there are as many of each.
export function drink(box: Box, u: number, y: number, v: number, i: number): void {
  tankard(box, u, y, v, i % 2 === 0);
}

export type Box = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: number | ((u: number, y: number, v: number) => number)) => void;
