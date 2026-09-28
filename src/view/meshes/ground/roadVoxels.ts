// Voxel road tiles, at the world's 0.04 voxel scale: 25x25
// voxels span exactly one tile. Palette first, then shape:
// - Road tiles: a dirt band two voxels thick (the cross of center + arms
//   toward connected neighbors), two wheel ruts carved a voxel deeper and
//   darker, a few raised pebbles, and edges that fray into the grass.
// - Where the road runs onto a neighbor one tier lower, it steps down the
//   drop as a short dirt staircase built out over the lower tile, instead
//   of ending at the cliff edge above it.
// A tile's look depends only on its connections and a variant number, so
// each distinct tile is built and meshed once, then instanced.

import { NEIGHBORS_4 } from '../../../model/grid';
import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const ROAD_VOXEL_SIZE = 0.04;
const N = 25; // voxels per tile edge
const MID = 12; // center voxel
const HALF_BAND = 6; // band = 13 voxels (~0.5 wide)
const RUT = 3; // ruts sit 3 voxels either side of the center line
export const ROAD_TILE_GRID: [number, number, number] = [N, 3, N];
// Staircase down one tier (0.15 = ~4 voxels): 4 steps out over the lower
// tile, each one voxel lower, so a drop tile's grid gets this much padding
// around and below the tile.
const STEPS = 4;
const STEP_PAD = STEPS;
const STEP_TOP = 1; // the first step is flush with the road surface (rows 0..1)

// Palette (index + 1 is stored in the grid; 0 = empty).
export const ROAD_PALETTE = [
  0xb08c5e, // 1 dirt
  0xc2a071, // 2 dirt, lighter speck
  0x8f7048, // 3 dirt, darker edge / speck
  0x7a5f40, // 4 rut floor
  0xcbbfa7, // 5 pebble
];
const DIRT = 1;
const DIRT_LIGHT = 2;
const DIRT_DARK = 3;
const RUT_FLOOR = 4;
const PEBBLE = 5;

// Arms in NEIGHBORS_4 order (+x, -x, +z, -z), as bits of a connection mask.
const [EAST, WEST, SOUTH, NORTH] = [0, 1, 2, 3];
const OPPOSITE = [WEST, EAST, NORTH, SOUTH];
const PERPENDICULAR = [
  [SOUTH, NORTH],
  [SOUTH, NORTH],
  [EAST, WEST],
  [EAST, WEST],
];

const has = (mask: number, arm: number) => (mask & (1 << arm)) !== 0;

// Voxel (i, k) at `along` voxels out from the center along an arm, and
// `lateral` voxels to the side (+ toward +x / +z).
function armVoxel(arm: number, along: number, lateral: number): [number, number] {
  const [dx, dz] = NEIGHBORS_4[arm];
  return dx !== 0 ? [MID + dx * along, MID + lateral] : [MID + lateral, MID + dz * along];
}

function inBand(mask: number, i: number, k: number): boolean {
  const di = i - MID;
  const dk = k - MID;
  if (Math.abs(di) <= HALF_BAND && Math.abs(dk) <= HALF_BAND) return true;
  return (
    (has(mask, EAST) && di > 0 && Math.abs(dk) <= HALF_BAND) ||
    (has(mask, WEST) && di < 0 && Math.abs(dk) <= HALF_BAND) ||
    (has(mask, SOUTH) && dk > 0 && Math.abs(di) <= HALF_BAND) ||
    (has(mask, NORTH) && dk < 0 && Math.abs(di) <= HALF_BAND)
  );
}

// Rut voxels. Each arm's two ruts run from the tile edge inward; where they
// start depends on the other arms:
// - straight through (opposite arm): from the center, joining it seamlessly;
// - T-junction (both perpendicular arms): at the nearer through-rut;
// - corner (one perpendicular arm): the inner rut stops early and the
//   outer one late, so the two arms' ruts meet as two nested L-shapes;
// - dead end: both run past the center and are joined into a U.
function rutVoxels(mask: number): Array<[number, number]> {
  const ruts: Array<[number, number]> = [];
  for (let arm = 0; arm < 4; arm++) {
    if (!has(mask, arm)) continue;
    const [p1, p2] = PERPENDICULAR[arm];
    const perpendiculars = [p1, p2].filter((p) => has(mask, p));

    for (const side of [-RUT, RUT]) {
      let start: number;
      if (has(mask, OPPOSITE[arm])) start = 0;
      else if (perpendiculars.length === 2) start = RUT;
      else if (perpendiculars.length === 1) {
        const [pdx, pdz] = NEIGHBORS_4[perpendiculars[0]];
        const towardPerpendicular = Math.sign(side) === pdx + pdz; // perpendicular arm's own axis sign
        start = towardPerpendicular ? RUT : -RUT;
      } else start = -RUT;

      for (let along = start; along <= MID; along++) ruts.push(armVoxel(arm, along, side));
    }
    if (perpendiculars.length === 0 && !has(mask, OPPOSITE[arm])) {
      for (let lateral = -RUT; lateral <= RUT; lateral++) ruts.push(armVoxel(arm, -RUT, lateral)); // U-turn
    }
  }
  return ruts;
}

// Where a road tile's voxel grid starts, relative to the tile's top
// surface corner: tiles with drops are padded out and down for the stairs.
export function roadTileOffset(drops: number): { side: number; below: number } {
  return drops ? { side: STEP_PAD, below: STEP_PAD } : { side: 0, below: 0 };
}

// `drops` has a bit set (NEIGHBORS_4 order, like `mask`) per connected
// neighbor one tier lower.
export function buildRoadTile(mask: number, variant: number, drops = 0): VoxelGrid {
  const { side, below } = roadTileOffset(drops);
  const grid = createGrid([N + 2 * side, ROAD_TILE_GRID[1] + below, N + 2 * side]);
  // Tile-local coordinates: (0, 0, 0) is the tile's corner voxel on its top surface.
  const set = (i: number, j: number, k: number, color: number) => setColor(grid, i + side, j + below, k + side, color);
  const get = (i: number, j: number, k: number) => colorAt(grid, i + side, j + below, k + side);
  const rng = mulberry32(0x70ad + mask * 131 + variant * 7919);

  // Dirt band, two voxels thick, with a light sprinkle of lighter/darker specks.
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < N; k++) {
      if (!inBand(mask, i, k)) continue;
      set(i, 0, k, DIRT);
      const roll = rng();
      set(i, 1, k, roll < 0.05 ? DIRT_LIGHT : roll < 0.08 ? DIRT_DARK : DIRT);
    }
  }

  // Frayed edges: band-edge voxels sometimes lose their top layer (showing
  // the darker packed earth below), and a few loose clods spill onto the
  // grass just outside. Edges only run along the road's sides, never across
  // a tile boundary the road continues through, so tiles join seamlessly.
  const edge = (i: number, k: number) =>
    inBand(mask, i, k) && NEIGHBORS_4.some(([dx, dz]) => !inBand(mask, i + dx, k + dz));
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < N; k++) {
      if (edge(i, k) && rng() < 0.45) {
        set(i, 1, k, 0);
        set(i, 0, k, DIRT_DARK);
      } else if (!inBand(mask, i, k) && NEIGHBORS_4.some(([dx, dz]) => inBand(mask, i + dx, k + dz)) && rng() < 0.25) {
        set(i, 0, k, DIRT_DARK);
      }
    }
  }

  // Ruts: carved one voxel down, darker floor.
  for (const [i, k] of rutVoxels(mask)) {
    if (i < 0 || k < 0 || i >= N || k >= N) continue;
    set(i, 1, k, 0);
    set(i, 0, k, RUT_FLOOR);
  }

  // A few pebbles sitting on the dirt (not in the ruts).
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < N; k++) {
      if (get(i, 1, k) !== 0 && rng() < 0.025) set(i, 2, k, PEBBLE);
    }
  }

  for (let arm = 0; arm < 4; arm++) if (has(drops, arm)) addStairs(set, arm);
  return grid;
}

// Steps out past the tile edge toward a lower neighbor: each column reaches
// down to the lower tile's ground and is one voxel shorter than the last.
// Treads are dirt, risers darker.
function addStairs(set: (i: number, j: number, k: number, color: number) => void, arm: number): void {
  for (let step = 1; step <= STEPS; step++) {
    const top = STEP_TOP - (step - 1);
    for (let lateral = -HALF_BAND; lateral <= HALF_BAND; lateral++) {
      const [i, k] = armVoxel(arm, MID + step, lateral);
      // Ruts stay carved a voxel into each tread, continuing the road's grooves.
      const rut = Math.abs(lateral) === RUT;
      const tread = rut ? top - 1 : top;
      for (let j = -STEP_PAD; j < tread; j++) set(i, j, k, DIRT_DARK);
      set(i, tread, k, rut ? RUT_FLOOR : DIRT);
    }
  }
}
