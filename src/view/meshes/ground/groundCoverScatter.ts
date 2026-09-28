// Decides where grass clumps, wildflowers and pebbles go. Purely visual, so
// it never draws from the world rng — every seed keeps its exact map: each
// tile rolls from a hash of its position, and grass density follows its
// own seeded meadow noise. No three.js here, so it's easy to test.

import type { GameModel } from '../../../model/GameModel';
import { MAP_WIDTH, MAP_DEPTH, TILE_HEIGHT } from '../../../model/constants';
import { cellKey } from '../../../model/grid';
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

// Only plain grass: never water, paths, village squares or buildings.
// Flowers and pebbles also skip tree tiles so they don't sit inside a trunk;
// tufts around a tree's base look natural.
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
      if (model.lakeMap[x][z] || model.surfaceMap[x][z] !== 'natural' || solid.has(key)) continue;

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
