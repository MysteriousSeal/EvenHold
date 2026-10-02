// A cave's mouth out in the hills (model/caves/caves.ts): a craggy outcrop
// over its three tiles by three (75 x 75 voxels, the ruins' 0.04), its mouth
// in its front (local +Z, toward the spot before it). Silhouette first: not a
// mound but rock piled on rock: a tall crag at the back, two boulders
// shouldering the mouth, a slab laid across them for its lintel, smaller rocks
// tumbled into its corners (filling the ground it's blocked on); every mass craggy (its surface knocked about by
// noise), its sides steep. Palette first: weathered grey-brown stone in three tones, faint
// strata, lichen; grass in patches over its tops only (where they face up),
// draping a voxel over their edges; the mouth an arch under the lintel, black
// within, its rim in shadow: cut into the rock only (never out past its
// face), over a floor of its own rock; nothing laid before it. Dark only ever
// where it faces into the mouth, never the open air. Roots hang from the lintel; a bone or two lie just inside. Sunk into
// the ground (SINK) so it never floats where the hill rises under it.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { lumpy } from '../../cave/caveRockVoxels';

export const MOUTH_VOXEL = 0.04;
export const SINK = 8; // voxels of it below the ground (y SINK the ground's level at the mouth)
const HIGH = 46; // over the ground, at most
export const MOUTH_GRID: [number, number, number] = [75, SINK + HIGH, 75];

const ENTRIES = {
  rock: 0x7a7068,
  rockDark: 0x5e564f,
  rockLight: 0x948a7f,
  strata: 0x8c7e68,
  lichen: 0xb4b08a,
  grass: 0x6a8a3a,
  grassLight: 0x7e9e44,
  moss: 0x587434,
  earth: 0x5a4636,
  shade: 0x2e2722,
  deep: 0x15110e,
  dark: 0x060504,
} as const;
export const MOUTH_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

const [W, H, D] = MOUTH_GRID;
const MID = (W - 1) / 2;
const FRONT = D - 1;
const ARCH_HIGH = 21; // the mouth's crown over the ground
const ARCH_HALF = 10; // its half-width at the ground
const DEEP = 26; // voxels it runs back into the rock
const STEEP = 3.2; // how squarely each mass stands up (2: round; more: its sides steep, keeping its footprint as it rises, so it still fills the
// ground it's blocked on where the hill behind it rises: caves/caves.ts)

// The masses it's piled from: centre (u, over the ground, v) and radii; each a lump of rock.
interface Mass {
  c: [number, number, number];
  r: [number, number, number];
}
const masses = (variant: number): Mass[] => {
  const k = (n: number) => (hashUnit(variant, n, 930) - 0.5) * 6; // (each look its own)
  return [
    { c: [MID + k(1) * 0.3, 0, 35], r: [35, 38 + k(2), 34] }, // the crag at the back, broad (filling the ground it's blocked on)
    { c: [14 + k(3), 0, 54], r: [13, 25 + k(4), 16] }, // the boulders shouldering the mouth
    { c: [60 + k(5), 0, 54], r: [13, 23 + k(6), 16] },
    { c: [MID, 27, 57], r: [23, 6.5, 12] }, // the lintel, laid across them
    { c: [10, 0, 10 + k(7) * 0.3], r: [11, 15, 11] }, // and rocks tumbled into its back corners
    { c: [64, 0, 10 + k(8) * 0.3], r: [11, 17, 11] },
    { c: [7, 0, 64], r: [8, 10, 9] }, // and its front ones, well aside of the mouth (nothing before it)
    { c: [67, 0, 64], r: [8, 11, 9] },
  ];
};

// The mouth: an arch under the lintel, narrowing a little as it goes in (u across, y over the ground, v along).
const inMouth = (u: number, y: number, v: number) => {
  const deepIn = FRONT - v;
  if (deepIn >= DEEP || y < 1 || y >= ARCH_HIGH) return false; // (over its own floor, a voxel up: never level with the ground's grass)
  const half = ARCH_HALF * Math.sqrt(1 - (y / ARCH_HIGH) ** 2.4) - Math.max(0, deepIn - 14) * 0.35 + (hashUnit(y, v >> 2, 931) - 0.5) * 1.4;
  return Math.abs(u - MID) <= half;
};

export function buildCaveMouth(variant: number): VoxelGrid {
  const g = createGrid(MOUTH_GRID);
  const all = masses(variant);
  // Rock wherever any mass reaches (its surface knocked about); the mouth cut into it, and only into it (never out
  // past its face), over a floor of its own rock (the ground's grass never showing within).
  const solid = new Uint8Array(W * H * D);
  const carved = new Uint8Array(W * H * D);
  const at = (u: number, y: number, v: number) => u + W * (y + H * v);
  for (let u = 0; u < W; u++) for (let v = 0; v < D; v++) for (let y = 0; y < H; y++) {
    const over = y - SINK;
    const rough = (lumpy(u + y * 0.7, v + y * 0.4, 932 + variant, 5) - 0.5) * 0.32;
    if (!all.some((m) => Math.abs((u - m.c[0]) / m.r[0]) ** STEEP + Math.abs((v - m.c[2]) / m.r[2]) ** STEEP + ((over - m.c[1]) / m.r[1]) ** 2 <= 1 + rough)) continue;
    if (inMouth(u, over, v)) carved[at(u, y, v)] = 1;
    else solid[at(u, y, v)] = 1;
  }
  for (let u = 0; u < W; u++) for (let v = 0; v < D; v++) {
    if (carved[at(u, SINK + 1, v)]) solid[at(u, SINK, v)] = 1; // (its floor)
    else if (inMouth(u, 1, v)) for (let y = SINK; y < SINK + 4; y++) solid[at(u, y, v)] = 0; // (and before it, nothing: no lip of rock left on the ground)
  }
  const rock = (u: number, y: number, v: number) => u >= 0 && v >= 0 && y >= 0 && u < W && v < D && y < H && solid[at(u, y, v)] === 1;
  const mouthAir = (u: number, y: number, v: number) => u >= 0 && v >= 0 && y >= 0 && u < W && v < D && y < H && carved[at(u, y, v)] === 1;
  const openAir = (u: number, y: number, v: number) => y >= SINK && !rock(u, y, v) && !mouthAir(u, y, v); // (under the ground's level: earth, not air)
  // Each column's top (for how steep it is there: grass only on the gentler tops).
  const tops = new Int16Array(W * D).fill(-1);
  for (let u = 0; u < W; u++) for (let v = 0; v < D; v++) for (let y = H - 1; y >= 0; y--) if (rock(u, y, v)) {
    tops[u + W * v] = y;
    break;
  }
  const topAt = (u: number, v: number) => (u < 0 || v < 0 || u >= W || v >= D ? -1 : tops[u + W * v]);
  const steep = (u: number, v: number) => Math.abs(topAt(u + 1, v) - topAt(u - 1, v)) + Math.abs(topAt(u, v + 1) - topAt(u, v - 1)) > 4;
  const SIDES = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]];
  for (let u = 0; u < W; u++) for (let v = 0; v < D; v++) for (let y = 0; y < H; y++) {
    if (!rock(u, y, v)) continue;
    const toOpen = SIDES.some(([du, dy, dv]) => openAir(u + du, y + dy, v + dv));
    const toMouth = SIDES.some(([du, dy, dv]) => mouthAir(u + du, y + dy, v + dv));
    if (!toOpen && !toMouth) {
      setColor(g, u, y, v, C.rockDark); // (within: never seen)
      continue;
    }
    const over = y - SINK;
    let color: number;
    if (toMouth && !toOpen) {
      // Facing into the mouth only: dark, its floor a shade less (so it reads as going in, not a painted hole).
      color = mouthAir(u, y + 1, v) ? C.deep : C.dark;
    } else if (toMouth) color = C.shade; // its rim
    else if (openAir(u, y + 1, v) && over > 1) {
      // A top, facing up: grass in patches, bare rock and moss between.
      const patch = lumpy(u, v, 933 + variant, 6);
      const tone = hashUnit(u, v, 934);
      if (steep(u, v) || patch < 0.32) color = tone < 0.2 ? C.moss : tone < 0.3 ? C.lichen : tone < 0.7 ? C.rockLight : C.rock; // (bare stone where it's steep, and in patches)
      else color = patch > 0.64 ? C.grassLight : C.grass;
    } else {
      // A side: grass draping a voxel over the edge of the top above; else the stone.
      const top = rock(u, y + 1, v) && openAir(u, y + 2, v) && lumpy(u, v, 933 + variant, 6) >= 0.32 && !steep(u, v);
      const tone = lumpy(u + y * 0.5, v - y * 0.5, 935 + variant, 4);
      const band = (over + Math.round(lumpy(u + v, 0, 936, 9) * 4)) % 9 === 0;
      color = top && hashUnit(u, y, v) < 0.6 ? C.grass : over < 2 ? (tone < 0.5 ? C.earth : C.rockDark) : band ? C.strata : hashUnit(u * 3, y, v * 7) < 0.012 ? C.lichen : tone < 0.33 ? C.rockDark : tone > 0.7 ? C.rockLight : C.rock;
    }
    setColor(g, u, y, v, color);
  }
  return g;
}
