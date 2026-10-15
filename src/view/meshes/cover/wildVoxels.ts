// What grows in each kind of country (model/scenery/biomes.ts), at the ground cover's 0.04 voxel scale, palette first:
// - ferns (the woods): fronds arching out from a crown, lighter to their tips;
// - mushrooms (the woods): a clutch of brown caps, a red toadstool spotted white;
// - heather (the heath): a low cushion of olive twigs, purple bells over its top;
// - reeds (the marsh): bulrushes with their brown heads among plain reeds leaning, a yellow flag;
// - stones (the hills): a flat slab sunk in the turf, lichen and moss on it.
// Straight, grid-aligned voxels only; silhouette first, seen from the game's camera. Few shapes of each: every shape is
// a draw a chunk (each instanced).

import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

const ENTRIES = {
  frond: 0x3f7a34,
  frondLight: 0x5d9c42,
  frondTip: 0x86b85a,
  frondDark: 0x2c5a28,
  stalk: 0xe6dcc2,
  capBrown: 0x8a5a36,
  capBrownLight: 0xb27c4a,
  capRed: 0xc23a2c,
  capRedDeep: 0x962a22,
  spot: 0xf4ecdc,
  twig: 0x5c5a34,
  twigDark: 0x45432a,
  heather: 0x86587e, // muted: a moor's, not a garden's
  heatherLight: 0xa27a9a,
  heatherDeep: 0x664462,
  reed: 0x5e8a40,
  reedLight: 0x7ea24e,
  reedDry: 0xa8a462,
  rush: 0x6a4128, // a bulrush's head
  rushDark: 0x4e2e1c,
  flag: 0xe8c43c, // a yellow flag's petals
  flagDeep: 0xc89a24,
  stone: 0x9d968a,
  stoneLight: 0xbdb6a6,
  stoneDark: 0x7b766c,
  moss: 0x78913f,
  lichen: 0xd6d08a,
} as const;
export const WILD_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

export const FERN_GRID: [number, number, number] = [13, 8, 13];
export const FERN_SHAPES = 1; // (its quarter turns tell one from another)
export const MUSHROOM_GRID: [number, number, number] = [6, 6, 6];
export const MUSHROOM_SHAPES = 2;
export const HEATHER_GRID: [number, number, number] = [10, 6, 10];
export const HEATHER_SHAPES = 1;
export const REED_GRID: [number, number, number] = [7, 18, 7];
export const REED_SHAPES = 2; // bulrushes among reeds, a yellow flag
export const STONE_GRID: [number, number, number] = [14, 4, 12];
export const STONE_SHAPES = 1;

const put = (g: VoxelGrid, x: number, y: number, z: number, c: number) => {
  const [sx, sy, sz] = g.size;
  if (x >= 0 && y >= 0 && z >= 0 && x < sx && y < sy && z < sz) setColor(g, x, y, z, c);
};

// Fronds out from the middle, each rising to its middle and drooping to its tip.
export function buildFern(shape: number): VoxelGrid {
  const g = createGrid(FERN_GRID);
  const rng = mulberry32(0xfe40 + shape * 131);
  const m = 6;
  const ways = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  const fronds = 5 + shape;
  for (let f = 0; f < fronds; f++) {
    const [dx, dz] = ways[(f * 3 + shape) % ways.length];
    const long = (dx && dz ? 4 : 5) + Math.floor(rng() * 2);
    for (let i = 0; i <= long; i++) {
      const y = Math.round(1 + Math.sin((i / long) * Math.PI * 0.85) * 4 + (i === 0 ? -1 : 0));
      const [x, z] = [m + dx * i, m + dz * i];
      put(g, x, y, z, i >= long - 1 ? C.frondTip : i % 2 ? C.frondLight : C.frond);
      // Its leaflets either side, along it.
      if (i > 0 && i < long - 1 && i % 2 === 0) for (const s of [-1, 1]) put(g, x + (dz ? s : 0), y, z + (dx && !dz ? s : 0), C.frondLight);
    }
  }
  put(g, m, 0, m, C.frondDark);
  put(g, m, 1, m, C.frondDark);
  return g;
}

// A cap (w across) on a stalk `high` voxels, at (x, z).
function cap(g: VoxelGrid, x: number, z: number, high: number, w: number, color: number, top: number, spots = false): void {
  for (let y = 0; y < high; y++) put(g, x, y, z, C.stalk);
  const r = Math.floor(w / 2);
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) put(g, x + dx, high, z + dz, spots && (dx + dz) % 2 && Math.abs(dx) + Math.abs(dz) === 1 ? C.spot : color);
  put(g, x, high + 1, z, top);
}

export function buildMushrooms(shape: number): VoxelGrid {
  const g = createGrid(MUSHROOM_GRID);
  if (shape === 0) {
    // A clutch of brown caps.
    cap(g, 2, 2, 2, 3, C.capBrown, C.capBrownLight);
    cap(g, 4, 4, 1, 1, C.capBrownLight, C.capBrown);
    cap(g, 4, 1, 1, 1, C.capBrown, C.capBrownLight);
  } else {
    // A red toadstool, spotted, and a small one by it.
    cap(g, 2, 2, 3, 3, C.capRed, C.spot, true);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) put(g, 2 + dx, 4, 2 + dz, C.capRedDeep);
    put(g, 2, 4, 2, C.capRed);
    put(g, 2, 5, 2, C.spot);
    cap(g, 4, 4, 1, 1, C.capRed, C.spot);
  }
  return g;
}

// A low cushion: olive twigs, a domed top of purple bells.
export function buildHeather(shape: number): VoxelGrid {
  const g = createGrid(HEATHER_GRID);
  const rng = mulberry32(0x4ea7 + shape * 977);
  const [cx, cz] = [4.5 + (shape === 1 ? 0.5 : 0), 4.5];
  const [rx, rz, ry] = [3.6 + shape * 0.4, 3.4, 3.2 + (shape === 2 ? 1 : 0)];
  for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) for (let y = 0; y < 6; y++) {
    const d = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 + (y / ry) ** 2;
    if (d > 1 - rng() * 0.18) continue;
    setColor(g, x, y, z, y === 0 ? C.twigDark : C.twig);
  }
  // Its top voxels, the bells: mostly purple, lighter and deeper here and there.
  for (let x = 0; x < 10; x++) for (let z = 0; z < 10; z++) for (let y = 5; y >= 1; y--) {
    if (colorAt(g, x, y, z) === 0) continue;
    const r = rng();
    if (r < 0.85) setColor(g, x, y, z, r < 0.2 ? C.heatherLight : r < 0.35 ? C.heatherDeep : C.heather);
    break;
  }
  return g;
}

export function buildReeds(shape: number): VoxelGrid {
  const g = createGrid(REED_GRID);
  const rng = mulberry32(0x12ee + shape * 389);
  const spots = [[3, 3], [1, 2], [5, 4], [2, 5], [4, 1], [5, 2]];
  if (shape === 1) {
    // A yellow flag: sword blades fanned, a flower on a stalk over them.
    for (const [x, z, h] of [[3, 3, 9], [2, 3, 7], [4, 3, 8], [3, 2, 6], [3, 4, 7]]) for (let y = 0; y < h; y++) put(g, x, y, z, y > h - 3 ? C.reedLight : C.reed);
    for (let y = 0; y < 11; y++) put(g, 3, y, 3, C.reed);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, 1]]) put(g, 3 + dx, 11, 3 + dz, C.flag);
    put(g, 3, 11, 3, C.flagDeep);
    put(g, 3, 12, 3, C.flag);
    return g;
  }
  for (let s = 0; s < 5; s++) {
    const [x, z] = spots[s];
    const h = 11 + Math.floor(rng() * 6);
    const lean = s % 2 ? 1 : 0;
    for (let y = 0; y < h; y++) put(g, x + (y > h - 4 ? lean : 0), y, z, y < 3 ? C.reed : y > h - 3 ? C.reedDry : C.reedLight);
    if (s < 3) for (let y = h - 5; y < h - 2; y++) put(g, x, y, z, y === h - 3 ? C.rushDark : C.rush); // a bulrush's head
  }
  return g;
}

// A flat slab, sunk: its foot full, its top inset, lichen and moss on it.
export function buildStone(shape: number): VoxelGrid {
  const g = createGrid(STONE_GRID);
  const rng = mulberry32(0x57a8 + shape * 61);
  const [cx, cz, rx, rz] = shape ? [7, 6, 6, 4.6] : [6.5, 5.5, 5.4, 5];
  for (let x = 0; x < 14; x++) for (let z = 0; z < 12; z++) {
    const d = ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2;
    if (d > 1 - rng() * 0.15) continue;
    const high = d < 0.45 ? 3 : d < 0.8 ? 2 : 1;
    for (let y = 0; y < high; y++) {
      const r = rng();
      const top = y === high - 1;
      setColor(g, x, y, z, top && r < 0.18 ? C.moss : top && r > 0.94 ? C.lichen : top ? (r < 0.6 ? C.stoneLight : C.stone) : C.stoneDark);
    }
  }
  return g;
}
