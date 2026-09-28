// A village square as one voxel model, laid out in world space so stones
// run freely across tile boundaries (no grid seam every tile). Palette
// first (warm sandstone), then, from the ground up:
// - irregular hand-laid stones in running-bond rows, mortar one voxel lower;
// - wear: a few stones raised, sunk or missing, corners chipped;
// - moss in the mortar and grass sprouting from it, denser toward the edge;
// - a curb of long stones along edges that face grass (roads stay open);
// - two square rings of patterned stones around the well.
// Everything is grid-aligned: rings are squares, not circles.

import { VILLAGE_OUTER_RADIUS } from '../../../model/constants';
import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, setColor } from '../voxel/voxelShapes';

export const PLAZA_VOXEL_SIZE = 0.04;
const TILE = 25; // voxels per tile
export const PLAZA_RADIUS = VILLAGE_OUTER_RADIUS; // tiles from the well to the square's edge
const SIZE = (2 * PLAZA_RADIUS + 1) * TILE;
const CENTER = Math.floor(SIZE / 2);
export const PLAZA_GRID: [number, number, number] = [SIZE, 4, SIZE];

export const PLAZA_PALETTE = [
  0xd8b98a, // 1 sandstone
  0xcfae7c, // 2 sandstone, deeper
  0xe2c79b, // 3 sandstone, pale
  0xc9a574, // 4 sandstone, ochre
  0xb08a5a, // 5 accent ring stone
  0xc2a57c, // 6 curb
  0xb39670, // 7 curb, shaded
  0x9c7f5c, // 8 mortar
  0x8f7048, // 9 bare earth (missing stone)
  0x6f9148, // 10 moss
  0x86b457, // 11 grass sprout
];
const STONES = [1, 2, 3, 4];
const ACCENT = 5;
const CURBS = [6, 7];
const MORTAR = 8;
const EARTH = 9;
const MOSS = 10;
const GRASS = 11;

// What surrounds the square, by tile offset from the well (-3..3 each way).
export type TileKind = 'plaza' | 'path' | 'natural';

interface Stone {
  color: number;
  top: number; // highest voxel layer (1 normally, 2 raised, 0 sunk, -1 missing)
}

export function buildPlaza(kindAt: (dx: number, dz: number) => TileKind, seed: number): VoxelGrid {
  const grid = createGrid(PLAZA_GRID);
  const rng = mulberry32(seed);
  const tileOf = (v: number) => Math.floor(v / TILE) - PLAZA_RADIUS;
  const paved = (i: number, k: number) => kindAt(tileOf(i), tileOf(k)) === 'plaza';

  // Distance (in voxels) to the nearest square edge that faces grass, and
  // to the nearest edge at all (for moss/grass density).
  const grassEdge = (i: number, k: number): number => {
    const ti = tileOf(i);
    const tk = tileOf(k);
    const li = i % TILE;
    const lk = k % TILE;
    let d = Infinity;
    if (kindAt(ti + 1, tk) === 'natural') d = Math.min(d, TILE - 1 - li);
    if (kindAt(ti - 1, tk) === 'natural') d = Math.min(d, li);
    if (kindAt(ti, tk + 1) === 'natural') d = Math.min(d, TILE - 1 - lk);
    if (kindAt(ti, tk - 1) === 'natural') d = Math.min(d, lk);
    return d;
  };

  // Stone layout: running-bond rows of random depth, stones of random width.
  const stoneAt = new Int32Array(SIZE * SIZE).fill(-1); // -1 = mortar
  const stones: Stone[] = [];
  const newStone = (color: number): number => {
    const roll = rng();
    const top = roll < 0.03 ? -1 : roll < 0.09 ? 0 : roll < 0.15 ? 2 : 1;
    stones.push({ color, top });
    return stones.length - 1;
  };
  for (let k0 = 0; k0 < SIZE; ) {
    const depth = 3 + Math.floor(rng() * 3);
    for (let i0 = Math.floor(rng() * 3) - 2; i0 < SIZE; ) {
      const width = 3 + Math.floor(rng() * 5);
      const id = newStone(STONES[Math.floor(rng() * STONES.length)]);
      for (let i = Math.max(0, i0); i < Math.min(SIZE, i0 + width); i++) {
        for (let k = k0; k < Math.min(SIZE, k0 + depth); k++) stoneAt[i + k * SIZE] = id;
      }
      i0 += width + 1;
    }
    k0 += depth + 1;
  }

  // The well rings and the curb override the free layout with their own blocks.
  const blockIds = new Map<string, number>();
  const block = (key: string, color: number) => {
    let id = blockIds.get(key);
    if (id === undefined) {
      id = stones.push({ color, top: 1 }) - 1;
      blockIds.set(key, id);
    }
    return id;
  };
  for (let i = 0; i < SIZE; i++) {
    for (let k = 0; k < SIZE; k++) {
      const n = i + k * SIZE;
      const ring = Math.max(Math.abs(i - CENTER), Math.abs(k - CENTER));
      // Position along the ring's side, for cutting it into blocks.
      const along = Math.abs(i - CENTER) >= Math.abs(k - CENTER) ? k : i;
      if (ring >= 13 && ring <= 19) {
        if (ring === 16 || ring === 19) stoneAt[n] = -1;
        else if (ring < 16) stoneAt[n] = along % 5 === 4 ? -1 : block(`a:${Math.floor(along / 5)}:${i > k}:${i + k > 2 * CENTER}`, STONES[2]);
        else stoneAt[n] = along % 4 === 1 ? -1 : block(`b:${Math.floor((along + 2) / 4)}:${i > k}:${i + k > 2 * CENTER}`, ACCENT);
      }
      const edge = grassEdge(i, k);
      if (edge <= 3) {
        const run = Math.abs(i - CENTER) > Math.abs(k - CENTER) ? k : i;
        stoneAt[n] = edge === 3 || run % 8 === 7 ? -1 : block(`c:${Math.floor(run / 8)}:${tileOf(i)}:${tileOf(k)}`, CURBS[run % 16 < 8 ? 0 : 1]);
        if (stoneAt[n] >= 0) stones[stoneAt[n]].top = 2; // curbs stand a voxel proud
      }
    }
  }

  // Lay it down.
  for (let i = 0; i < SIZE; i++) {
    for (let k = 0; k < SIZE; k++) {
      if (!paved(i, k)) continue;
      const id = stoneAt[i + k * SIZE];
      const edgeFactor = 1 - Math.min(1, grassEdge(i, k) / TILE);
      if (id < 0 || stones[id].top < 0) {
        // Mortar or a missing stone: one voxel low, often mossy, sometimes sprouting.
        const mossy = rng() < 0.12 + 0.45 * edgeFactor;
        setColor(grid, i, 0, k, mossy ? MOSS : id < 0 ? MORTAR : EARTH);
        if (rng() < 0.015 + 0.08 * edgeFactor) {
          const tall = 2 + (rng() < 0.4 ? 1 : 0);
          for (let y = 1; y <= tall; y++) setColor(grid, i, y, k, GRASS);
        }
        continue;
      }
      const { color, top } = stones[id];
      for (let y = 0; y <= top; y++) setColor(grid, i, y, k, color);
    }
  }

  // Chipped corners: a stone's corner column sometimes loses its top voxel.
  for (let i = 1; i < SIZE - 1; i++) {
    for (let k = 1; k < SIZE - 1; k++) {
      const id = stoneAt[i + k * SIZE];
      if (id < 0 || stones[id].top < 1) continue;
      const sameX = stoneAt[i - 1 + k * SIZE] === id && stoneAt[i + 1 + k * SIZE] === id;
      const sameZ = stoneAt[i + (k - 1) * SIZE] === id && stoneAt[i + (k + 1) * SIZE] === id;
      if (!sameX && !sameZ && rng() < 0.3) {
        const top = stones[id].top;
        if (colorAt(grid, i, top, k) !== 0) setColor(grid, i, top, k, 0);
      }
    }
  }
  return grid;
}
