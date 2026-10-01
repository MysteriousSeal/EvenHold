// Ruins out in the wilds: the remains of an old keep or a chapel, one to
// every stretch of RUIN_REGION tiles a side (at least one in any world), on
// open, near-level ground away from villages, roads, water and the start.
// Each is laid out from the seed and where it stands, so no two alike, yet
// the same for everyone on that seed: broken outer walls (stumps, arched
// windows, gaps, a way in kept clear), towers or stubs at the corners,
// cracked flagstones, rubble; a chapel's nave between rows of columns (some
// broken, some fallen) up to an altar; a keep's inner wall and a few columns.
// Walls, towers and the altar block their tile; columns and rubble a little;
// the floor and the gaps are there to walk through.

import { hashCell, mulberry32 } from '../../util/random';
import { VILLAGE_OUTER_RADIUS } from '../constants';
import { FACINGS, sideOf, spawnOf, type MapSize } from '../map/grid';
import type { Obstacles } from '../map/obstacles';
import type { Surface, Village } from '../types';

export const RUIN_REGION = 512; // tiles a side of the stretch that has one
const SIZE: [number, number] = [10, 15]; // tiles a side
const CLEAR_OF_VILLAGES = 12; // tiles past a village's edge
const CLEAR_OF_SPAWN = 16;
const TRIES = 300;
const MAX_RISE = 2; // tiers the ground may rise across it (its pieces stand each on its own tile)

export type RuinKind = 'wall' | 'wallBroken' | 'arch' | 'corner' | 'tower' | 'innerWall' | 'column' | 'columnBroken' | 'columnFallen' | 'altar' | 'rubble' | 'floor';

export interface RuinPiece {
  kind: RuinKind;
  x: number; // its tile, in the world
  z: number;
  quarterTurns: number; // a wall's: its face turned toward the ruin's middle; a fallen column's: the way it lies
  variant: number; // 0..3: how it's broken, mossed (its look: ruinVoxels.ts)
}

export interface Ruin {
  x: number; // its first tile (least x, z)
  z: number;
  w: number; // tiles across x
  d: number; // along z
  style: 'keep' | 'chapel';
  way: { x: number; z: number }; // the tile just outside its way in
  pieces: RuinPiece[];
}

export interface RuinWorld {
  seed: number;
  size: MapSize;
  heightMap: number[][];
  surfaceMap: Surface[][];
  villages: readonly Village[];
  isOpenTile(x: number, z: number): boolean;
}

// Where they stand, and how each is laid out.
export function placeRuins(world: RuinWorld): Ruin[] {
  const ruins: Ruin[] = [];
  const regionsX = Math.max(1, Math.round(world.size.width / RUIN_REGION));
  const regionsZ = Math.max(1, Math.round(world.size.depth / RUIN_REGION));
  const spawn = spawnOf(world.size);
  for (let gx = 0; gx < regionsX; gx++) {
    for (let gz = 0; gz < regionsZ; gz++) {
      const rng = mulberry32(hashCell(gx, gz, world.seed + 6151));
      const [x0, z0] = [Math.floor((gx * world.size.width) / regionsX), Math.floor((gz * world.size.depth) / regionsZ)];
      const [x1, z1] = [Math.floor(((gx + 1) * world.size.width) / regionsX), Math.floor(((gz + 1) * world.size.depth) / regionsZ)];
      for (let t = 0; t < TRIES; t++) {
        const w = SIZE[0] + Math.floor(rng() * (SIZE[1] - SIZE[0] + 1));
        const d = SIZE[0] + Math.floor(rng() * (SIZE[1] - SIZE[0] + 1));
        const x = x0 + 2 + Math.floor(rng() * Math.max(1, x1 - x0 - w - 4));
        const z = z0 + 2 + Math.floor(rng() * Math.max(1, z1 - z0 - d - 4));
        if (!fits(world, x, z, w, d, spawn)) continue;
        ruins.push(layOut(x, z, w, d, rng));
        break;
      }
    }
  }
  return ruins;
}

// Whether a ruin of w x d at (x, z) has room: open, wild, near-level ground
// (two tiers at most) with a tile round it, clear of villages and the start.
function fits(world: RuinWorld, x: number, z: number, w: number, d: number, spawn: { x: number; z: number }): boolean {
  const [cx, cz] = [x + w / 2, z + d / 2];
  if (Math.hypot(cx - spawn.x, cz - spawn.z) < CLEAR_OF_SPAWN + Math.max(w, d) / 2) return false;
  if (world.villages.some((v) => Math.hypot(v.x - cx, v.z - cz) < VILLAGE_OUTER_RADIUS + CLEAR_OF_VILLAGES + Math.max(w, d) / 2)) return false;
  let low = Infinity;
  let high = -Infinity;
  for (let i = x - 1; i <= x + w; i++) {
    for (let k = z - 1; k <= z + d; k++) {
      if (i < 1 || k < 1 || i >= world.size.width - 1 || k >= world.size.depth - 1) return false;
      if (!world.isOpenTile(i, k) || world.surfaceMap[i][k] !== 'natural') return false;
      low = Math.min(low, world.heightMap[i][k]);
      high = Math.max(high, world.heightMap[i][k]);
      if (high - low > MAX_RISE) return false;
    }
  }
  return true;
}

// Its pieces, from `rng`: the outer walls round its edge (a way in kept clear
// on one side), its corners, then what stands inside, then the floor and rubble.
function layOut(x: number, z: number, w: number, d: number, rng: () => number): Ruin {
  const style = rng() < 0.5 ? 'keep' : 'chapel';
  const pieces: RuinPiece[] = [];
  const taken = new Set<string>();
  const at = (lx: number, lz: number) => `${lx},${lz}`;
  const put = (kind: RuinKind, lx: number, lz: number, quarterTurns = 0) => {
    if (taken.has(at(lx, lz))) return;
    taken.add(at(lx, lz));
    pieces.push({ kind, x: x + lx, z: z + lz, quarterTurns, variant: Math.floor(rng() * 4) });
  };
  // The way in: two tiles in the middle of one side, and the tile inside each kept clear.
  const doorSide = Math.floor(rng() * 4); // 0: -z, 1: +x, 2: +z, 3: -x
  const along = doorSide % 2 === 0 ? w : d;
  const door = Math.floor(along / 2) - 1;
  const inWay = (side: number, i: number) => side === doorSide && (i === door || i === door + 1);
  // Corners: towers (a keep has two or more, a chapel one), else stubs; some fallen.
  const corners: Array<[number, number]> = [[0, 0], [w - 1, 0], [w - 1, d - 1], [0, d - 1]];
  const towers = style === 'keep' ? 2 + Math.floor(rng() * 2) : 1;
  const towerAt = new Set<number>();
  while (towerAt.size < towers) towerAt.add(Math.floor(rng() * 4));
  const cornerTurns = [0, 3, 2, 1]; // turning a corner piece's L (drawn on its -x and -z sides) to each corner
  corners.forEach(([lx, lz], i) => {
    if (towerAt.has(i)) put('tower', lx, lz, cornerTurns[i]);
    else if (rng() < 0.75) put('corner', lx, lz, cornerTurns[i]);
  });
  // The outer walls: each side's tiles (not its corners) whole, broken down,
  // an arched window, or gone (a heap of rubble there, often); the way in clear.
  // A wall's face turns toward the middle: side 0 (-z) faces +z (0 turns), 1 (+x) faces -x, 2 (+z) faces -z, 3 (-x) faces +x.
  const faceIn = [0, 3, 2, 1];
  for (let side = 0; side < 4; side++) {
    const n = side % 2 === 0 ? w : d;
    for (let i = 1; i < n - 1; i++) {
      const [lx, lz] = side === 0 ? [i, 0] : side === 1 ? [w - 1, i] : side === 2 ? [n - 1 - i, d - 1] : [0, n - 1 - i];
      const index = side === 0 || side === 1 ? i : n - 1 - i; // along the side from its least end
      if (inWay(side, index)) continue;
      const roll = rng();
      if (roll < 0.45) put('wall', lx, lz, faceIn[side]);
      else if (roll < 0.66) put('wallBroken', lx, lz, faceIn[side]);
      else if (roll < 0.78) put('arch', lx, lz, faceIn[side]);
      else if (roll < 0.9) put('rubble', lx, lz, faceIn[side]);
      // (else: gone, nothing left)
    }
  }
  // Clear inside the way in, so it's always a way in.
  const inside = doorSide === 0 ? [[door, 1], [door + 1, 1]] : doorSide === 1 ? [[w - 2, door], [w - 2, door + 1]] : doorSide === 2 ? [[door, d - 2], [door + 1, d - 2]] : [[1, door], [1, door + 1]];
  for (const [lx, lz] of inside) taken.add(at(lx, lz));
  // Within: a chapel's nave, rows of columns down its length to an altar at
  // the far end from the way in; a keep's inner wall part way across, a few columns.
  const long = w >= d ? 'x' : 'z';
  if (style === 'chapel') {
    const len = long === 'x' ? w : d;
    const across = long === 'x' ? d : w;
    const rows = [Math.floor(across / 3), across - 1 - Math.floor(across / 3)];
    for (let i = 2; i < len - 2; i += 2) {
      for (const r of rows) {
        const [lx, lz] = long === 'x' ? [i, r] : [r, i];
        const roll = rng();
        if (roll < 0.5) put('column', lx, lz);
        else if (roll < 0.75) put('columnBroken', lx, lz);
        else if (roll < 0.92) put('columnFallen', lx, lz, Math.floor(rng() * 4));
      }
    }
    const far = (doorSide === 0 && long === 'z') || (doorSide === 3 && long === 'x') ? len - 2 : 1; // the end away from the way in
    const mid = Math.floor(across / 2);
    const [ax, az] = long === 'x' ? [far, mid] : [mid, far];
    put('altar', ax, az, long === 'x' ? (far === 1 ? 1 : 3) : far === 1 ? 0 : 2);
  } else {
    // The inner wall runs across the long way, a third along.
    const cut = Math.floor((long === 'x' ? w : d) / 3);
    const from = 1 + Math.floor(rng() * 2);
    const to = (long === 'x' ? d : w) - 2 - Math.floor(rng() * 2);
    for (let i = from; i <= to; i++) {
      if (rng() < 0.25) continue; // broken through here and there
      const [lx, lz] = long === 'x' ? [cut, i] : [i, cut];
      put(rng() < 0.3 ? 'wallBroken' : 'innerWall', lx, lz, long === 'x' ? 1 : 0);
    }
    for (let n = 2 + Math.floor(rng() * 3); n > 0; n--) {
      const [lx, lz] = [2 + Math.floor(rng() * (w - 4)), 2 + Math.floor(rng() * (d - 4))];
      put(rng() < 0.5 ? 'column' : rng() < 0.5 ? 'columnBroken' : 'columnFallen', lx, lz, Math.floor(rng() * 4));
    }
  }
  // Rubble heaps inside and round about, and cracked flagstones over much of the floor.
  for (let n = 4 + Math.floor(rng() * 5); n > 0; n--) put('rubble', 1 + Math.floor(rng() * (w - 2)), 1 + Math.floor(rng() * (d - 2)), Math.floor(rng() * 4));
  for (let lx = 1; lx < w - 1; lx++) for (let lz = 1; lz < d - 1; lz++) if (rng() < 0.55) put('floor', lx, lz, Math.floor(rng() * 4));
  const way = doorSide === 0 ? { x: x + door, z: z - 1 } : doorSide === 1 ? { x: x + w, z: z + door } : doorSide === 2 ? { x: x + door, z: z + d } : { x: x - 1, z: z + door };
  return { x, z, w, d, style, way, pieces };
}

// What blocks, as it's drawn (ruinVoxels.ts): a wall a strip along its tile's back edge (a corner along two),
// as thick as its stone; an inner wall a strip across its middle; a tower its whole tile; columns and rubble
// a little (a fallen column more); the altar its slab (17 voxels across, 11 deep), each turned as it stands.
const BLOCKS: Partial<Record<RuinKind, number>> = { column: 0.22, columnBroken: 0.22, columnFallen: 0.34, rubble: 0.28 };
const STRIP = 0.28; // a wall's thickness (7 voxels)
const ALTAR: [number, number] = [0.34, 0.22]; // half-sizes: along its face, and out from it
const INNER: [number, number] = [0.5, 0.1]; // an inner wall's: along it, and through it
// The side (NEIGHBORS_4) of its tile a piece turned `q` has its local -Z edge on, and its local -X edge.
const back = (q: number) => sideOf(-FACINGS[q][0], -FACINGS[q][1]);
const left = (q: number) => sideOf(-FACINGS[(q + 1) % 4][0], -FACINGS[(q + 1) % 4][1]);

export function addRuinObstacles(obstacles: Obstacles, ruins: readonly Ruin[]): void {
  for (const ruin of ruins) {
    for (const { kind, x, z, quarterTurns: q } of ruin.pieces) {
      const across = q % 2; // turned a quarter (or three): its x and z swapped
      if (kind === 'tower') obstacles.addSolid(x, z);
      else if (kind === 'wall' || kind === 'wallBroken' || kind === 'arch' || kind === 'corner') {
        obstacles.addFenceStrip(x, z, back(q), STRIP);
        if (kind === 'corner') obstacles.addFenceStrip(x, z, left(q), STRIP);
      } else if (kind === 'innerWall') obstacles.addProp(x, z, INNER[across], false, INNER[1 - across]);
      else if (kind === 'altar') obstacles.addProp(x, z, ALTAR[across], false, ALTAR[1 - across]);
      else if (BLOCKS[kind]) obstacles.addProp(x, z, BLOCKS[kind]!);
    }
  }
}
