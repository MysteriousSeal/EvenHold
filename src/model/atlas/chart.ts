// What the map draws of a chunk of the world (atlas.ts; a streamed world's region, CHUNK tiles a side): its country in
// cells of CHART_CELL tiles (each its kind, and its ground's height: the water, the fields, a village's square, else
// the country's own: meadow, forest, heath, marsh, hills, scenery/biomes.ts), its roads as lines of tiles, its villages,
// ruins and camps. All the seed makes, the same every time: worked out once a chunk, kept for the game (a streamed
// world's off the game's thread, from its land: chartWorker.ts; a classic world's from the world made whole).

import { createBiomes, type Biome } from '../scenery/biomes';
import type { Tiles } from '../map/tiles';
import type { MapSize } from '../map/grid';
import type { RegionLand } from '../worldgen/regions';
import { CHUNK } from './fog';

export const CHART_CELL = 2; // tiles a side of a cell of the chart
export const CHART_CELLS = CHUNK / CHART_CELL; // cells a side of a chunk's chart
const WAY_STEP = 3; // a road's tiles kept, one in so many (and its last): its line's bends

// The kinds of ground, by their number in a cell (its low four bits; the ground's height its high four).
export const GROUNDS = ['none', 'meadow', 'forest', 'heath', 'marsh', 'hills', 'water', 'field', 'square'] as const;
export type Ground = (typeof GROUNDS)[number];
const COUNTRY: Record<Biome, number> = { meadow: 1, forest: 2, heath: 3, marsh: 4, hills: 5 };
const [WATER, FIELD, SQUARE] = [6, 7, 8];

export interface Chart {
  cx: number; // which chunk
  cz: number;
  cells: Uint8Array; // CHART_CELLS x CHART_CELLS, by x then z: each its ground (low four bits) and height (high four)
  ways: number[][]; // its roads and trails, each its tiles' x, z in turn
  villages: Array<{ x: number; z: number; town?: true }>; // (`town`: the cathedral town, town/townLand.ts)
  ruins: Array<{ x: number; z: number; w: number; d: number }>;
  camps: Array<{ x: number; z: number }>;
}

// What a chart's made from: the chunk's tiles and what stands on them (a region's land; the classic world's, all of it:
// those off the chunk passed over).
export interface ChartLand {
  tiles: Tiles;
  trails: ReadonlyArray<ReadonlyArray<readonly [number, number]>>;
  roads: ReadonlyArray<{ route: ReadonlyArray<readonly [number, number]> }>;
  villages: ReadonlyArray<{ x: number; z: number; town?: true }>;
  ruins: ReadonlyArray<{ x: number; z: number; w: number; d: number }>;
  camps: ReadonlyArray<{ x: number; z: number }>;
}

// A cell's ground and height.
export const groundOf = (cell: number): Ground => GROUNDS[cell & 15] ?? 'none';
export const heightOf = (cell: number): number => cell >> 4;

// Chunk (cx, cz)'s chart, of a world of `seed` and `size`.
export function chartOf(seed: number, size: MapSize, cx: number, cz: number, land: ChartLand): Chart {
  const [x0, z0] = [cx * CHUNK, cz * CHUNK];
  const [x1, z1] = [Math.min(size.width, x0 + CHUNK), Math.min(size.depth, z0 + CHUNK)];
  const { tiles } = land;
  const country = createBiomes(seed);
  const cells = new Uint8Array(CHART_CELLS * CHART_CELLS);
  const whole = CHART_CELL * CHART_CELL;
  for (let i = 0; i < CHART_CELLS; i++) {
    for (let k = 0; k < CHART_CELLS; k++) {
      const [x, z] = [x0 + i * CHART_CELL, z0 + k * CHART_CELL];
      if (x >= x1 || z >= z1) continue; // (off the map: none)
      let [water, fields, square] = [0, 0, 0];
      for (let a = 0; a < CHART_CELL; a++) {
        for (let b = 0; b < CHART_CELL; b++) {
          if (tiles.lake(x + a, z + b)) water++;
          const surface = tiles.surface(x + a, z + b);
          if (surface === 'field') fields++;
          else if (surface === 'plaza') square++;
        }
      }
      const [mx, mz] = [x + CHART_CELL / 2, z + CHART_CELL / 2];
      const ground = water * 2 >= whole ? WATER : square * 4 >= whole ? SQUARE : fields * 2 >= whole ? FIELD : COUNTRY[country.at(mx, mz)];
      cells[i * CHART_CELLS + k] = ground | (Math.min(15, tiles.height(mx, mz)) << 4);
    }
  }
  const on = (x: number, z: number) => x >= x0 && z >= z0 && x < x1 && z < z1;
  const ways = [...land.trails, ...land.roads.map((r) => r.route)].filter((way) => way.some(([x, z]) => on(x, z))).map(lineOf);
  return {
    cx,
    cz,
    cells,
    ways,
    villages: land.villages.filter((v) => on(v.x, v.z)).map(({ x, z, town }) => ({ x, z, ...(town && { town }) })),
    ruins: land.ruins.filter((r) => on(r.x, r.z)).map(({ x, z, w, d }) => ({ x, z, w, d })),
    camps: land.camps.filter((c) => on(c.x, c.z)).map(({ x, z }) => ({ x, z })),
  };
}

// A streamed world's region's chart, from its land as made (worldgen/regions.ts).
export const chartOfLand = (seed: number, size: MapSize, land: RegionLand): Chart => chartOf(seed, size, land.rx, land.rz, land);

// A road's tiles, every WAY_STEP'th kept (and its last), as x, z in turn.
function lineOf(way: ReadonlyArray<readonly [number, number]>): number[] {
  const out: number[] = [];
  way.forEach(([x, z], i) => {
    if (i % WAY_STEP === 0 || i === way.length - 1) out.push(x, z);
  });
  return out;
}
