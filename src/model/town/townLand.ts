// The cathedral town raised on its region's land (worldgen/regions.ts), after its villages are placed as they ever were
// (so every other village is as it was): those too near it let go (their houses, buildings and lanes with them), the
// ground under it raised to a hilltop (the highest tier, its slope down a tier a tile to the land round it, never
// below the water: its lakes drained), its streets and square paved (and a road out of each gate, down the hill), its buildings and houses stood on it, and the
// town itself one of the region's villages, the last (`town`: its well its square's middle, as any village's). Its
// walls and stalls handed back, to stand on it (solid: townWalls.ts).

import { MAX_TIER, WATER_LEVEL } from '../constants';
import { cellKey } from '../map/grid';
import { REACH as LANES } from '../worldgen/roads';
import type { Building, BuildingKind, House, Surface, Village } from '../types';
import { GATES, PLATEAU, SQUARE, WALL, townPlan, type StallKind, type WallPiece } from './townPlan';
import { REACH, type TownSite } from './townSite';

const LET_GO = REACH + LANES + 2; // tiles (each way) from its well a village's well may not be: its lanes and houses off its slope

// The town as it stands, in world tiles: its well, its hilltop's tier, its walls and stalls.
export interface Town {
  x: number;
  z: number;
  groundTier: number;
  walls: Array<{ x: number; z: number; piece: WallPiece; quarterTurns: number }>;
  stalls: Array<{ x: number; z: number; kind: StallKind; front: [number, number] }>;
}

interface Land {
  heightMap: number[][];
  lakeMap: boolean[][];
  surfaceMap: Surface[][];
  villages: Village[];
  houses: House[];
  buildings: Building[];
}

const chebyshev = (a: { x: number; z: number }, x: number, z: number) => Math.max(Math.abs(a.x - x), Math.abs(a.z - z));
const facing = ([dx, dz]: readonly [number, number]) => Math.atan2(-dx, -dz); // (a house's turn, its door that way: villages.ts)
const quarters = (rotationY: number) => ((Math.round(rotationY / (Math.PI / 2)) % 4) + 4) % 4;

// The town raised at `site` (on the land's own maps), changing `land` in place; the town handed back.
export function raiseTown(seed: number, site: TownSite, land: Land): Town {
  const { heightMap, lakeMap, surfaceMap } = land;
  const tier = MAX_TIER;
  // The villages too near, let go, and all of theirs.
  const gone = land.villages.filter((v) => chebyshev(v, site.x, site.z) <= LET_GO);
  const theirs = (p: { x: number; z: number }) => gone.some((v) => chebyshev(v, p.x, p.z) <= LANES);
  for (const v of gone) {
    for (let x = v.x - LANES; x <= v.x + LANES; x++) for (let z = v.z - LANES; z <= v.z + LANES; z++) if (surfaceMap[x]?.[z] === 'path' || surfaceMap[x]?.[z] === 'plaza') surfaceMap[x][z] = 'natural';
  }
  replace(land.villages, land.villages.filter((v) => !gone.includes(v)));
  replace(land.houses, land.houses.filter((h) => !theirs(h)));
  replace(land.buildings, land.buildings.filter((b) => !theirs(b)));

  // The hill: its top flat out to PLATEAU, then down a tier a tile to the ground round it (never below the water there).
  for (let x = site.x - REACH; x <= site.x + REACH; x++) {
    for (let z = site.z - REACH; z <= site.z + REACH; z++) {
      const out = Math.max(0, chebyshev(site, x, z) - PLATEAU);
      heightMap[x][z] = Math.max(heightMap[x][z], tier - out, WATER_LEVEL);
      lakeMap[x][z] = false;
      surfaceMap[x][z] = 'natural';
    }
  }

  const plan = townPlan(seed);
  const at = (dx: number, dz: number): [number, number] => [site.x + dx, site.z + dz];
  for (let dx = -SQUARE; dx <= SQUARE; dx++) for (let dz = -SQUARE; dz <= SQUARE; dz++) surfaceMap[site.x + dx][site.z + dz] = 'plaza';
  for (const [dx, dz] of plan.streets) surfaceMap[site.x + dx][site.z + dz] = 'path';
  for (const [gx, gz] of GATES) for (let i = WALL + 1; i <= REACH; i++) surfaceMap[site.x + Math.sign(gx) * i][site.z + Math.sign(gz) * i] = 'path'; // (a road out of each gate, down the hill: the roads in come up it)
  const building = (kind: BuildingKind, { tiles, door }: { tiles: Array<[number, number]>; door: [number, number] }): Building => {
    const xs = tiles.map(([dx]) => dx);
    const zs = tiles.map(([, dz]) => dz);
    return {
      kind,
      x: site.x + (Math.min(...xs) + Math.max(...xs)) / 2,
      z: site.z + (Math.min(...zs) + Math.max(...zs)) / 2,
      tiles: tiles.map(([dx, dz]) => at(dx, dz)),
      groundTier: tier,
      quarterTurns: quarters(facing(door)),
    };
  };
  land.buildings.push(building('inn', plan.inn), building('smithy', plan.smithy), building('cathedral', plan.cathedral));
  for (const h of plan.houses) land.houses.push({ x: site.x + h.dx, z: site.z + h.dz, groundTier: tier, rotationY: facing(h.door) });
  land.villages.push({ x: site.x, z: site.z, groundTier: tier, town: true });
  return {
    x: site.x,
    z: site.z,
    groundTier: tier,
    walls: plan.walls.map((w) => ({ x: site.x + w.dx, z: site.z + w.dz, piece: w.piece, quarterTurns: w.quarterTurns })),
    stalls: plan.stalls.map((s) => ({ x: site.x + s.dx, z: site.z + s.dz, kind: s.kind, front: s.front })),
  };
}

// The tiles of the town nothing can walk through: its walls (but its gates) and its stalls.
export function townSolids(town: Town): string[] {
  return [...town.walls.filter((w) => w.piece !== 'gate'), ...town.stalls].map((p) => cellKey(p.x, p.z));
}

// `list` made `items`, in place.
function replace<T>(list: T[], items: readonly T[]): void {
  list.length = 0;
  for (const item of items) list.push(item);
}
