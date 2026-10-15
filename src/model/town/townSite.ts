// Where a world's cathedral town stands: one to a world, TOWN_DISTANCE tiles from where the hero sets out (a place of
// TOWN_LEVEL: enemies/enemyLevels.ts zoneLevel), its way round from there from the seed. Only a streamed world has one
// (a classic world, an old save's, made as it ever was: no room in a test world's either). Worked out from the seed
// alone, cheaply (the map, a quest, the region it's on all ask before its land is made): the spot round that circle
// first found whose town and the slope up to it (REACH) keep MARGIN clear of its region's edges (all its own region's:
// worldgen/regions.ts), never the region the hero sets out in.

import { hashUnit } from '../../util/random';
import { spawnOf, type MapSize } from '../map/grid';
import { REGION } from '../worldgen/regions';
import { PLATEAU } from './townPlan';

export const TOWN_LEVEL = 12;
export const TOWN_DISTANCE = (TOWN_LEVEL - 0.5) * 50; // tiles from where the hero sets out (zoneLevel's 50 a level: its middle)
const CLASSIC_MOST = 4096; // (GameModel's: a world no bigger a side is made whole, a classic one: no town)
export const SLOPE = 4; // tiles of slope down from its hilltop (at most a tier a tile, from the highest ground)
export const REACH = PLATEAU + SLOPE; // tiles from its well that it and its slope cover (each way)
const MARGIN = REACH + 24; // tiles its well keeps from its region's edges (its slope clear of them, and room for its roads)
const TRIES = 72; // spots round the circle looked at

export interface TownSite {
  x: number;
  z: number;
}

const sites = new Map<string, TownSite | null>();

// The town of the world of `seed` and `size`, or null (a classic world's).
export function townSite(seed: number, size: MapSize): TownSite | null {
  const key = `${seed},${size.width},${size.depth}`;
  if (sites.has(key)) return sites.get(key)!;
  let found: TownSite | null = null;
  if (Math.max(size.width, size.depth) > CLASSIC_MOST) {
    const spawn = spawnOf(size);
    const start = hashUnit(seed % 1_000_003, 7, 9161) * Math.PI * 2;
    const own = (v: number) => v - Math.floor(v / REGION) * REGION; // (where in its region)
    for (let i = 0; i < TRIES && !found; i++) {
      const turn = start + (i * Math.PI * 2) / TRIES;
      const [x, z] = [Math.round(spawn.x + Math.cos(turn) * TOWN_DISTANCE), Math.round(spawn.z + Math.sin(turn) * TOWN_DISTANCE)];
      const clear = [own(x), own(z)].every((v) => v >= MARGIN && v < REGION - MARGIN);
      const home = Math.floor(x / REGION) === Math.floor(spawn.x / REGION) && Math.floor(z / REGION) === Math.floor(spawn.z / REGION);
      if (clear && !home) found = { x, z };
    }
  }
  sites.set(key, found);
  return found;
}

// Whether the town of that world stands on region (rx, rz).
export const townOnRegion = (seed: number, size: MapSize, rx: number, rz: number): TownSite | null => {
  const site = townSite(seed, size);
  return site && Math.floor(site.x / REGION) === rx && Math.floor(site.z / REGION) === rz ? site : null;
};

// Whether (x, z) is on the town or its slope (in tiles, each way).
export const onTown = (site: TownSite | null, x: number, z: number, within = REACH): boolean => !!site && Math.abs(x - site.x) <= within && Math.abs(z - site.z) <= within;
