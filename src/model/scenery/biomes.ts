// The country's lie: which stretch of wild land each tile is part of, each stretch some 50-150 tiles across (a border
// crossed every minute or so of walking). Five kinds:
// - forest: deep woods, where the trees' own groves grow thick (worldgen/trees.ts' forest noise, read a little
//   blurred: the woods drawn dark are the woods that are there), and where a slow woodland noise runs high;
// - marsh: the low ground by the world's lakes, a band a few tiles deep (its own height, its lake noise just short of
//   flooding), wider where a damp noise runs high;
// - hills: rough, rocky country, off the lowest ground;
// - heath: a moor of heather and gorse, where the land runs dry;
// - meadow: all the rest, open grassland (about half the land), and round the villages (aroundVillages).
// Read from smooth fields, never a tile's own tier (one step of which would flip it, and speckle the land): the world's
// own height noise (the terrain's base, without its detail: worldgen/terrain.ts) averaged over a lattice round the
// tile, the trees' groves, slow noises of its own; and, for the marsh by the water only, the ground's own height and
// lake noise where the tile is (as the lakes themselves are made: worldgen/regions.ts). Each tile reads them a few tiles off its own spot (by a
// roll of its own), so the borders are dithered over some five tiles, never a straight line. A pure function of the
// seed and the place: the same for any part of any map, classic or streamed (a region's seam, a worker's region), and
// never the world's rng, so every map keeps its trees, villages, roads and lakes.

import { createNoise2D } from 'simplex-noise';
import { hashUnit, mulberry32 } from '../../util/random';
import { createForestDensity } from '../worldgen/trees';
import { LAKE_NOISE_SCALE, LAKE_THRESHOLD_MAX, LAKE_THRESHOLD_MIN, NOISE_SCALE, TREE_CHANCE } from '../constants';
import type { Tiles } from '../map/tiles';

export const BIOMES = ['meadow', 'forest', 'heath', 'marsh', 'hills'] as const;
export type Biome = (typeof BIOMES)[number];

const WOODLAND_SALT = 0x4b1d2c3e;
const DAMP_SALT = 0x2c1b3c6d;
const DRY_SALT = 0x297a2d39;
const ROUGH_SALT = 0x1b873593;
const SCALE = 150; // tiles: the wavelength of the country's own noises
const NODE = 8; // tiles apart the fields are worked out (and read between)
const NODES_KEPT = 200_000;
const LATTICE = 8; // tiles apart the ground's height is read round a node (3 x 3), averaging out its hills and dales
const DITHER = 2.5; // tiles off its own spot (either way) a tile reads the fields: its border's dither
const FOREST_CHANCE = 0.5; // a tree's chance deep in a forest (worldgen/trees.ts: not changed there, its source is the world cache's fingerprint)
const BLOCK = 16; // tiles a side of each block of the country kept, once worked out
const KEPT = 1024; // blocks kept (the oldest let go)
// Where each begins: the country's own slow noises shape it (the land's hills and dales are some 24 tiles apart
// everywhere, too small to shape a stretch of country by); the ground's height (in tiers, averaged: some 2.1 to 2.9,
// its middle 2.5) only keeps a marsh off the heights and the hills off the lowest ground.
const GROVES = 0.3; // the trees' density round a tile (0..1, its 3 x 3 GROVE apart) over this: forest
const GROVE = 4;
const WOODLAND = 0.55; // or the woodland noise over this
const MARSH_LOW = 2; // marsh only on low ground (its own height, in tiers, under this: the lowest two)
const LAKE_BAND = 0.1; // where the lake noise is within this of flooding (the world's threshold): the band by the water
const DAMP_WIDENS = 0.08; // and the damp noise (-1..1) widens or narrows it by up to this
const HILLS_ROUGH = 0.35; // the rough noise over this: hills
const HILLS_LOWEST = 2.38; // never on ground lower than this
const HEATH_DRY = 0.36; // the dry noise over this: heath

export interface BiomeMap {
  at(x: number, z: number): Biome; // the kind of country at tile (x, z)
  woods(x: number, z: number): number; // how thick the trees grow at (x, z): 0 in the open, 1 in the thick of a forest
}

// `tiles`: kept for its callers (the country's a pure function of the seed and the place: it reads no tile). One map
// a seed, shared (each tile worked out the once, whoever asks: the ground, the grass, the trees, the bushes).
const made = new Map<number, BiomeMap>();
export function createBiomes(seed: number, _tiles?: Tiles): BiomeMap {
  let map = made.get(seed);
  if (!map) {
    if (made.size > 4) made.clear();
    made.set(seed, (map = kept(country(seed))));
  }
  return map;
}

// Each tile's country worked out once, kept by blocks.
function kept(map: BiomeMap): BiomeMap {
  const blocks = new Map<number, Uint8Array>();
  return {
    woods: map.woods,
    at(x, z) {
      const [bx, bz] = [Math.floor(x / BLOCK), Math.floor(z / BLOCK)];
      const key = bx * 65536 + bz;
      let block = blocks.get(key);
      if (!block) {
        block = new Uint8Array(BLOCK * BLOCK).fill(255);
        if (blocks.size >= KEPT) blocks.delete(blocks.keys().next().value!);
        blocks.set(key, block);
      }
      const i = (x - bx * BLOCK) * BLOCK + (z - bz * BLOCK);
      if (block[i] === 255) block[i] = BIOMES.indexOf(map.at(x, z));
      return BIOMES[block[i]];
    },
  };
}

function country(seed: number): BiomeMap {
  // The world's own noise (drawn as a classic world's and a streamed world's are: worldgen/world.ts, regions.ts), and
  // how lake-prone it is.
  const worldRng = mulberry32(seed);
  const ground = createNoise2D(worldRng);
  const lakeThreshold = LAKE_THRESHOLD_MIN + worldRng() * (LAKE_THRESHOLD_MAX - LAKE_THRESHOLD_MIN);
  const forest = createForestDensity(seed);
  const [woodland, damp, dry, rough] = [WOODLAND_SALT, DAMP_SALT, DRY_SALT, ROUGH_SALT].map((salt) => createNoise2D(mulberry32(seed ^ salt)));
  const woods = (x: number, z: number) => Math.min(1, Math.max(0, (forest(x, z) - TREE_CHANCE) / (FOREST_CHANCE - TREE_CHANCE)));
  // Every field at the nodes of a lattice NODE tiles apart (worked out once each, kept), and between them, each read
  // from the nodes round it (bilinearly): the ground's height averaged over the 3 x 3 round a node (its broad lie, not
  // its every bump), the trees' density likewise, and the country's own slow noises.
  const nodes = new Map<number, Float32Array>();
  const node = (i: number, k: number): Float32Array => {
    const key = i * 100003 + k;
    let f = nodes.get(key);
    if (!f) {
      const [x, z] = [i * NODE, k * NODE];
      let [high, thick] = [0, 0];
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        high += ground((x + a * LATTICE) / NOISE_SCALE, (z + b * LATTICE) / NOISE_SCALE);
        thick += woods(x + a * GROVE, z + b * GROVE);
      }
      const [u, v] = [x / SCALE, z / SCALE];
      f = Float32Array.of(((high / 9 + 1.3) / 2.6) * 5, thick / 9, woodland(u, v), damp(u, v), dry(u, v), rough(u, v));
      if (nodes.size > NODES_KEPT) nodes.clear();
      nodes.set(key, f);
    }
    return f;
  };
  const fields = new Float32Array(6);
  const read = (x: number, z: number): Float32Array => {
    const [i, k] = [Math.floor(x / NODE), Math.floor(z / NODE)];
    const [tx, tz] = [x / NODE - i, z / NODE - k];
    const [a, b, c, d] = [node(i, k), node(i + 1, k), node(i, k + 1), node(i + 1, k + 1)];
    for (let n = 0; n < 6; n++) fields[n] = (a[n] * (1 - tx) + b[n] * tx) * (1 - tz) + (c[n] * (1 - tx) + d[n] * tx) * tz;
    return fields;
  };
  return {
    woods,
    at(x, z) {
      const sx = x + (hashUnit(x, z, seed + 0xb10) - 0.5) * 2 * DITHER;
      const sz = z + (hashUnit(x, z, seed + 0xb11) - 0.5) * 2 * DITHER;
      const [high, thick, wild, wet, dried, rocky] = read(sx, sz);
      // The ground's own height where the tile reads (as the terrain's: worldgen/terrain.ts), and its lake noise.
      const own = ((ground(sx / NOISE_SCALE, sz / NOISE_SCALE) + ground(sx / (NOISE_SCALE / 3), sz / (NOISE_SCALE / 3)) * 0.3 + 1.3) / 2.6) * 5;
      if (own < MARSH_LOW && ground(sx / LAKE_NOISE_SCALE + 500, sz / LAKE_NOISE_SCALE + 500) > lakeThreshold - LAKE_BAND - wet * DAMP_WIDENS) return 'marsh';
      if (thick > GROVES || wild > WOODLAND) return 'forest';
      if (rocky > HILLS_ROUGH && high > HILLS_LOWEST) return 'hills';
      if (dried > HEATH_DRY) return 'heath';
      return 'meadow';
    },
  };
}

const FARMLAND = 20; // tiles round a village's well its country is meadow (villages sit in their farmland)
const FARM_CELL = 32; // tiles a side of the cells the villages are looked up by

// The country as the land is drawn with its villages on it: meadow round each one, its edge dithered as every border
// is. (A streamed world's villages keep well in from their region's edges: worldgen/regions.ts, so a region's own
// villages are all that reach its tiles.)
export function aroundVillages(map: BiomeMap, villages: ReadonlyArray<{ x: number; z: number }>): BiomeMap {
  if (villages.length === 0) return map;
  const cells = new Map<string, Array<{ x: number; z: number }>>();
  for (const v of villages) {
    const key = `${Math.floor(v.x / FARM_CELL)},${Math.floor(v.z / FARM_CELL)}`;
    cells.set(key, [...(cells.get(key) ?? []), v]);
  }
  const farmed = (x: number, z: number) => {
    const reach = FARMLAND + (hashUnit(x, z, 0xfa4) - 0.5) * 2 * DITHER;
    const [cx, cz] = [Math.floor(x / FARM_CELL), Math.floor(z / FARM_CELL)];
    for (let i = cx - 1; i <= cx + 1; i++) for (let k = cz - 1; k <= cz + 1; k++) {
      for (const v of cells.get(`${i},${k}`) ?? []) if (Math.hypot(v.x - x, v.z - z) < reach) return true;
    }
    return false;
  };
  return { woods: map.woods, at: (x, z) => (farmed(x, z) ? 'meadow' : map.at(x, z)) };
}
