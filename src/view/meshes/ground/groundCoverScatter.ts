// Decides where grass clumps, wildflowers and pebbles go. Purely visual, so
// it never draws from the world rng — every seed keeps its exact map: each
// tile rolls from a hash of its position, and grass density follows its
// own seeded meadow noise. No three.js here, so it's easy to test.

import type { GameModel } from '../../../model/GameModel';
import { MAP_WIDTH, MAP_DEPTH, TILE_HEIGHT } from '../../../model/constants';
import { NEIGHBORS_4, cellKey, inBounds } from '../../../model/grid';
import { ROAD_WIDTH } from '../../constants';
import { solidCells } from '../../../model/worldgen/world';
import { createNoise2D } from 'simplex-noise';
import { hashCell, mulberry32 } from '../../../util/random';

const MEADOW_SCALE = 9; // wavelength of the lush / bare grass patches, in tiles
const MEADOW_SEED_SALT = 0x9e3779b9;
const MAX_CLUMPS_PER_TILE = 5;
const CLUMP_SCALE_EDGE = 0.6; // clump size at the thin edge of a meadow
const CLUMP_SCALE_CENTER = 1.2; // clump size in the lushest part
const FLOWER_CHANCE = 0.05;
const PEBBLE_CHANCE = 0.04;
const SCATTER_SPREAD = 0.8; // offsets stay within the middle 80% of the tile
const SCATTER_SALT = 2;
const ROAD_EDGE_CANDIDATES = 7; // tries per road tile to place a lining clump
const ROAD_CLEARANCE = 0.04; // keep lining grass this far off the dirt

export interface ScatterItem {
  x: number;
  y: number; // ground surface height
  z: number;
  tier: number;
  rotation: number;
  scale: number;
  variant: number; // item-specific: tuft shade, flower color, pebble shade index
}

export interface GroundCover {
  tufts: ScatterItem[];
  flowers: ScatterItem[];
  pebbles: ScatterItem[];
}

// A road tile's dirt strip covers a cross: the center square plus an arm
// toward each connected road/square neighbor (see groundDecals.ts). True
// if a point (offset from the tile center) is on that cross, plus clearance.
function onRoad(model: GameModel, x: number, z: number, ox: number, oz: number): boolean {
  const half = ROAD_WIDTH / 2 + ROAD_CLEARANCE;
  if (Math.abs(ox) <= half && Math.abs(oz) <= half) return true;
  return NEIGHBORS_4.some(([dx, dz]) => {
    if (!inBounds(x + dx, z + dz) || model.surfaceMap[x + dx][z + dz] === 'natural') return false;
    return dx !== 0 ? Math.sign(ox) === dx && Math.abs(oz) <= half : Math.sign(oz) === dz && Math.abs(ox) <= half;
  });
}

// Grass, flowers and pebbles go on plain grass only: never water, village
// squares or buildings. Flowers and pebbles also skip tree tiles so they
// don't sit inside a trunk; tufts around a tree's base look natural. Road
// tiles are only half dirt, so their grassy margins get a steady line of
// clumps (whatever the meadow density), making roads cut through the grass.
// 0 on bare ground, 1 in the lushest meadow. Low-frequency noise shifted
// down a little so bare areas are common and meadows have soft edges.
function meadowDensity(noise2D: (x: number, y: number) => number, x: number, z: number): number {
  const n = noise2D(x / MEADOW_SCALE, z / MEADOW_SCALE);
  return Math.min(1, Math.max(0, (n + 0.2) / 0.8));
}

export function scatterGroundCover(model: GameModel): GroundCover {
  const meadowNoise = createNoise2D(mulberry32(model.seed ^ MEADOW_SEED_SALT));
  const solid = solidCells(model.houses, model.villages);
  const treeCells = new Set(model.trees.map((t) => cellKey(t.x, t.z)));
  const cover: GroundCover = { tufts: [], flowers: [], pebbles: [] };

  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let z = 0; z < MAP_DEPTH; z++) {
      const key = cellKey(x, z);
      if (model.lakeMap[x][z] || solid.has(key)) continue;
      const surface = model.surfaceMap[x][z];
      if (surface === 'plaza') continue;

      const rng = mulberry32(hashCell(x, z, SCATTER_SALT));
      const tier = model.heightMap[x][z];
      const y = tier * TILE_HEIGHT;
      const item = (ox: number, oz: number, scale: number, variant: number): ScatterItem => ({
        x: x + ox,
        y,
        z: z + oz,
        tier,
        rotation: rng() * Math.PI * 2,
        scale,
        variant,
      });
      const offset = () => (rng() - 0.5) * SCATTER_SPREAD;

      if (surface === 'path') {
        for (let i = 0; i < ROAD_EDGE_CANDIDATES; i++) {
          const ox = (rng() - 0.5) * 0.9;
          const oz = (rng() - 0.5) * 0.9;
          const scale = 0.7 + rng() * 0.25;
          if (!onRoad(model, x, z, ox, oz)) cover.tufts.push(item(ox, oz, scale, rng() < 0.5 ? 0 : 1));
        }
        continue;
      }

      // Lush meadows get up to MAX_CLUMPS_PER_TILE, their edges a stray
      // clump or two, bare ground none.
      const density = meadowDensity(meadowNoise, x, z);
      const clumps = Math.floor(density * MAX_CLUMPS_PER_TILE + rng() * 0.99);
      // Clumps also grow with the meadow: small at the thin edges, largest
      // in the lush centers, so patches read as mounds rather than dots.
      const meadowScale = CLUMP_SCALE_EDGE + (CLUMP_SCALE_CENTER - CLUMP_SCALE_EDGE) * density;
      for (let i = 0; i < clumps; i++) {
        cover.tufts.push(item(offset(), offset(), meadowScale * (0.85 + rng() * 0.3), rng() < 0.5 ? 0 : 1));
      }

      const hasTree = treeCells.has(key);
      if (!hasTree && rng() < FLOWER_CHANCE) {
        // A small cluster of 1-3 flowers of one color.
        const cx = offset();
        const cz = offset();
        const color = Math.floor(rng() * 3);
        const count = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < count; i++) {
          cover.flowers.push(item(cx + (rng() - 0.5) * 0.16, cz + (rng() - 0.5) * 0.16, 0.85 + rng() * 0.3, color));
        }
      }
      if (!hasTree && rng() < PEBBLE_CHANCE) {
        const count = rng() < 0.3 ? 2 : 1;
        for (let i = 0; i < count; i++) cover.pebbles.push(item(offset(), offset(), 0.025 + rng() * 0.025, Math.floor(rng() * 3)));
      }
    }
  }
  return cover;
}
