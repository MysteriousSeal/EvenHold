// A streamed world (too big to make whole: 16384 tiles a side) is made a region at a time, REGION tiles a side, as
// the hero comes near it (the game lets far ones go: worldStreamer.ts); each the same every time, from the world's
// seed and where it is, and meeting its neighbours seamlessly:
// - its ground from the world's own noise, sampled where it is; smoothed a few passes, each from the last (so a
//   tile's height depends only on the ground round it: made with an apron, the same from either side of a border);
// - its lakes decided tile by tile, as low ground under the world's lake noise (smooth, so whole stretches of low
//   ground flood together), never small puddles nor near where the hero sets out; a deep dry tile beside water
//   raised to the bank's height (no pit below the water line);
// - all on it (villages, their roads and fields, ruins, camps, trees, bushes) made as a small world of its own (the
//   classic pipeline: world.ts), from its own seed: villages kept clear of its edges by half their spacing and room
//   for their lanes, ruins and camps by a few tiles, so nothing ever straddles two; forests, meadows and every tree's
//   and bush's look sampled where they are, so they run on across borders;
// - the cathedral town, on the one region that has it (town/townSite.ts), raised on its own hill after the villages
//   are placed (town/townLand.ts: those too near it let go, every other as it ever was);
// - and last, a road from each of its borders' crossings in to its own (borderRoads.ts), each crossing found the same
//   from either side (crossingsOf), so the land's roads run on from region to region.
// Then moved to where it is on the world's map (everything in world tiles; its tiles a TilePatch).

import { createNoise2D } from 'simplex-noise';
import { hashCell, mulberry32 } from '../../util/random';
import { LAKE_NOISE_SCALE, LAKE_THRESHOLD_MAX, LAKE_THRESHOLD_MIN, MAX_TIER, WATER_LEVEL } from '../constants';
import { cellKey, spawnOf, type MapSize } from '../map/grid';
import { TilePatch, mapsAsTiles } from '../map/tiles';
import type { Building, Bush, Field, House, Surface, Tree, Village } from '../types';
import { placeCamps, type Camp } from '../camps/camps';
import { placeRuins, type Ruin } from '../ruins/ruins';
import { generateHeightMap } from './terrain';
import { generateVillages } from './villages';
import { generateSpawnTrail } from './trails';
import { linkVillages, type Road } from './roads';
import { STRAIGHT_IN, roadsToBorders } from './borderRoads';
import { generateFields } from './fields';
import { createForestDensity, generateTrees } from './trees';
import { createMeadowDensity } from './meadows';
import { generateBushes } from './bushes';
import { solidCells } from './world';
import { townOnRegion, REACH as TOWN_REACH } from '../town/townSite';
import { raiseTown, townSolids, type Town } from '../town/townLand';

export const REGION = 512; // tiles a side
export const STREAMED_SIZE: MapSize = { width: 16384, depth: 16384 };
const PASSES = 4; // smoothing passes (raw ground hardly ever needs one: two tiers apart, side by side)
const APRON = PASSES + 3; // tiles of ground made round it, for its smoothing, lakes and banks to see past its edge
const VILLAGE_MARGIN = 24; // tiles its villages keep in from its edges (half their spacing, and room for lanes and fields)
const PLACE_MARGIN = 8; // and its ruins and camps
const LOW_AROUND = 18; // of the 25 tiles round a low tile, at least so many low too, for it to flood (no puddles)
const SPAWN_DRY = 48; // tiles round where the hero sets out never flooded (never an islet to start on)
const CROSSING_IN = 96; // tiles a border's crossing keeps from its ends (the corners, where four regions meet)
const CROSSING_SLIDE = 64; // tiles either way from its chosen spot it may slide, to dry ground on both sides

// One region of a streamed world: where it is (its first tile), its tiles, and all on it, in world tiles. Its roads'
// `from` and `to` are its own villages', by index.
export interface RegionLand {
  rx: number;
  rz: number;
  x0: number;
  z0: number;
  tiles: TilePatch;
  trails: Array<Array<[number, number]>>;
  roads: Road[];
  villages: Village[];
  houses: House[];
  buildings: Building[];
  fields: Field[];
  ruins: Ruin[];
  camps: Camp[];
  trees: Tree[];
  bushes: Bush[];
  towns?: Town[]; // the cathedral town, if it's this region's (none: a classic world's)
}

const regionSeed = (seed: number, rx: number, rz: number): number => hashCell(rx * 7919 + 13, rz * 104729 + 7, seed);

// The world's own: its terrain noise, and how lake-prone it is (drawn as a classic world's are: world.ts).
function worldNature(seed: number): { noise2D: (x: number, y: number) => number; lakeThreshold: number } {
  const rng = mulberry32(seed);
  const noise2D = createNoise2D(rng);
  return { noise2D, lakeThreshold: LAKE_THRESHOLD_MIN + rng() * (LAKE_THRESHOLD_MAX - LAKE_THRESHOLD_MIN) };
}

// Its ground and lakes, with APRON round it: heights smoothed from the last pass each pass (from the ground round each
// tile only), low ground flooded by the lake noise, deep dry tiles by water raised to its banks.
export function regionGround(seed: number, x0: number, z0: number, width: number, depth: number, size: MapSize): { heightMap: number[][]; lakeMap: boolean[][] } {
  const { noise2D, lakeThreshold } = worldNature(seed);
  const [w, d] = [width + 2 * APRON, depth + 2 * APRON];
  let h = generateHeightMap(noise2D, { width: w, depth: d }, { x: x0 - APRON, z: z0 - APRON });
  for (let pass = 0; pass < PASSES; pass++) h = smoothedOnce(h);
  const spawn = spawnOf(size);
  const low = (u: number, v: number) => h[u]?.[v] !== undefined && h[u][v] <= WATER_LEVEL;
  const lake: boolean[][] = h.map((row) => row.map(() => false));
  for (let u = 2; u < w - 2; u++) {
    for (let v = 2; v < d - 2; v++) {
      if (!low(u, v)) continue;
      const [wx, wz] = [x0 - APRON + u, z0 - APRON + v];
      if (Math.hypot(wx - spawn.x, wz - spawn.z) < SPAWN_DRY) continue;
      if (noise2D(wx / LAKE_NOISE_SCALE + 500, wz / LAKE_NOISE_SCALE + 500) <= lakeThreshold) continue;
      let around = 0;
      for (let du = -2; du <= 2; du++) for (let dv = -2; dv <= 2; dv++) if (low(u + du, v + dv)) around++;
      lake[u][v] = around >= LOW_AROUND;
    }
  }
  for (let u = 1; u < w - 1; u++) {
    for (let v = 1; v < d - 1; v++) {
      if (lake[u][v] || h[u][v] >= WATER_LEVEL) continue;
      let byWater = false;
      for (let du = -1; du <= 1 && !byWater; du++) for (let dv = -1; dv <= 1 && !byWater; dv++) byWater = lake[u + du][v + dv];
      if (byWater) h[u][v] = WATER_LEVEL; // (a bank: never a pit below the water line beside it)
    }
  }
  const crop = <T>(map: T[][]) => map.slice(APRON, APRON + width).map((row) => row.slice(APRON, APRON + depth));
  return { heightMap: crop(h), lakeMap: crop(lake) };
}

// Where the road crosses the border along `line` (between its tiles line - 1 and line, across x or across z), on its
// run of `length` tiles from `from`: how far along it, or null (water all along there). Dry ground straight across
// it, as far either side as its roads run straight in; its ground made just for those tiles, as each region's own is
// (so the same from either side).
export function crossingOn(seed: number, across: 'x' | 'z', line: number, from: number, length: number, size: MapSize): number | null {
  const span = length - 2 * CROSSING_IN;
  if (span <= 0) return null;
  const deep = STRAIGHT_IN + 1; // (tiles either side)
  const { lakeMap } = across === 'x' ? regionGround(seed, line - deep, from, 2 * deep, length, size) : regionGround(seed, from, line - deep, length, 2 * deep, size);
  const dry = (at: number) => {
    for (let i = 0; i < 2 * deep; i++) if (across === 'x' ? lakeMap[i][at] : lakeMap[at][i]) return false;
    return true;
  };
  const chosen = CROSSING_IN + (hashCell(line, from, seed ^ (across === 'x' ? 0x5eed : 0xb0de)) % span);
  for (let step = 0; step <= CROSSING_SLIDE; step++) {
    for (const at of [chosen + step, chosen - step]) if (at >= 0 && at < length && dry(at)) return at;
  }
  return null;
}

// Its side of each of its borders' crossings (those within the world), on its own maps.
export function crossingsOf(seed: number, rx: number, rz: number, width: number, depth: number, size: MapSize): Array<[number, number]> {
  const [x0, z0] = [rx * REGION, rz * REGION];
  const out: Array<[number, number]> = [];
  const add = (at: number | null, tile: (at: number) => [number, number]) => at !== null && out.push(tile(at));
  if (x0 > 0) add(crossingOn(seed, 'x', x0, z0, depth, size), (at) => [0, at]);
  if (x0 + width < size.width) add(crossingOn(seed, 'x', x0 + width, z0, depth, size), (at) => [width - 1, at]);
  if (z0 > 0) add(crossingOn(seed, 'z', z0, x0, width, size), (at) => [at, 0]);
  if (z0 + depth < size.depth) add(crossingOn(seed, 'z', z0 + depth, x0, width, size), (at) => [at, depth - 1]);
  return out;
}

// One smoothing pass, every tile from the last pass's ground (so each depends only on those round it): within a tier
// of each of its four neighbours, else halfway between the two most apart.
function smoothedOnce(map: number[][]): number[][] {
  const [w, d] = [map.length, map[0].length];
  return map.map((row, x) =>
    row.map((h, z) => {
      let [lowest, highest] = [Infinity, -Infinity];
      for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
        if (nx < 0 || nz < 0 || nx >= w || nz >= d) continue;
        const n = map[nx][nz];
        [lowest, highest] = [Math.min(lowest, n), Math.max(highest, n)];
      }
      const [from, to] = [highest - 1, lowest + 1];
      return Math.min(MAX_TIER, from <= to ? Math.min(to, Math.max(from, h)) : Math.round((lowest + highest) / 2));
    }),
  );
}

// The region at (rx, rz) of a world of `size` (made the same every time from `seed`).
export function generateRegionLand(seed: number, rx: number, rz: number, size: MapSize = STREAMED_SIZE): RegionLand {
  const [x0, z0] = [rx * REGION, rz * REGION];
  const [width, depth] = [Math.min(REGION, size.width - x0), Math.min(REGION, size.depth - z0)];
  const { heightMap, lakeMap } = regionGround(seed, x0, z0, width, depth, size);
  const surfaceMap: Surface[][] = heightMap.map((row) => row.map((): Surface => 'natural'));
  const own = regionSeed(seed, rx, rz);
  const rng = mulberry32(own);
  const world = spawnOf(size);
  const spawn = { x: world.x - x0, z: world.z - z0 }; // (on its maps: off them, but in the spawn's own region)
  const atSpawn = spawn.x >= 0 && spawn.z >= 0 && spawn.x < width && spawn.z < depth;

  const { villages, houses, buildings } = generateVillages(heightMap, lakeMap, surfaceMap, rng, spawn.x, spawn.z, VILLAGE_MARGIN);
  const site = townOnRegion(seed, size, rx, rz);
  const town = site && raiseTown(seed, { x: site.x - x0, z: site.z - z0 }, { heightMap, lakeMap, surfaceMap, villages, houses, buildings });
  const solid = solidCells({ houses, buildings, villages });
  if (town) for (const key of townSolids(town)) solid.add(key);
  const grid = { heightMap, lakeMap, surfaceMap, solidCells: solid };
  const trail = atSpawn ? generateSpawnTrail(grid, villages, spawn.x, spawn.z) : null;
  const roads = linkVillages(grid, villages);
  const fields = generateFields(heightMap, lakeMap, surfaceMap, solid, town ? villages.filter((v) => !v.town) : villages); // (no crops inside the town's walls)
  const cleared = new Set<string>();
  if (town) for (let x = town.x - TOWN_REACH; x <= town.x + TOWN_REACH; x++) for (let z = town.z - TOWN_REACH; z <= town.z + TOWN_REACH; z++) cleared.add(cellKey(x, z)); // (no ruin, camp, tree nor bush on it)
  const inside = (x: number, z: number) => x >= PLACE_MARGIN && z >= PLACE_MARGIN && x < width - PLACE_MARGIN && z < depth - PLACE_MARGIN;
  const isOpenTile = (x: number, z: number) => inside(x, z) && !lakeMap[x][z] && !solid.has(cellKey(x, z)) && !cleared.has(cellKey(x, z));
  const tiles = mapsAsTiles({ heightMap, lakeMap, surfaceMap });
  const local = { width, depth };
  const ruins = placeRuins({ seed: own, size: local, tiles, villages, isOpenTile, spawn });
  const clear = (xa: number, za: number, xb: number, zb: number) => {
    for (let x = xa; x <= xb; x++) for (let z = za; z <= zb; z++) cleared.add(cellKey(x, z));
  };
  for (const r of ruins) clear(r.x - 1, r.z - 1, r.x + r.w, r.z + r.d);
  const forestAt = createForestDensity(seed);
  const forest = (x: number, z: number) => forestAt(x + x0, z + z0);
  const camps = placeCamps({ seed: own, size: local, tiles, villages, forest, isOpenTile, spawn });
  for (const c of camps) clear(c.x - 3, c.z - 3, c.x + 3, c.z + 3);
  const origin = { x: x0, z: z0 };
  const grown = generateTrees(heightMap, lakeMap, surfaceMap, solid, rng, forestAt, spawn.x, spawn.z, origin);
  const trees = grown.filter((t) => !cleared.has(cellKey(Math.round(t.x), Math.round(t.z))));
  const bushes = generateBushes(heightMap, lakeMap, surfaceMap, solid, grown, createMeadowDensity(seed), spawn.x, spawn.z, origin).filter((b) => !cleared.has(cellKey(b.x, b.z)));
  // The roads on into the next regions, last (all before as it ever was): what stood on them felled.
  const onward = roadsToBorders(grid, villages, roads, crossingsOf(seed, rx, rz, width, depth, size), (x, z) => cleared.has(cellKey(x, z)));
  const onWays = new Set(onward.flatMap((way) => way.map(([x, z]) => cellKey(x, z))));
  const offWays = <T extends { x: number; z: number }>(things: T[]) => (onWays.size === 0 ? things : things.filter((t) => !onWays.has(cellKey(Math.round(t.x), Math.round(t.z)))));

  const at = <T extends { x: number; z: number }>(o: T): T => ({ ...o, x: o.x + x0, z: o.z + z0 });
  const tile = ([x, z]: readonly [number, number]): [number, number] => [x + x0, z + z0];
  return {
    rx,
    rz,
    x0,
    z0,
    tiles: TilePatch.fromMaps(size, x0, z0, { heightMap, lakeMap, surfaceMap }),
    trails: [...(trail ? [trail] : []), ...onward].map((way) => way.map(tile)),
    roads: roads.map((r) => ({ ...r, route: r.route.map(tile) })),
    villages: villages.map(at),
    houses: houses.map(at),
    buildings: buildings.map((b) => ({ ...at(b), tiles: b.tiles.map(tile) })),
    fields: fields.map((f) => ({ ...f, x0: f.x0 + x0, z0: f.z0 + z0, gate: tile(f.gate), corner: tile(f.corner) })),
    ruins: ruins.map((r) => ({ ...at(r), way: at(r.way), pieces: r.pieces.map(at) })),
    camps: camps.map((c) => ({ ...at(c), way: at(c.way), pieces: c.pieces.map(at) })),
    trees: offWays(trees).map(at),
    bushes: offWays(bushes).map(at),
    towns: town ? [{ ...at(town), walls: town.walls.map(at), stalls: town.stalls.map(at) }] : [],
  };
}
