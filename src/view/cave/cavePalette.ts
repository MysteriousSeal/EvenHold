// A cave's palette (cave/caveVoxels.ts and its pieces), at the rooms' 0.04
// scale, 25 voxels to a tile. Palette first: no stone dressed by hands here,
// all of it dug. The rock a damp umber in three tones, sandy strata through
// it, wet streaks darker, a dark top; the floor packed earth in three tones,
// pebbles, roots and moss; old bone; silk and the egg-sacs' cream; and its
// only light, drawn unlit (GLOW): the glowcaps' teal, the crystals' lavender,
// the pools' glints, the eggs' sickly stirring, the daylight at its ways out.

export const CAVE_VOXEL = 0.04;
export const TILE = 25; // voxels to a tile
export const TALL = 32; // the rock's height, about (its top ragged)

const ENTRIES = {
  rock: 0x5a5048,
  rockDark: 0x463e38,
  rockLight: 0x6e6258,
  strata: 0x7c6c5a,
  wet: 0x3a3634,
  crevice: 0x2c2724,
  cap: 0x1e1a18,
  earth: 0x4a3c30,
  earthDark: 0x3a2f26,
  earthLight: 0x5a4a3a,
  pebble: 0x6e665e,
  pebbleDark: 0x55504a,
  root: 0x5e4430,
  rootLight: 0x7a5a3e,
  moss: 0x4a5e34,
  mossLight: 0x5e7a40,
  bone: 0xd9cfb6,
  boneShade: 0xb3a88e,
  socket: 0x2a2420,
  silk: 0xe8e2d6,
  silkShade: 0xb8b0a2,
  egg: 0xe2d8b8,
  eggVein: 0xc0a882,
  stem: 0xcfc4a8,
  water: 0x1e3a44,
  waterDeep: 0x14282f,
  drip: 0x9a8c7a, // a stalagmite's wet mineral tip
  gold: 0xd8b04a,
  goldDark: 0xa07e2e,
  iron: 0x7a7e84,
  leather: 0x5a3a26,
  grass: 0x6a8a3a, // (the world creeping in at the way up)
  grassLight: 0x86a848,
  leaf: 0x9a6a2e,
  flower: 0xe8d070,
  glowcap: 0x5ee0c4, // (glow)
  glowcapLight: 0xc8fff0, // (glow) its spots
  crystal: 0x9aa8ff, // (glow)
  crystalCore: 0xe4ecff, // (glow)
  glint: 0x5cc8d0, // (glow) the light on a pool
  stir: 0xd8e070, // (glow) the young stirring in an egg
  day: 0xfff0c8, // (glow) the daylight, at the way up and the way out
  dayDeep: 0xf0c880, // (glow) and its edges
} as const;

export const CAVE_PALETTE: number[] = Object.values(ENTRIES);
export const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const GLOW: ReadonlySet<number> = new Set([C.glowcap, C.glowcapLight, C.crystal, C.crystalCore, C.glint, C.stir, C.day, C.dayDeep]); // drawn unlit
