// The cathedral town (model/town/): one to every streamed world, at a level-12 village's distance, on its own region;
// raised on a hill with its walls, gates, streets, square, stalls, inn, smithy, cathedral and houses; roads in through
// its gates; every door and stall walked to from every gate; none in a classic world (an old save's, a test world's).
import { describe, expect, it } from 'vitest';
import { generateRegionLand, REGION, STREAMED_SIZE, type RegionLand } from '../src/model/worldgen/regions';
import { townSite, REACH } from '../src/model/town/townSite';
import { GATES, PLATEAU, SQUARE, WALL, townPlan } from '../src/model/town/townPlan';
import { townSolids } from '../src/model/town/townLand';
import { zoneLevel } from '../src/model/enemies/enemyLevels';
import { solidCells } from '../src/model/worldgen/world';
import { entrancesOf, roomFor, type Entrance } from '../src/model/interiors/interiors';
import { furnish } from '../src/model/interiors/furnish';
import { BISHOP, NAVE, RELIQUARY_STAIR } from '../src/model/cathedral/cathedralLayout';
import { chartOfLand } from '../src/model/atlas/chart';
import { MAX_TIER } from '../src/model/constants';
import { cellKey, spawnOf } from '../src/model/map/grid';
import { REACH as LANES } from '../src/model/worldgen/roads';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const lands = new Map<number, RegionLand>();
const landOf = (seed: number) => {
  const site = townSite(seed, STREAMED_SIZE)!;
  return lands.get(seed) ?? lands.set(seed, generateRegionLand(seed, Math.floor(site.x / REGION), Math.floor(site.z / REGION))).get(seed)!;
};
const chebyshev = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

describe('the cathedral town', () => {
  it('stands in every streamed world, a level-12 place, off the region the hero sets out in; none in a classic world', () => {
    const spawn = spawnOf(STREAMED_SIZE);
    for (const seed of TEST_SEEDS) {
      const site = townSite(seed, STREAMED_SIZE)!;
      expect(site).not.toBeNull();
      expect(zoneLevel(spawn, site)).toBe(12);
      expect([Math.floor(site.x / REGION), Math.floor(site.z / REGION)]).not.toEqual([Math.floor(spawn.x / REGION), Math.floor(spawn.z / REGION)]);
      for (const v of [site.x % REGION, site.z % REGION]) expect(v > REACH && v < REGION - REACH).toBe(true);
    }
    expect(townSite(1, TEST_MAP_SIZE)).toBeNull();
    expect(townSite(1, { width: 2048, depth: 2048 })).toBeNull();
  });

  it('is one of its region\'s villages, on a hilltop of the highest tier, its slope a tier a tile at most, dry', () => {
    for (const seed of TEST_SEEDS) {
      const land = landOf(seed);
      const site = townSite(seed, STREAMED_SIZE)!;
      const towns = land.villages.filter((v) => v.town);
      expect(towns).toEqual([{ x: site.x, z: site.z, groundTier: MAX_TIER, town: true }]);
      expect(land.towns).toHaveLength(1);
      for (const v of land.villages) if (!v.town) expect(chebyshev(v, site)).toBeGreaterThan(REACH + LANES);
      const { tiles } = land;
      for (let x = site.x - REACH - 1; x <= site.x + REACH; x++) {
        for (let z = site.z - REACH - 1; z <= site.z + REACH; z++) {
          if (chebyshev({ x, z }, site) <= PLATEAU) expect(tiles.height(x, z)).toBe(MAX_TIER);
          if (chebyshev({ x, z }, site) <= REACH) expect(tiles.lake(x, z)).toBe(false);
          expect(Math.abs(tiles.height(x, z) - tiles.height(x + 1, z))).toBeLessThanOrEqual(1);
          expect(Math.abs(tiles.height(x, z) - tiles.height(x, z + 1))).toBeLessThanOrEqual(1);
        }
      }
      expect(land.trees.some((t) => chebyshev(t, site) <= REACH)).toBe(false);
    }
  }, 60_000);

  it('is walled, its gates open, its square and streets paved, nothing standing on them', () => {
    for (const seed of TEST_SEEDS) {
      const land = landOf(seed);
      const site = townSite(seed, STREAMED_SIZE)!;
      const town = land.towns![0];
      expect(town.walls).toHaveLength(8 * WALL);
      expect(town.walls.filter((w) => w.piece === 'gate').map((w) => [w.x - site.x, w.z - site.z])).toEqual(expect.arrayContaining(GATES.map((g) => [...g])));
      const solid = new Set([...solidCells(land), ...townSolids(town)]);
      for (const [gx, gz] of GATES) expect(solid.has(cellKey(site.x + gx, site.z + gz))).toBe(false);
      for (const [dx, dz] of townPlan(seed).streets) {
        expect(land.tiles.surface(site.x + dx, site.z + dz)).toBe('path');
        expect(solid.has(cellKey(site.x + dx, site.z + dz))).toBe(false);
      }
      for (let dx = -SQUARE; dx <= SQUARE; dx++) for (let dz = -SQUARE; dz <= SQUARE; dz++) expect(land.tiles.surface(site.x + dx, site.z + dz)).toBe('plaza');
      expect(land.buildings.filter((b) => chebyshev(b, site) <= WALL).map((b) => b.kind).sort()).toEqual(['cathedral', 'inn', 'smithy']);
      expect(land.houses.filter((h) => chebyshev(h, site) < WALL).length).toBeGreaterThan(20);
    }
  }, 60_000);

  it('has every door and stall walked to from every gate, and a road in through a gate', () => {
    for (const seed of TEST_SEEDS) {
      const land = landOf(seed);
      const site = townSite(seed, STREAMED_SIZE)!;
      const town = land.towns![0];
      const solid = new Set([...solidCells(land), ...townSolids(town)]);
      const open = (x: number, z: number) => chebyshev({ x, z }, site) <= WALL && !solid.has(cellKey(x, z));
      for (const [gx, gz] of GATES) {
        const seen = new Set<string>();
        const todo: Array<[number, number]> = [[site.x + gx, site.z + gz]];
        while (todo.length > 0) {
          const [x, z] = todo.pop()!;
          if (seen.has(cellKey(x, z)) || !open(x, z)) continue;
          seen.add(cellKey(x, z));
          todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
        }
        const doors = entrancesOf(land.houses, land.buildings).filter((e) => chebyshev(e, site) <= WALL);
        for (const door of doors) expect(seen.has(cellKey(Math.round(door.x), Math.round(door.z))), `${seed}: ${door.type} at ${door.x},${door.z}`).toBe(true);
        for (const s of town.stalls) expect(seen.has(cellKey(s.x + s.front[0], s.z + s.front[1]))).toBe(true);
      }
      expect(chartOfLand(seed, STREAMED_SIZE, land).villages.filter((v) => v.town)).toEqual([{ x: site.x, z: site.z, town: true }]); // (marked on the map as the cathedral town)
      const ways = [...land.roads.map((r) => r.route), ...land.trails];
      const gates = GATES.map(([gx, gz]) => cellKey(site.x + gx, site.z + gz));
      expect(ways.some((route) => route.some(([x, z]) => gates.includes(cellKey(x, z))))).toBe(true);
    }
  }, 60_000);
});

describe('the cathedral within', () => {
  const door: Entrance = { type: 'cathedral', x: 4100.5, z: 3900.62, outX: 0, outZ: 1 };
  const room = roomFor(7, door);
  const pieces = furnish(7, door, room);
  const at = (kind: string) => pieces.filter((p) => p.kind === kind);

  it('has its nave, its altar at the far end on the door\'s line, the reliquary\'s stair and the bishop\'s quarters', () => {
    expect([room.width, room.door]).toEqual([NAVE, Math.floor(NAVE / 2)]);
    expect(at('altar')).toEqual([expect.objectContaining({ x: room.door - 1, z: 0, w: 3 })]);
    expect(at('reliquaryStair')).toEqual([expect.objectContaining({ x: RELIQUARY_STAIR[0], z: RELIQUARY_STAIR[1], w: 2, d: 2 })]);
    expect(at('pew').length).toBe(8);
    expect(at('hallDoor')).toEqual([expect.objectContaining({ open: true })]); // (walked through: bumpsFurniture)
    expect(at('doubleBed')[0].x).toBeGreaterThanOrEqual(BISHOP.x0);
  });

  it('has nothing on top of anything, and every tile walked to from the door (the bishop\'s through his)', () => {
    const taken = new Set<string>();
    for (const p of pieces.filter((f) => f.solid && f.kind !== 'hallDoor')) {
      for (let x = p.x; x < p.x + p.w; x++) for (let z = p.z; z < p.z + p.d; z++) {
        expect(taken.has(`${x},${z}`), `${p.kind} at ${x},${z}`).toBe(false);
        taken.add(`${x},${z}`);
      }
    }
    const seen = new Set<string>();
    const todo: Array<[number, number]> = [[room.door, room.depth - 1]];
    while (todo.length > 0) {
      const [x, z] = todo.pop()!;
      if (x < 0 || z < 0 || x >= room.width || z >= room.depth || seen.has(`${x},${z}`) || taken.has(`${x},${z}`)) continue;
      seen.add(`${x},${z}`);
      todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }
    const inner = pieces.filter((f) => f.kind === 'hallWall'); // (a screen stands at its tile's edge: its tile's floor is the aisle's)
    for (let x = 0; x < room.width; x++) for (let z = 0; z < room.depth; z++) if (!taken.has(`${x},${z}`)) expect(seen.has(`${x},${z}`), `${x},${z}`).toBe(true);
    expect(inner.length).toBeGreaterThan(0);
  });
});
