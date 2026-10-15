// The cathedral town's stone, at its own scale (TOWN_VOXEL: twelve to a tile, half again a house's: the cathedral and the
// walls are monuments, seen whole from the camera's height, four pixels a voxel). Palette first: the cathedral's pale
// limestone in three tones and its mortar; the walls' older, greyer stone; slate and lead for the roofs, clay for the
// wall towers'; the stained glass in four colours (GLASS: drawn unlit, to glow by day and night); oak, iron, gold, moss
// and the dark of a deep opening.

export const TOWN_VOXEL = 1 / 12;
export const PER_TILE = 12;

const ENTRIES = {
  lime: 0xd2c8b0,
  limeDark: 0xaea48c,
  limeLight: 0xe6dfcb,
  mortar: 0x948b77,
  wallStone: 0x9d978b,
  wallDark: 0x7b766b,
  wallLight: 0xb4aea0,
  slate: 0x4f5868,
  slateLight: 0x66707f,
  slateDark: 0x3a404c,
  lead: 0x828a94,
  clay: 0xa0522d,
  clayDark: 0x7a3c22,
  clayLight: 0xba6a40,
  glassBlue: 0x2f58b8,
  glassRed: 0xb83030,
  glassGold: 0xe8b848,
  glassGreen: 0x2f9a58,
  oak: 0x5a3a22,
  oakDark: 0x40291a,
  iron: 0x3c3c44,
  gold: 0xe0b848,
  moss: 0x6f8a48,
  dark: 0x16120e,
  bronze: 0x9a7a3a,
  banner: 0x8a2626,
  bannerGold: 0xd8a83c,
  grass: 0x6a8a3a,
  timber: 0x7c5836, // the stalls': their posts and counters,
  timberLight: 0x9c744a,
  canvas: 0xe8dcc0, // their striped awnings,
  wine: 0x5a1a2a, // and their wares: wine,
  bottle: 0x2e4a2e,
  clothBlue: 0x3a5a9a, // bolts of cloth,
  clothOchre: 0xc89a3a,
  wax: 0xefe6c8, // candles,
  bone: 0xdcd2b4, // and bones in gilt boxes
} as const;

export const TOWN_PALETTE: number[] = Object.values(ENTRIES);
export const T = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const GLASS: ReadonlySet<number> = new Set([T.glassBlue, T.glassRed, T.glassGold, T.glassGreen]);
