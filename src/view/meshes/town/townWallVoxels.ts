// The town's walls, a tile a piece (town/townPlan.ts), twelve voxels a tile (townPalette.ts): a curtain wall running
// along local X, crenellated, its walk's merlons alternating; a square tower, slits in it, a clay roof coming to a
// point and a pennant; and a gatehouse, its way through along local Z under a pointed arch, its portcullis drawn up
// (its iron teeth showing), its oak doors swung back against the passage, a red banner over it. Its old grey stone
// coursed bigger than the cathedral's, moss along its foot. And the market's stalls: a counter under a striped awning
// on four posts, its keeper's wares on it (wine, cloth, potions, relics), its front local -Z.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import type { StallKind, WallPiece } from '../../../model/town/townPlan';
import { PER_TILE, T } from './townPalette';

const WALL_TOP = 30; // the wall walk's height (two and a half units)
const TOWER_TOP = 46;
const ROOF_TOP = 66;
export const WALL_GRIDS: Record<WallPiece, [number, number, number]> = {
  wall: [PER_TILE, WALL_TOP + 5, PER_TILE],
  tower: [PER_TILE, ROOF_TOP + 8, PER_TILE],
  gate: [PER_TILE, TOWER_TOP + 5, PER_TILE],
};
export const STALL_GRID: [number, number, number] = [PER_TILE, 22, PER_TILE];

const put = (grid: VoxelGrid, x: number, y: number, z: number, color: number) => {
  const [w, h, d] = grid.size;
  if (x >= 0 && y >= 0 && z >= 0 && x < w && y < h && z < d) setColor(grid, x, y, z, color);
};

// Old wall stone: blocks four long, courses three high; moss low down.
function wallStone(x: number, y: number, z: number): number {
  const course = Math.floor(y / 3);
  const h = hashUnit(Math.floor((x + z + (course % 2) * 2) / 4), course, 29);
  if (y <= 3 && h < 0.35) return T.moss;
  return h < 0.6 ? T.wallStone : h < 0.85 ? T.wallDark : T.wallLight;
}

export function buildWallPiece(piece: WallPiece): VoxelGrid {
  const grid = createGrid(WALL_GRIDS[piece]);
  if (piece === 'wall') curtain(grid);
  else if (piece === 'tower') tower(grid);
  else gate(grid);
  return grid;
}

// The curtain: four voxels thick, the merlons on its outer half.
function curtain(grid: VoxelGrid): void {
  fillBox(grid, 0, 0, 4, PER_TILE - 1, WALL_TOP, 7, wallStone);
  fillBox(grid, 0, WALL_TOP, 4, PER_TILE - 1, WALL_TOP, 7, T.wallLight); // (its walk's coping)
  for (let x = 0; x < PER_TILE; x++) if (Math.floor(x / 3) % 2 === 0) fillBox(grid, x, WALL_TOP + 1, 6, x, WALL_TOP + 4, 7, wallStone);
}

function tower(grid: VoxelGrid): void {
  fillBox(grid, 0, 0, 0, PER_TILE - 1, TOWER_TOP, PER_TILE - 1, wallStone);
  for (const y of [18, 32]) for (const [x, z] of [[5, 0], [6, 0], [0, 5], [0, 6], [11, 5], [11, 6], [5, 11], [6, 11]]) for (let dy = 0; dy < 5; dy++) put(grid, x, y + dy, z, T.dark); // (its slits)
  fillBox(grid, 0, TOWER_TOP, 0, PER_TILE - 1, TOWER_TOP, PER_TILE - 1, T.wallLight);
  for (let y = TOWER_TOP + 1; y <= ROOF_TOP; y++) {
    const r = Math.round(((ROOF_TOP - y) / (ROOF_TOP - TOWER_TOP)) * 6.5);
    for (let x = 6 - r; x < 6 + r; x++) {
      for (let z = 6 - r; z < 6 + r; z++) {
        const edge = Math.max(Math.abs(x + 0.5 - 6), Math.abs(z + 0.5 - 6)) > r - 1.5;
        if (edge) put(grid, x, y, z, y === TOWER_TOP + 1 ? T.clayDark : (x + z + y) % 5 === 0 ? T.clayLight : (y >> 1) % 2 ? T.clay : T.clayDark);
      }
    }
  }
  fillBox(grid, 5, ROOF_TOP + 1, 5, 5, ROOF_TOP + 7, 5, T.iron); // (its pennant's staff)
  fillBox(grid, 6, ROOF_TOP + 4, 5, 8, ROOF_TOP + 6, 5, T.banner);
  put(grid, 9, ROOF_TOP + 5, 5, T.banner);
}

// The gatehouse: its two sides either side of the way through (local Z), joined over it by the arch and the chamber
// above, its battlements over all.
function gate(grid: VoxelGrid): void {
  const top = TOWER_TOP - 4;
  fillBox(grid, 0, 0, 0, PER_TILE - 1, top, PER_TILE - 1, wallStone);
  for (let x = 2; x <= 9; x++) {
    const u = Math.abs(x + 0.5 - 6);
    const crown = 24 + Math.round(Math.sqrt(Math.max(0, 16 - u * u)) * 1.4); // (a pointed arch: its crown over the middle)
    for (let y = 0; y <= crown; y++) fillBox(grid, x, y, 0, x, y, PER_TILE - 1, 0);
    put(grid, x, crown + 1, 0, T.wallLight);
    put(grid, x, crown + 1, PER_TILE - 1, T.wallLight);
    for (const y of [crown, crown - 1]) if (x % 2 === 0) put(grid, x, y, 3, T.iron); // (the portcullis's teeth, drawn up)
  }
  for (const x of [2, 9]) fillBox(grid, x, 0, 6, x, 20, 10, (_x, y, z) => (y === 6 || y === 15 ? T.iron : z % 2 ? T.oak : T.oakDark)); // (its doors, swung back)
  fillBox(grid, 0, top, 0, PER_TILE - 1, top, PER_TILE - 1, T.wallLight);
  for (let x = 0; x < PER_TILE; x++) {
    for (const z of [0, PER_TILE - 1]) if (Math.floor(x / 3) % 2 === 0) fillBox(grid, x, top + 1, z, x, top + 4, z, wallStone);
  }
  fillBox(grid, 4, top - 14, 0, 7, top - 3, 0, (_x, y) => (y === top - 3 ? T.iron : T.banner)); // (the banner, out over the road)
  fillBox(grid, 5, top - 10, 0, 6, top - 6, 0, T.bannerGold);
}

// A market stall: a counter at its front, posts at its corners, a striped awning sloping back, the wares out on it.
export function buildStall(kind: StallKind): VoxelGrid {
  const grid = createGrid(STALL_GRID);
  for (const [x, z] of [[1, 1], [10, 1], [1, 10], [10, 10]]) fillBox(grid, x, 0, z, x, z === 1 ? 16 : 18, z, T.timber);
  fillBox(grid, 1, 7, 1, 10, 7, 4, T.timberLight); // (the counter's top)
  fillBox(grid, 1, 0, 1, 10, 6, 1, (x, y) => (y === 6 ? T.timberLight : x % 3 === 0 ? T.timber : T.timberLight)); // (its front)
  const stripe = kind === 'relics' ? T.bannerGold : kind === 'wine' ? T.banner : kind === 'cloth' ? T.clothBlue : T.clothOchre;
  for (let z = 0; z < PER_TILE; z++) {
    const y = 17 + Math.round(z / 5);
    fillBox(grid, 0, y, z, PER_TILE - 1, y, z, (x) => (Math.floor(x / 2) % 2 ? stripe : T.canvas));
  }
  for (let x = 0; x < PER_TILE; x++) put(grid, x, 16, 0, Math.floor(x / 2) % 2 ? stripe : T.canvas); // (its valance)
  wares(grid, kind);
  return grid;
}

function wares(grid: VoxelGrid, kind: StallKind): void {
  const on = 8; // (the counter's top, plus one)
  if (kind === 'wine') {
    for (const x of [2, 4, 6, 8]) fillBox(grid, x, on, 2, x, on + 2, 2, x % 4 ? T.bottle : T.wine);
    fillBox(grid, 2, 0, 6, 5, 4, 9, (_x, y) => (y === 1 || y === 3 ? T.iron : T.oak)); // (a cask behind)
  } else if (kind === 'cloth') {
    for (const [x, c] of [[2, T.clothBlue], [5, T.clothOchre], [8, T.banner]] as const) fillBox(grid, x, on, 2, x + 1, on + 1, 3, c);
    fillBox(grid, 2, 10, 9, 9, 14, 9, (x) => (x % 2 ? T.clothBlue : T.canvas)); // (a length hung at the back)
  } else if (kind === 'potions') {
    for (const [x, c] of [[2, T.glassRed], [4, T.glassBlue], [6, T.glassGreen], [8, T.glassGold]] as const) {
      fillBox(grid, x, on, 2, x + 1, on + 1, 3, c); // (a flask)
      put(grid, x, on + 2, 2, T.wax); // (its stopper)
    }
    fillBox(grid, 3, 10, 9, 8, 13, 9, (x, y) => (y === 10 || y === 13 ? T.timber : x % 2 ? T.bottle : T.wine)); // (a shelf of them behind)
  } else {
    fillBox(grid, 2, on, 2, 4, on + 1, 3, T.gold); // (a gilt box, bones in it)
    put(grid, 3, on + 2, 2, T.bone);
    fillBox(grid, 6, on, 2, 7, on, 3, T.bone); // (a jawbone, a finger)
    fillBox(grid, 8, on, 2, 9, on + 2, 2, T.oak); // (a little reliquary)
    put(grid, 8, on + 3, 2, T.gold);
  }
}
