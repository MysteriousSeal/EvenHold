// A crypt in voxels (model/crypts/), at the rooms' 0.04 scale, 25 voxels to a
// tile. Palette first: cold grey stone in three tones with dark mortar (the
// floor a shade darker than the walls, so what stands on it reads), the rock's
// dark top, bone and its shade, rusty iron, terracotta urns, a pale web, moss
// in the cracks; and the only warmth, the candles' wax and their flames (drawn
// unlit, so they glow: GLOW). Every piece is built facing local +Z (a wall
// piece: out of the rock toward the floor), centred on its tiles, its floor at y 0.

import { createGrid, fillBox } from '../meshes/voxel/voxelShapes';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { hashUnit } from '../../util/random';
import type { CryptPropKind } from '../../model/crypts/cryptProps';
import { scatteredBones, slumpedAgainstTheRock, stretchedOut } from './remainsVoxels';

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
  flame: 0xffb347, // (glow)
  core: 0xfff0a0, // (glow)
} as const;
export const CRYPT_PALETTE: number[] = Object.values(ENTRIES);
export const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const GLOW: ReadonlySet<number> = new Set([C.flame, C.core]); // drawn unlit: the flames

export type Box = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, color: number | ((u: number, y: number, v: number) => number)) => void;
const boxIn = (grid: VoxelGrid): Box => (u0, y0, v0, u1, y1, v1, color) => fillBox(grid, u0, y0, v0, u1, y1, v1, typeof color === 'number' ? () => color : color);

// Coursed stone, blocks 6 long and 4 high, their joints staggered, tones by block.
function coursed(u: number, y: number, v: number, salt: number): number {
  if (y % 4 === 0) return C.mortar;
  const course = Math.floor(y / 4);
  const along = u + v + (course % 2) * 3;
  if (along % 6 === 0) return C.mortar;
  const pick = hashUnit(Math.floor(along / 6), course, salt) * 3;
  return pick < 1 ? C.stone : pick < 2 ? C.stoneDark : C.stoneLight;
}

// A wall tile of rock, `high` voxels, its faces coursed stone, its top dark.
export function wallTile(high: number, variant: number): VoxelGrid {
  const grid = createGrid([TILE, high, TILE]);
  boxIn(grid)(0, 0, 0, TILE - 1, high - 1, TILE - 1, (u, y, v) => (y === high - 1 ? C.cap : coursed(u, y, v, 80 + variant)));
  return grid;
}

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
  urns: [TILE, 13, TILE],
  candles: [TILE, 12, TILE],
  rubble: [TILE, 11, TILE],
  dais: [TILE * 4, 3, TILE * 5],
  greatSarcophagus: [TILE * 2, 19, TILE * 3],
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
function candle(box: Box, u: number, v: number, high: number): void {
  box(u, 0, v, u + 1, high - 1, v + 1, C.wax);
  box(u, high, v, u + 1, high, v + 1, C.flame);
  box(u, high + 1, v, u, high + 1, v, C.core);
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
  // A stone coffin a tile across, two long, its lid edged and carved with a cross; variant 3 broken open.
  sarcophagus: (raw, variant) => {
    const box: Box = (u0, y0, v0, u1, y1, v1, color) => raw(u0 + SPARE, y0, v0, u1 + SPARE, y1, v1, color); // (centred in its wider grid)
    box(3, 0, 3, 21, 9, 46, C.stone);
    box(3, 0, 3, 21, 1, 46, C.stoneDark); // the plinth
    if (variant === 1) box(4, 0, 4, 6, 3, 45, C.moss);
    if (variant === 3) return brokenOpen(box);
    // Its lid, a cross carved on it.
    box(2, 10, 2, 22, 12, 47, C.lid);
    box(2, 13, 4, 22, 14, 45, C.stoneLight);
    box(11, 14, 10, 13, 14, 38, C.stoneDark); // the cross's upright
    box(6, 14, 16, 18, 14, 18, C.stoneDark); // its arm
  },
  // Two or three clay urns against the wall.
  urns: (box, variant) => {
    const urn = (u: number, v: number, high: number) => {
      box(u + 1, 0, v + 1, u + 6, 1, v + 6, C.clayDark);
      box(u, 2, v, u + 7, high - 3, v + 7, C.clay);
      box(u + 2, high - 2, v + 2, u + 5, high - 1, v + 5, C.clayDark);
    };
    urn(3, 4, 12);
    urn(13, 10, 10);
    if (variant > 1) urn(5, 15, 9);
  },
  // Candles of different heights in a cluster, on a puddle of wax.
  candles: (box, variant) => {
    box(6, 0, 6, 18, 0, 18, C.wax);
    candle(box, 8, 8, 8);
    candle(box, 13, 9, 6);
    candle(box, 10, 13, 5 + variant);
    if (variant > 0) candle(box, 15, 14, 4);
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
  // The great sarcophagus: larger, gold along its lid's edge, a carved figure lying on it.
  greatSarcophagus: (box) => {
    box(5, 0, 5, 44, 11, 69, C.stone);
    box(5, 0, 5, 44, 2, 69, C.stoneDark);
    box(3, 12, 3, 46, 14, 71, C.lid);
    box(3, 14, 3, 46, 14, 3, C.gold);
    box(3, 14, 71, 46, 14, 71, C.gold);
    box(3, 14, 3, 3, 14, 71, C.gold);
    box(46, 14, 3, 46, 14, 71, C.gold);
    box(18, 15, 12, 31, 17, 22, C.stoneLight); // the figure's head and shoulders
    box(16, 15, 23, 33, 17, 55, C.stoneLight); // its body
    box(22, 18, 30, 27, 18, 40, C.gold); // the hands, clasped on a sword's hilt
    box(24, 18, 41, 25, 18, 56, C.iron); // the sword along it
  },
};

// The stairs up to the ruin, where the hero comes down: steps rising toward the +v wall (the way out), in stone, dark above.
export function stairsUp(): VoxelGrid {
  const grid = createGrid([TILE * 2, 18, TILE]);
  const box = boxIn(grid);
  for (let k = 0; k < 5; k++) box(2, 0, 4 + k * 4, TILE * 2 - 3, 2 + k * 3, 7 + k * 4, k % 2 ? C.stone : C.stoneLight);
  return grid;
}

// A sarcophagus broken open: the dark inside it showing; its lid's head end still on, broken off
// jagged; the middle of it fallen in, tilted down into the dark; the foot end slid off, stood on its
// edge against the coffin's side, a piece of it flat on the floor; shards of it about.
function brokenOpen(box: Box): void {
  box(3, 9, 3, 21, 9, 46, C.stoneDark); // the rim
  box(5, 9, 5, 19, 9, 44, C.socket); // the dark within
  // The head end of the lid, still on: broken off jagged across.
  for (let u = 2; u <= 22; u++) {
    const edge = 17 + ((u * 7) % 5) - 2 + (u > 14 ? 2 : 0);
    box(u, 10, 2, u, 12, edge, C.lid);
    box(u, 13, 4, u, 14, edge - 1, C.stoneLight);
  }
  box(11, 14, 10, 13, 14, 15, C.stoneDark); // what's left of the cross: its head
  box(6, 14, 14, 18, 14, 15, C.stoneDark);
  // The middle, fallen in: tilted down from the break into the dark.
  for (let v = 21; v <= 33; v++) {
    const y = 8 - Math.floor((v - 21) / 3);
    box(6, y - 1, v, 18, y, v, v % 4 === 0 ? C.stoneLight : C.lid);
  }
  // The foot end, slid off: a big slab of it stood on its edge against the coffin's side (upright,
  // so no voxel steps), its top broken jagged; a smaller piece of it lying flat on the floor by it.
  for (let v = 26; v <= 46; v++) {
    const top = 13 - ((v * 5) % 4) + (v > 40 ? -2 : 0);
    box(22, 0, v, 24, top, v, C.lid);
    box(25, 0, v, 25, top - 1, v, C.stoneLight); // its carved face, turned out
  }
  box(26, 0, 10, 31, 2, 21, C.lid);
  box(26, 2, 11, 30, 2, 20, C.stoneLight);
  // Shards about.
  box(24, 0, 24, 25, 1, 26, C.lid);
  box(26, 0, 20, 26, 0, 21, C.stoneLight);
  box(-2, 0, 36, -1, 1, 38, C.lid);
}
