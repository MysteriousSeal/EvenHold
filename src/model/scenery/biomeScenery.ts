// The country's own landmarks (model/scenery/biomes.ts), a few in sight wherever that country is, one to a site: a
// dead tree standing grey on the heath, a willow or a dead tree in the marsh, on the hills granite tors and boulders
// in three sizes (a lone boulder, an outcrop, a tor). Placed last of all on the land (liveWorld.ts:
// after the strongholds and their signposts, the foes and the animals), so nothing placed before them is moved: every
// tree, village, road, camp, dungeon, lake, foe and animal where it ever was. Each from the seed's hashes, on open,
// dry, natural, level ground with a tile clear round it (never walling a way off), well off the villages and where the
// hero sets out, never on a foe or an animal. Each blocks the way (scenery.ts addSceneryObstacles).

import { hashUnit } from '../../util/random';
import { VILLAGE_OUTER_RADIUS, LANE_LENGTH_MAX } from '../constants';
import { inArea, type Area } from '../map/grid';
import type { Tiles } from '../map/tiles';
import type { Village } from '../types';
import { createBiomes, type Biome } from './biomes';
import { sceneryTiles, type Scenery, type SceneryKind } from './scenery';

const SITE = 9; // tiles a side of each candidate site
const SITE_CHANCE = 0.8;
const VILLAGE_CLEAR = VILLAGE_OUTER_RADIUS + LANE_LENGTH_MAX + 4; // (as scenery.ts keeps)
const SPAWN_CLEAR = 8;
const STOOD_CLEAR = 2; // tiles off a foe or an animal

export interface BiomeSceneryWorld {
  seed: number;
  tiles: Tiles;
  villages: readonly Village[];
  hero: { x: number; z: number };
  stood: ReadonlyArray<{ x: number; z: number }>; // the foes and the animals
  scenery: readonly Scenery[]; // what's set down already
  isOpenTile(x: number, z: number): boolean; // nothing on it (all placed before: obstacles.ts)
}

// What each country has, by a roll (none: nothing there).
function kindFor(country: Biome, roll: number): SceneryKind | null {
  if (country === 'marsh') return roll < 0.5 ? 'willow' : roll < 0.75 ? 'snag' : null;
  if (country === 'heath') return roll < 0.35 ? 'snag' : null;
  if (country === 'hills') return roll < 0.3 ? 'tor' : roll < 0.55 ? 'boulder' : roll < 0.75 ? 'outcrop' : null;
  return null;
}

export function placeBiomeScenery(world: BiomeSceneryWorld, area: Area): Scenery[] {
  const { seed, tiles } = world;
  const biomes = createBiomes(seed, tiles);
  const taken = new Set(world.scenery.flatMap((s) => sceneryTiles(s).map(([x, z]) => `${x},${z}`)));
  const near = (x: number, z: number, list: ReadonlyArray<{ x: number; z: number }>, r: number) => list.some((p) => Math.abs(p.x - x) <= r && Math.abs(p.z - z) <= r);
  const open = (x: number, z: number) => tiles.has(x, z) && inArea(area, x, z) && world.isOpenTile(x, z) && tiles.surface(x, z) === 'natural';
    // Its footprint open and level, a tile round it no other piece's and on natural ground (never against a road, a
  // field or a wall; a tree beside it is no matter, the woods stand thin).
  const fits = (x: number, z: number, w: number, d: number) => {
    const tier = tiles.height(x, z);
    for (let i = x - 1; i <= x + w; i++) for (let k = z - 1; k <= z + d; k++) {
      const inside = i >= x && i < x + w && k >= z && k < z + d;
      if (taken.has(`${i},${k}`) || !tiles.has(i, k) || tiles.surface(i, k) !== 'natural') return false;
      if (inside && (!open(i, k) || tiles.height(i, k) !== tier)) return false;
    }
    return true;
  };
  const out: Scenery[] = [];
  for (let gx = Math.floor(area.x0 / SITE); gx * SITE < area.x1; gx++) {
    for (let gz = Math.floor(area.z0 / SITE); gz * SITE < area.z1; gz++) {
      if (hashUnit(gx, gz, seed + 531) >= SITE_CHANCE) continue;
      const x = Math.floor(gx * SITE + 2 + hashUnit(gx, gz, seed + 532) * (SITE - 5));
      const z = Math.floor(gz * SITE + 2 + hashUnit(gx, gz, seed + 533) * (SITE - 5));
      if (!tiles.has(x, z) || !inArea(area, x, z)) continue;
      const kind = kindFor(biomes.at(x, z), hashUnit(gx, gz, seed + 534));
      if (!kind) continue;
      const [w, d] = kind === 'tor' || kind === 'outcrop' ? [2, 2] : [1, 1];
      if (Math.hypot(x - world.hero.x, z - world.hero.z) < SPAWN_CLEAR || near(x, z, world.villages, VILLAGE_CLEAR) || near(x, z, world.stood, STOOD_CLEAR + w)) continue;
      if (!fits(x, z, w, d)) continue;
      const piece: Scenery = { kind, x, z, w, d, quarterTurns: Math.floor(hashUnit(x, z, seed + 535) * 4), variant: Math.floor(hashUnit(gx, gz, seed + 536) * 4) };
      for (const [i, k] of sceneryTiles(piece)) taken.add(`${i},${k}`);
      out.push(piece);
    }
  }
  return out;
}
