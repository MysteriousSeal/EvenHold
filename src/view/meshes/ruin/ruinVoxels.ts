// The ruins' pieces (model/ruins/ruins.ts) at the world's 0.04 voxel scale,
// each one tile (25 x 25 voxels), drawn facing local +Z (the ruin's middle),
// a wall along its -Z edge. Palette first: four stone tones (the deepest the
// mortar and the shade), moss and ivy, grass in the cracks, bare dirt, a
// candle's wax. Each piece in four variants (how broken, how overgrown), from
// `variant`: no two stretches of wall alike.

import type { RuinKind } from '../../../model/ruins/ruins';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';

export const RUIN_VOXEL_SIZE = 0.04;
export const RUIN_GRID: [number, number, number] = [25, 40, 25];

const ENTRIES = {
  stoneLight: 0xbdb6a6,
  stone: 0x9d968a,
  stoneDark: 0x7b766c,
  mortar: 0x5a564e,
  moss: 0x78913f,
  mossDark: 0x55702c,
  ivy: 0x3e6c30,
  ivyLight: 0x62994a,
  grass: 0x7aa84a,
  dirt: 0x6b5a44,
  wax: 0xe6dcc2,
  slit: 0x2a2724,
  dark: 0x0b0a09, // the dark a way down goes into
  iron: 0x45403c,
  rust: 0x8a4a2a,
  rustDark: 0x5e3420,
} as const;

export const RUIN_PALETTE: number[] = Object.values(ENTRIES);
export const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

const WALL = 7; // a wall's thickness, from the tile's -Z edge
const HIGH = [30, 27, 24, 21]; // a whole wall's height, by variant

// Coursed stone: blocks 6 long and 4 high, their joints staggered each course, the tones varied block by block.
export function block(u: number, y: number, v: number, salt: number): number {
  if (y % 4 === 0) return C.mortar;
  const course = Math.floor(y / 4);
  const along = u + (course % 2) * 3;
  if (along % 6 === 0) return C.mortar;
  const pick = hashUnit(Math.floor(along / 6) * 7 + v, course, salt) * 3;
  return pick < 1 ? C.stone : pick < 2 ? C.stoneDark : C.stoneLight;
}

// Moss on what's on top and at the foot, ivy creeping up a face in a patch or two.
export const overgrown = (u: number, y: number, top: number, variant: number, salt: number) =>
  y === top && hashUnit(u, variant, salt) < 0.45 + variant * 0.12 ? (hashUnit(u, y, salt) < 0.5 ? C.moss : C.mossDark) : y <= 1 && hashUnit(u, variant, salt + 1) < 0.35 ? C.moss : 0;
export const ivyAt = (u: number, y: number, variant: number, salt: number) => {
  const patch = Math.floor(u / 5);
  if (hashUnit(patch, variant, salt + 3) > 0.35 + variant * 0.1) return 0;
  const reach = 6 + Math.floor(hashUnit(patch, variant, salt + 4) * 14);
  return y < reach && hashUnit(u, y, salt + 5) < 0.7 ? (hashUnit(u, y, salt + 6) < 0.5 ? C.ivy : C.ivyLight) : 0;
};

// A stretch of wall along the -Z edge, from `from` to `to` across, its top at
// `top(u)`, the side toward +Z (the ruin's middle) with its ivy.
function wall(grid: VoxelGrid, variant: number, top: (u: number) => number, salt: number, v0 = 0, v1 = WALL - 1, u0 = 0, u1 = 24): void {
  for (let u = u0; u <= u1; u++) {
    const t = Math.max(0, top(u));
    for (let y = 0; y <= t; y++) {
      for (let v = v0; v <= v1; v++) {
        const green = overgrown(u, y, t, variant, salt) || (v === v1 ? ivyAt(u, y, variant, salt) : 0);
        fillBox(grid, u, y, v, u, y, v, green || block(u, y, v, salt));
      }
    }
  }
}

// A ragged top: the whole height, less a few blocks' worth here and there.
const ragged = (high: number, variant: number, salt: number, deep = 4) => (u: number) => high - Math.floor(hashUnit(Math.floor(u / 3), variant, salt) * deep);

const BUILD: Record<RuinKind, (variant: number) => VoxelGrid> = {
  wall: (variant) => {
    const grid = createGrid(RUIN_GRID);
    wall(grid, variant, ragged(HIGH[variant], variant, 11), 11);
    return grid;
  },
  // Broken down to a jagged stump, blocks fallen at its foot.
  wallBroken: (variant) => {
    const grid = createGrid(RUIN_GRID);
    wall(grid, variant, (u) => 5 + Math.floor(hashUnit(Math.floor(u / 3), variant, 21) * (8 + variant * 3)), 21);
    for (let i = 0; i < 3 + variant; i++) {
      const u = Math.floor(hashUnit(i, variant, 22) * 20);
      const v = WALL + 1 + Math.floor(hashUnit(i, variant, 23) * 8);
      fillBox(grid, u, 0, v, u + 2, 1 + (i % 2), v + 2, (x, y) => (y === 1 + (i % 2) && hashUnit(x, i, 24) < 0.4 ? C.moss : i % 3 === 0 ? C.stoneDark : C.stone));
    }
    return grid;
  },
  // A whole wall with an arched window through it, its keystone lit, a sill.
  arch: (variant) => {
    const grid = createGrid(RUIN_GRID);
    wall(grid, variant, ragged(HIGH[variant], variant, 31, 3), 31);
    const [cx, sill, spring, r] = [12, 8, 16, 4];
    for (let u = cx - r; u <= cx + r; u++) for (let y = sill; y <= spring + r; y++) {
      if (y <= spring || (u - cx) ** 2 + (y - spring) ** 2 <= r * r) fillBox(grid, u, y, 0, u, y, WALL - 1, 0); // the window, cut through
    }
    fillBox(grid, cx - r - 1, sill - 1, 0, cx + r + 1, sill - 1, WALL, C.stoneLight); // the sill, jutting
    fillBox(grid, cx - 1, spring + r + 1, 0, cx + 1, spring + r + 2, WALL - 1, C.stoneLight); // the keystone
    return grid;
  },
  // Where two walls met: an L along the -Z and -X edges.
  corner: (variant) => {
    const grid = createGrid(RUIN_GRID);
    const top = ragged(HIGH[variant] + 2, variant, 41);
    wall(grid, variant, top, 41);
    for (let v = 0; v <= 24; v++) {
      const t = top(v + 50);
      for (let y = 0; y <= t; y++) for (let u = 0; u < WALL; u++) fillBox(grid, u, y, v, u, y, v, overgrown(v, y, t, variant, 42) || block(v, y, u, 42));
    }
    return grid;
  },
  // A tower's stump: round (stepped), thick, a dark arrow slit toward the
  // middle, what's left of its battlements gapped along the top.
  tower: (variant) => {
    const grid = createGrid(RUIN_GRID);
    const high = 32 + variant * 2;
    for (let u = 1; u <= 23; u++) {
      for (let v = 1; v <= 23; v++) {
        const d = Math.hypot(u - 12, v - 12);
        if (d > 11.5) continue;
        const rim = d > 8.5;
        const merlon = rim && Math.floor(Math.atan2(v - 12, u - 12) * 4) % 2 === 0 && hashUnit(u, v, variant + 51) < 0.7;
        const top = rim ? high + (merlon ? 3 : 0) - Math.floor(hashUnit(Math.floor(u / 4), Math.floor(v / 4), variant + 52) * 3) : high - 1;
        for (let y = 0; y <= top; y++) fillBox(grid, u, y, v, u, y, v, overgrown(u + v * 25, y, top, variant, 53) || block(u + v, y, u * v, 53));
      }
    }
    fillBox(grid, 12, 12, 23, 12, 20, 23, C.slit); // the arrow slit, facing the middle
    return grid;
  },
  // A thinner wall standing across the inside, in the tile's middle.
  innerWall: (variant) => {
    const grid = createGrid(RUIN_GRID);
    wall(grid, variant, ragged(16 + variant * 2, variant, 61, 6), 61, 10, 14);
    return grid;
  },
  // A column: a stepped base, a fluted shaft, a capital.
  column: (variant) => {
    const grid = createGrid(RUIN_GRID);
    columnBase(grid);
    const top = 28 + variant;
    shaft(grid, 3, top, variant, 71);
    fillBox(grid, 8, top + 1, 8, 16, top + 2, 16, (u, y, v) => (y === top + 2 ? (hashUnit(u, v, variant + 72) < 0.25 + variant * 0.1 ? C.moss : C.stoneLight) : C.stone)); // the capital
    return grid;
  },
  // A column snapped off, its stump jagged.
  columnBroken: (variant) => {
    const grid = createGrid(RUIN_GRID);
    columnBase(grid);
    const high = 8 + variant * 3;
    for (let u = 10; u <= 14; u++) for (let v = 10; v <= 14; v++) {
      const top = high - Math.floor(hashUnit(u, v, variant + 81) * 5);
      for (let y = 3; y <= top; y++) fillBox(grid, u, y, v, u, y, v, y === top ? C.stoneLight : (u === 10 || u === 14) && (v === 10 || v === 14) ? C.stoneDark : C.stone);
    }
    return grid;
  },
  // A fallen column: its drums lying in a row, a little apart, along X.
  columnFallen: (variant) => {
    const grid = createGrid(RUIN_GRID);
    for (const [u0, u1] of [[1, 7], [9, 15], [17, 23]]) {
      const lean = Math.floor(hashUnit(u0, variant, 91) * 3) - 1;
      for (let u = u0; u <= u1; u++) for (let y = 0; y <= 6; y++) for (let v = 9; v <= 15; v++) {
        if ((y - 3) ** 2 + (v - 12 - lean) ** 2 > 10) continue;
        fillBox(grid, u, y, v, u, y, v, y === 6 && hashUnit(u, v, variant + 92) < 0.4 ? C.moss : u === u0 || u === u1 ? C.stoneDark : y >= 5 ? C.stoneLight : C.stone);
      }
    }
    return grid;
  },
  // An altar: a carved block under a cracked slab, a candle stub on it.
  altar: (variant) => {
    const grid = createGrid(RUIN_GRID);
    fillBox(grid, 5, 0, 8, 19, 9, 16, (u, y, v) => (v === 16 && y >= 3 && y <= 7 && u >= 8 && u <= 16 ? (u === 8 || u === 16 || y === 3 || y === 7 ? C.stoneDark : C.stone) : y === 0 ? C.stoneDark : C.stone));
    fillBox(grid, 4, 10, 7, 20, 11, 17, (u, y, v) => (y === 11 && Math.abs(u - 12 - (v - 12)) === variant ? C.mortar : y === 11 ? (hashUnit(u, v, 101) < 0.2 ? C.moss : C.stoneLight) : C.stone)); // the slab, cracked
    fillBox(grid, 7, 12, 11, 8, 13 + variant % 2, 12, C.wax); // a candle stub
    return grid;
  },
  // A heap of fallen blocks, stepped, mismatched, mossed on top.
  rubble: (variant) => {
    const grid = createGrid(RUIN_GRID);
    for (let u = 2; u <= 22; u += 2) for (let v = 2; v <= 22; v += 2) {
      const d = Math.hypot(u - 12, v - 12);
      const h = Math.floor(8 - d * 0.8 + hashUnit(u, v, variant + 111) * 3);
      if (h < 0) continue;
      const tone = [C.stone, C.stoneDark, C.stoneLight][Math.floor(hashUnit(u, v, variant + 112) * 3)];
      fillBox(grid, u, 0, v, u + 1, h, v + 1, (_x, y) => (y === h && hashUnit(u, v, variant + 113) < 0.35 ? C.moss : tone));
    }
    return grid;
  },
  // Flagstones, cracked, grass in the joints, some gone to dirt.
  floor: (variant) => {
    const grid = createGrid(RUIN_GRID);
    fillBox(grid, 0, 0, 0, 24, 0, 24, (u, _y, v) => {
      const [su, sv] = [Math.floor(u / 6), Math.floor(v / 6)];
      if (u % 6 === 0 || v % 6 === 0) return hashUnit(u, v, variant + 121) < 0.6 ? C.grass : 0; // the joints, grassed (or bare ground showing)
      const gone = hashUnit(su, sv, variant + 122);
      if (gone < 0.15) return hashUnit(u, v, 123) < 0.5 ? C.dirt : C.grass;
      if ((u + v * 2 + variant) % 11 === 0) return C.mortar; // a crack
      return gone < 0.5 ? C.stone : gone < 0.8 ? C.stoneLight : C.stoneDark;
    });
    return grid;
  },
};

function columnBase(grid: VoxelGrid): void {
  fillBox(grid, 7, 0, 7, 17, 1, 17, (_u, y) => (y === 1 ? C.stoneLight : C.stoneDark));
  fillBox(grid, 8, 2, 8, 16, 2, 16, C.stone);
}

function shaft(grid: VoxelGrid, from: number, to: number, variant: number, salt: number): void {
  for (let y = from; y <= to; y++) for (let u = 10; u <= 14; u++) for (let v = 10; v <= 14; v++) {
    const edge = u === 10 || u === 14 || v === 10 || v === 14;
    const flute = edge && (u + v) % 2 === 0; // fluted, the grooves in shade
    fillBox(grid, u, y, v, u, y, v, edge && ivyAt(u + v, y, variant, salt) ? C.ivy : flute ? C.stoneDark : C.stone);
  }
}

export function buildRuinPiece(kind: RuinKind, variant: number): VoxelGrid {
  return BUILD[kind](variant % 4);
}
