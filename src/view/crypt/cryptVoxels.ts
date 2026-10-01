// A crypt in voxels (model/crypts/), at the rooms' 0.04 scale, 25 voxels to a
// tile. Palette first: cold grey stone in three tones with dark mortar (the
// floor a shade darker than the walls, so what stands on it reads), the rock's
// dark top, bone and its shade, rusty iron, terracotta urns, a pale web, moss
// in the cracks; and the only warmth, the candles' wax and their flames (drawn
// unlit, so they glow: GLOW). Every piece is built facing local +Z (a wall
// piece: out of the rock toward the floor), centred on its tiles, its floor at y 0.

import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import type { CryptPropKind } from '../../model/crypts/cryptProps';
import { scatteredBones, slumpedAgainstTheRock, stretchedOut } from './remainsVoxels';
import { cryptWall } from './cryptWallVoxels';
import { sarcophagus, urns } from './tombVoxels';
import { greatTomb } from './greatTombVoxels';
export const BURST = 1; // the great tomb's variant once its lord's risen

export const CRYPT_VOXEL = 0.04;
export const TILE = 25; // voxels to a tile
export const TALL = 34; // the rock's height (as a room's back walls)

const ENTRIES = {
  stone: 0x6e6a66,
  stoneDark: 0x57534f,
  stoneLight: 0x86817a,
  mortar: 0x3e3a37,
  flag: 0x5f5b56,
  flagDark: 0x55514c,
  flagMortar: 0x2f2c29,
  flagLight: 0x6a6660, // a stone's worn middle
  flagEdge: 0x4a4743, // its bevelled edge
  dust: 0x77726b,
  cap: 0x2b2826,
  bone: 0xd9cfb6,
  boneShade: 0xb3a88e,
  socket: 0x2a2420,
  iron: 0x5a5e62,
  rust: 0x7a4a32,
  clay: 0x8a5a3a,
  clayDark: 0x6b4429,
  web: 0xd8d8d0,
  webShade: 0xa8a8a2,
  moss: 0x4f6a3a,
  gold: 0xc8a24a,
  lid: 0x7a7570,
  wax: 0xe6dcc2,
  boneDark: 0x8e8470,
  ironDark: 0x3e4246,
  wood: 0x5a4030,
  waxShade: 0xc4b896, // wax run down, and the melted dip at a candle's top
  portal: 0xd8f4ff, // (glow) the way out's cold light
  portalDeep: 0x9fd8f0, // (glow) and its edges
  flame: 0xffb347, // (glow)
  core: 0xfff0a0, // (glow)
} as const;
export const CRYPT_PALETTE: number[] = Object.values(ENTRIES);
export const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const GLOW: ReadonlySet<number> = new Set([C.flame, C.core, C.portal, C.portalDeep]); // drawn unlit: the flames

export type Box = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: number | ((u: number, y: number, v: number) => number)) => void;
const boxIn = (grid: VoxelGrid): Box => (u0, y0, v0, u1, y1, v1, color) => fillBox(grid, u0, y0, v0, u1, y1, v1, typeof color === 'number' ? () => color : color);

// A wall tile of rock, `high` voxels (cryptWallVoxels.ts).
export const wallTile = (high: number, variant: number): VoxelGrid => cryptWall(high, variant);

// A wall piece stands out from the rock's face: its grid reaches OUT voxels past the tile, toward the floor
// (all it draws lies there, never in the rock, or its faces would fight the wall's).
export const OUT = 5;
export const ON_WALL: ReadonlySet<CryptPropKind> = new Set(['sconce', 'niche']);
const SPARE = 10; // voxels beside a sarcophagus each side (its broken lid's pieces lie there)
const PROP_SIZE: Record<CryptPropKind, [number, number, number]> = {
  sconce: [TILE, TALL, TILE + OUT],
  niche: [TILE, TALL, TILE + OUT],
  cobweb: [TILE, TALL, TILE],
  skeleton: [TILE, 6, TILE],
  slumped: [TILE, 16, TILE],
  bones: [TILE, 6, TILE],
  stones: [TILE, 4, TILE],
  sarcophagus: [TILE + 2 * SPARE, 15, TILE * 2], // (spare each side: room for a broken lid's slab, slid off)
  urns: [TILE, 17, TILE],
  candles: [TILE, 16, TILE],
  rubble: [TILE, 11, TILE],
  dais: [TILE * 4, 3, TILE * 5],
  greatSarcophagus: [TILE * 2, 34, TILE * 3],
};

// A prop's voxels, by kind and variant (0..3).
export function cryptProp(kind: CryptPropKind, variant: number): VoxelGrid {
  const grid = createGrid(PROP_SIZE[kind]);
  PAINT[kind](boxIn(grid), variant);
  return grid;
}

// A skull, 5 across, its face toward +v, standing on y.
function skull(box: Box, u: number, y: number, v: number): void {
  box(u, y, v, u + 4, y + 4, v + 3, C.bone);
  box(u, y, v + 2, u + 4, y + 1, v + 3, C.boneShade); // the jaw
  box(u + 1, y + 2, v + 3, u + 1, y + 3, v + 3, C.socket); // the eyes
  box(u + 3, y + 2, v + 3, u + 3, y + 3, v + 3, C.socket);
}

// A candle `high` tall at (u, v), its flame over it.
// A candle at (u, v), `high` tall: round (three across, its corners off), wax run down its sides here and
// there, its rim melted into a dip round the wick, the flame over it (unless `out`).
function candle(box: Box, u: number, v: number, high: number, salt: number, out = false): void {
  for (let y = 0; y < high; y++) {
    box(u, y, v + 1, u + 2, y, v + 1, C.wax);
    box(u + 1, y, v, u + 1, y, v + 2, C.wax);
  }
  // Runs of wax down its sides, a voxel proud, from its top part way down.
  for (const [du, dv, k] of [[-1, 1, 0], [3, 1, 1], [1, -1, 2], [1, 3, 3]]) {
    const run = Math.floor(((salt * 7 + k * 13) % 5) * high * 0.15);
    if (run > 0) box(u + du, high - 1 - run, v + dv, u + du, high - 2, v + dv, C.waxShade);
  }
  box(u + 1, high - 1, v + 1, u + 1, high - 1, v + 1, C.waxShade); // the melted dip
  box(u + 1, high, v + 1, u + 1, high, v + 1, C.socket); // the wick
  if (out) return;
  box(u + 1, high + 1, v + 1, u + 1, high + 2, v + 1, C.flame);
  box(u + 1, high + 3, v + 1, u + 1, high + 3, v + 1, C.core);
}

// A pool of melted wax round (cu, cv), `r` across, its edge uneven, runs of it reaching out.
function waxPool(box: Box, cu: number, cv: number, r: number, salt: number): void {
  for (let u = cu - r - 2; u <= cu + r + 2; u++) for (let v = cv - r - 2; v <= cv + r + 2; v++) {
    const a = Math.atan2(v - cv, u - cu);
    const edge = r + Math.sin(a * 3 + salt) * 1.2 + Math.sin(a * 5 + salt * 2) * 0.8;
    const d = Math.hypot(u - cu, v - cv);
    if (d <= edge) box(u, 0, v, u, 0, v, d > edge - 1 ? C.waxShade : C.wax);
  }
}

const PAINT: Record<CryptPropKind, (box: Box, variant: number) => void> = {
  // An iron plate on the wall face (+v), a bracket out from it, a torch in it, burning.
  sconce: (box) => {
    box(10, 16, TILE, 14, 21, TILE, C.iron); // the plate, flat on the face
    box(11, 18, TILE + 1, 13, 19, TILE + 3, C.iron); // the bracket
    box(11, 20, TILE + 2, 13, 25, TILE + 3, C.rust); // the torch
    box(11, 26, TILE + 2, 13, 28, TILE + 3, C.flame);
    box(12, 29, TILE + 2, 12, 30, TILE + 2, C.core);
  },
  // A recess on the wall face (its dark set a voxel out from the stone), framed, a ledge out under it, two skulls on it.
  niche: (box, variant) => {
    box(5, 12, TILE, 19, 22, TILE, C.socket); // the dark within
    box(3, 12, TILE, 4, 22, TILE + 1, C.stoneDark); // the jambs
    box(20, 12, TILE, 21, 22, TILE + 1, C.stoneDark);
    box(3, 23, TILE, 21, 24, TILE + 1, C.stoneLight); // the lintel
    box(3, 10, TILE, 21, 11, TILE + 4, C.stoneLight); // the ledge
    // Two skulls, apart on the ledge (a little this way or that by variant).
    const shift = (variant % 2) - (variant > 1 ? 1 : 0);
    skull(box, 6 + shift, 12, TILE);
    skull(box, 13 + shift, 12, TILE);
  },
  // A web in the corner of the two walls (the tile's -u and -v sides), hung from high up where they meet:
  // threads fanning out from the corner to a quarter circle, sloping down and away, crossed by rings of
  // silk that sag between them. Bigger or smaller, and turned a little, by variant.
  cobweb: (box, variant) => {
    const reach = 11 + variant * 1.5; // its radius, in voxels
    const top = TALL - 2;
    const at = (r: number, angle: number, sag = 0): [number, number, number] => [
      Math.round(r * Math.cos(angle)),
      Math.round(top - r * 0.75 - sag),
      Math.round(r * Math.sin(angle)),
    ];
    const dot = ([u, y, v]: [number, number, number], color: number) => box(u, y, v, u, y, v, color);
    const threads = 5;
    const twist = variant * 0.06;
    for (let k = 0; k < threads; k++) {
      const angle = twist + (k / (threads - 1)) * (Math.PI / 2 - 2 * twist);
      for (let r = 0; r <= reach; r += 0.5) dot(at(r, angle), C.web); // a thread, out from the corner
    }
    for (const ring of [0.3, 0.55, 0.8, 1]) {
      const r = reach * ring;
      for (let a = 0; a <= Math.PI / 2; a += 0.03) {
        const between = Math.abs(Math.sin(((a - twist) / (Math.PI / 2)) * (threads - 1) * Math.PI)); // 0 at a thread, 1 midway
        dot(at(r, a, between * ring * 2), ring === 1 ? C.web : C.webShade); // a ring, sagging between threads
      }
    }
  },
  skeleton: (box, variant) => stretchedOut(box, variant),
  slumped: (box, variant) => slumpedAgainstTheRock(box, variant),
  bones: (box, variant) => scatteredBones(box, variant),
  // A few stones fallen from the vault.
  stones: (box, variant) => {
    box(3 + variant, 0, 4, 7 + variant, 2, 8, C.stoneDark);
    box(14, 0, 12 - variant, 18, 3, 16 - variant, C.stone);
    box(9, 0, 18, 11, 1, 20, C.stoneLight);
  },
  // A stone coffin a tile across, two long (tombVoxels.ts); variant 3 broken open.
  sarcophagus: (raw, variant) => sarcophagus((u0, y0, v0, u1, y1, v1, color) => raw(u0 + SPARE, y0, v0, u1 + SPARE, y1, v1, color), variant), // (centred in its wider grid)

  // Jars, turned, against the wall (tombVoxels.ts).
  urns: urns,

  // Candles of different heights in a cluster, on a puddle of wax.
  candles: (box, variant) => {
    waxPool(box, 12, 12, 6, variant);
    candle(box, 8, 9, 11, 1 + variant);
    candle(box, 13, 7, 8, 2);
    candle(box, 10, 14, 5 + variant, 3);
    candle(box, 15, 12, 3, 4); // burnt down to a stub
    if (variant === 1 || variant === 3) {
      // One fallen on its side, out, its wax run across the floor.
      box(15, 1, 17, 21, 2, 18, C.wax);
      box(21, 1, 17, 21, 2, 18, C.waxShade);
      box(14, 0, 17, 14, 0, 19, C.waxShade);
    }
    if (variant === 2) {
      // One stuck on a skull, its wax run down over the brow.
      box(16, 1, 15, 21, 5, 20, C.bone);
      box(16, 0, 16, 21, 0, 19, C.boneShade);
      box(17, 3, 21, 18, 4, 21, C.socket); // the eyes, toward the room
      box(20, 3, 21, 21, 4, 21, C.socket);
      box(17, 5, 17, 20, 5, 19, C.waxShade);
      candle(box, 17, 16, 10, 5);
    }
  },

  // A heap of fallen stones.
  rubble: (box, variant) => {
    box(2, 0, 3, 22, 3, 21, C.stoneDark);
    box(4, 4, 5, 18, 6, 18, C.stone);
    box(7, 7, 8, 14 + variant, 9, 15, C.stoneLight);
    box(10, 10, 10, 12, 10, 12, C.stone);
  },
  // A low stone platform, a step round its edge.
  dais: (box) => {
    box(0, 0, 0, TILE * 4 - 1, 0, TILE * 5 - 1, C.stoneDark);
    box(3, 1, 3, TILE * 4 - 4, 2, TILE * 5 - 4, C.stone);
  },
  // The great sarcophagus (tombVoxels.ts).
  greatSarcophagus: (box, variant) => greatTomb(box, variant === BURST), // (greatTombVoxels.ts)

};

// The stairs up to the ruin, where the hero comes down: steps rising toward the +v wall (the way out), in stone, dark above.
export function stairsUp(): VoxelGrid {
  const grid = createGrid([TILE * 2, 18, TILE]);
  const box = boxIn(grid);
  for (let k = 0; k < 5; k++) box(2, 0, 4 + k * 4, TILE * 2 - 3, 2 + k * 3, 7 + k * 4, k % 2 ? C.stone : C.stoneLight);
  return grid;
}
