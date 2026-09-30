// The palette furniture is painted in (its colors come after the room's own,
// roomVoxels.ts ROOM_PALETTE), and what every piece's painter shares.

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
];
export const [WOOD, WOOD_DARK, WOOD_LIGHT, RED, TEAL, LINEN, FIRE, EMBER, IRON, IRON_LIGHT, SOOT, BRASS, WATER, COAL, STONE, STONE_DARK] = FURNITURE_PALETTE.map((_, i) => 14 + i);
export const [RED_DARK, RED_LIGHT, FUR_DARK, FUR, FUR_LIGHT, BONE, BONE_DARK, CLAY, CLAY_DARK, GLASS_GREEN, GLASS_AMBER, WINE, GLASS_CLEAR, BREAD, ROAST, PARCHMENT, INK, BRASS_DARK] =
  FURNITURE_PALETTE.slice(16, 34).map((_, i) => 30 + i);
export const [INDIGO, INDIGO_DARK, INDIGO_LIGHT, MOSS, MOSS_DARK, MOSS_LIGHT, PLUM, PLUM_DARK, PLUM_LIGHT] = FURNITURE_PALETTE.slice(34).map((_, i) => 48 + i);

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

// A drink set down at (u, y, v): full and empty by turns (`i` counts them),
// so there are as many of each.
export function drink(box: Box, u: number, y: number, v: number, i: number): void {
  tankard(box, u, y, v, i % 2 === 0);
}

export type Box = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: number | ((u: number, y: number, v: number) => number)) => void;
