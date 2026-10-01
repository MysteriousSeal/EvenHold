// The ruins' pieces (model/ruins/ruins.ts) at the world's 0.04 voxel scale,
// each one tile (25 x 25 voxels), drawn facing local +Z (the ruin's middle),
// a wall along its -Z edge. Palette first: four stone tones (the deepest the
// mortar and the shade), moss and ivy, grass in the cracks, bare dirt, a
// candle's wax; rusted iron, and the dark a crypt's way down goes into. Each
// piece in four variants (how broken, how overgrown), from `variant`: no two
// stretches of wall alike. The walls in ruinWallVoxels.ts (their ashlar the
// crypts' tombs' too: cryptStairsVoxels.ts), the floor in ruinFloorVoxels.ts,
// the towers in ruinTowerVoxels.ts, the columns in ruinColumnVoxels.ts.

import type { RuinKind } from '../../../model/ruins/ruins';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { WALL, ashlarWall, crenellated } from './ruinWallVoxels';
import { ruinFloor } from './ruinFloorVoxels';
import { ruinTower } from './ruinTowerVoxels';
import { columnBroken, columnFallen, columnStanding } from './ruinColumnVoxels';

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

const HIGH = [30, 27, 24, 21]; // a whole wall's height, by variant

const BUILD: Record<RuinKind, (variant: number) => VoxelGrid> = {
  wall: (variant) => {
    const grid = createGrid(RUIN_GRID);
    ashlarWall(grid, variant, crenellated(HIGH[variant], variant, 11), 11);
    return grid;
  },
  // Broken down to a jagged stump, blocks fallen at its foot.
  wallBroken: (variant) => {
    const grid = createGrid(RUIN_GRID);
    ashlarWall(grid, variant, (u) => 6 + Math.floor(hashUnit(Math.floor(u / 3), variant, 21) * (8 + variant * 3)), 21);
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
    ashlarWall(grid, variant, crenellated(HIGH[variant], variant, 31), 31);
    const [cx, sill, spring, r] = [12, 8, 16, 4];
    for (let u = cx - r; u <= cx + r; u++) for (let y = sill; y <= spring + r; y++) {
      if (y <= spring || (u - cx) ** 2 + (y - spring) ** 2 <= r * r) fillBox(grid, u, y, 0, u, y, WALL - 1, 0); // the window, cut through
    }
    fillBox(grid, cx - r - 1, sill - 1, 0, cx + r + 1, sill - 1, WALL, C.stoneLight); // the sill, jutting
    for (let u = cx - r - 1; u <= cx + r + 1; u++) for (let y = spring; y <= spring + r + 1; y++) {
      const d = Math.hypot(u - cx, y - spring);
      if (y > spring && d > r && d <= r + 1.5) fillBox(grid, u, y, 0, u, y, WALL - 1, (u + y) % 3 === 0 ? C.mortar : C.stoneLight); // its ring of wedge stones
    }
    fillBox(grid, cx - 1, spring + r + 1, 0, cx + 1, spring + r + 3, WALL, C.stoneLight); // the keystone, standing out
    return grid;
  },
  // Where two walls met: an L along the -Z and -X edges.
  corner: (variant) => {
    const grid = createGrid(RUIN_GRID);
    ashlarWall(grid, variant, crenellated(HIGH[variant] + 2, variant, 41), 41);
    ashlarWall(grid, variant, crenellated(HIGH[variant] + 2, variant, 42), 42, { alongX: false });
    fillBox(grid, 0, 0, 0, WALL, HIGH[variant] + 5, WALL, (_u, y) => (y === HIGH[variant] + 5 ? C.moss : y % 4 === 0 ? C.mortar : C.stoneLight)); // the corner's pier, standing up over both
    return grid;
  },
  // A tower's stump (ruinTowerVoxels.ts).
  tower: (variant) => ruinTower(variant),

  // A thinner wall standing across the inside, in the tile's middle.
  innerWall: (variant) => {
    const grid = createGrid(RUIN_GRID);
    ashlarWall(grid, variant, (u) => 16 + variant * 2 - Math.floor(hashUnit(Math.floor(u / 3), variant, 61) * 6), 61, { from: 10, deep: 5, inner: true });
    return grid;
  },
  // A column standing, snapped off, or fallen (ruinColumnVoxels.ts).
  column: (variant) => columnStanding(variant),

  columnBroken: (variant) => columnBroken(variant),

  columnFallen: (variant) => columnFallen(variant),

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
  // Flagstones, worn (ruinFloorVoxels.ts).
  floor: (variant) => ruinFloor(variant),
};

export function buildRuinPiece(kind: RuinKind, variant: number): VoxelGrid {
  return BUILD[kind](variant % 4);
}
