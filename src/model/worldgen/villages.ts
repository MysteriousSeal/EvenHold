// Village layout, grown like a medieval village: an open market square
// with the well at its center, lined by the inn, the blacksmith and a few
// houses facing in; dirt lanes leaving the square (mostly straight, the odd
// jog); and houses fronting the lanes on both sides, doors onto the lane,
// with garden gaps between them. Runs before trails, fields and trees,
// which all avoid what it places.

import {
  VILLAGE_MIN_COUNT,
  VILLAGE_MAX_COUNT,
  VILLAGE_FLAT_RADIUS,
  VILLAGE_OUTER_RADIUS,
  VILLAGE_MIN_DIST_FROM_SPAWN,
  VILLAGE_MIN_DIST_BETWEEN,
  VILLAGE_MAP_MARGIN,
  VILLAGE_COUNT_AREA,
  LANE_LENGTH_MIN,
  LANE_LENGTH_MAX,
  LANE_HOUSE_CHANCE,
  SQUARE_HOUSE_CHANCE,
} from '../constants';
import { NEIGHBORS_4, cellKey, inBounds, sizeOf, type MapSize } from '../grid';
import { shuffle } from '../../util/random';
import type { Building, BuildingKind, House, Surface, Village } from '../types';

interface Offset {
  dx: number;
  dz: number;
}

interface Site {
  x: number;
  z: number;
}

// A lane: its tiles from the square outward, each with the direction the
// lane runs there (houses front it from either side of that direction).
interface Lane {
  tiles: Array<{ x: number; z: number; dir: Offset }>;
}

const R = VILLAGE_OUTER_RADIUS;

// The whole square needs level, dry ground.
function isFlatDrySite(heightMap: number[][], lakeMap: boolean[][], cx: number, cz: number): boolean {
  const tier = heightMap[cx][cz];
  for (let dx = -VILLAGE_FLAT_RADIUS; dx <= VILLAGE_FLAT_RADIUS; dx++) {
    for (let dz = -VILLAGE_FLAT_RADIUS; dz <= VILLAGE_FLAT_RADIUS; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      if (!inBounds(sizeOf(heightMap), x, z) || lakeMap[x][z] || heightMap[x][z] !== tier) return false;
    }
  }
  return true;
}

// Scans once for every valid site rather than guessing random coordinates:
// flat dry patches can be sparse, and rejection sampling with a fixed
// attempt budget silently misses them.
function findCandidateSites(heightMap: number[][], lakeMap: boolean[][], spawnX: number, spawnZ: number): Site[] {
  const candidates: Site[] = [];
  const size = sizeOf(heightMap);
  for (let x = VILLAGE_MAP_MARGIN; x < size.width - VILLAGE_MAP_MARGIN; x++) {
    for (let z = VILLAGE_MAP_MARGIN; z < size.depth - VILLAGE_MAP_MARGIN; z++) {
      if (Math.hypot(x - spawnX, z - spawnZ) < VILLAGE_MIN_DIST_FROM_SPAWN) continue;
      if (isFlatDrySite(heightMap, lakeMap, x, z)) candidates.push({ x, z });
    }
  }
  return candidates;
}

// Y rotation that turns a building's local -Z (its door side) toward `dir`.
function rotationFacing(dir: Offset): number {
  return Math.atan2(-dir.dx, -dir.dz);
}

// The edge's direction for a side of the square (always positive).
const alongOf = ([dx, dz]: readonly [number, number]): Offset => ({ dx: Math.abs(dz), dz: Math.abs(dx) });

// The inn and the smithy stand on two different sides of the square's
// outer ring, each covering the ring tile straight out from the well and
// the next one along the edge, door facing the well. Returns them and the
// two sides left free.
function landmarkBuildings(village: Village, rng: () => number): { buildings: Building[]; freeSides: number[]; builtSides: number[] } {
  const sides = [0, 1, 2, 3];
  shuffle(sides, rng);
  const kinds: BuildingKind[] = ['inn', 'smithy'];
  const buildings = kinds.map((kind, i): Building => {
    const [dx, dz] = NEIGHBORS_4[sides[i]];
    const along = alongOf(NEIGHBORS_4[sides[i]]);
    const x0 = village.x + dx * R;
    const z0 = village.z + dz * R;
    const facing = rotationFacing({ dx: -dx, dz: -dz });
    return {
      kind,
      x: x0 + along.dx / 2,
      z: z0 + along.dz / 2,
      tiles: [
        [x0, z0],
        [x0 + along.dx, z0 + along.dz],
      ],
      groundTier: village.groundTier,
      quarterTurns: ((Math.round(facing / (Math.PI / 2)) % 4) + 4) % 4,
    };
  });
  return { buildings, builtSides: sides.slice(0, 2), freeSides: sides.slice(2) };
}

// Grows a lane out of the square from `mouth`, heading `out`: straight for a
// few tiles, sometimes jogging sideways a tile or two partway, then on out.
// Stops early at water, the map edge, or another village's paving.
function growLane(
  size: MapSize,
  lakeMap: boolean[][],
  surfaceMap: Surface[][],
  mouth: Site,
  out: Offset,
  rng: () => number,
): Lane {
  const length = LANE_LENGTH_MIN + Math.floor(rng() * (LANE_LENGTH_MAX - LANE_LENGTH_MIN + 1));
  const jogAt = rng() < 0.5 ? 2 + Math.floor(rng() * Math.max(1, length - 3)) : -1;
  const side: Offset = rng() < 0.5 ? { dx: out.dz, dz: out.dx } : { dx: -out.dz, dz: -out.dx };
  const jogLength = 1 + Math.floor(rng() * 2);

  const lane: Lane = { tiles: [] };
  const steps: Offset[] = [];
  for (let i = 0; i < length; i++) {
    steps.push(out);
    if (i === jogAt) for (let j = 0; j < jogLength; j++) steps.push(side);
  }
  let { x, z } = mouth;
  let dir = out;
  for (let i = 0; ; i++) {
    const ok = inBounds(size, x, z) && !lakeMap[x][z] && surfaceMap[x][z] === 'natural';
    if (!ok) break;
    lane.tiles.push({ x, z, dir });
    if (i >= steps.length) break;
    dir = steps[i];
    x += dir.dx;
    z += dir.dz;
  }
  return lane;
}

// Marks each village's square as 'plaza' and its lanes as 'path' in
// surfaceMap. A seed with little flat ground just ends up with fewer
// villages rather than failing.
export function generateVillages(
  heightMap: number[][],
  lakeMap: boolean[][],
  surfaceMap: Surface[][],
  rng: () => number,
  spawnX: number,
  spawnZ: number,
): { villages: Village[]; houses: House[]; buildings: Building[] } {
  const size = sizeOf(heightMap);
  // The count range is per VILLAGE_COUNT_AREA of map, so smaller worlds
  // (tests) get proportionally fewer; it's still one rng draw.
  const baseCount = VILLAGE_MIN_COUNT + Math.floor(rng() * (VILLAGE_MAX_COUNT - VILLAGE_MIN_COUNT + 1));
  const villageCount = Math.round((baseCount * size.width * size.depth) / VILLAGE_COUNT_AREA);

  const candidates = findCandidateSites(heightMap, lakeMap, spawnX, spawnZ);
  shuffle(candidates, rng);

  const villages: Village[] = [];
  for (const c of candidates) {
    if (villages.length >= villageCount) break;
    if (villages.some((v) => Math.hypot(v.x - c.x, v.z - c.z) < VILLAGE_MIN_DIST_BETWEEN)) continue;
    villages.push({ x: c.x, z: c.z, groundTier: heightMap[c.x][c.z] });
  }

  // Squares first, so no village's lanes run across another's square.
  for (const village of villages) {
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) surfaceMap[village.x + dx][village.z + dz] = 'plaza';
  }

  const houses: House[] = [];
  const buildings: Building[] = [];
  const builtCells = new Set<string>(); // every building tile, houses included
  // Keep a free tile between buildings (diagonals too): roofs overhang
  // their walls, so neighbors would touch and read as one long building.
  const crowded = (x: number, z: number) => {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (builtCells.has(cellKey(x + dx, z + dz))) return true;
    return false;
  };
  const addHouse = (x: number, z: number, door: Offset) => {
    builtCells.add(cellKey(x, z));
    houses.push({ x, z, groundTier: heightMap[x][z], rotationY: rotationFacing(door) });
  };

  for (const village of villages) {
    const { buildings: landmarks, freeSides, builtSides } = landmarkBuildings(village, rng);
    for (const building of landmarks) {
      buildings.push(building);
      for (const [x, z] of building.tiles) builtCells.add(cellKey(x, z));
    }

    // Lanes leave from the middle of each free side, and sometimes from a
    // built side too, beside its landmark. If a mouth is blocked (water, the
    // map edge, another village) the next spot along the edge is tried, so
    // villages by a lake still get their lanes.
    const wanted = rng() < 0.5 ? 3 : 2;
    const mouth = (side: number, offset: number) => {
      const [dx, dz] = NEIGHBORS_4[side];
      const along = alongOf(NEIGHBORS_4[side]);
      return {
        mouth: { x: village.x + dx * (R + 1) + offset * along.dx, z: village.z + dz * (R + 1) + offset * along.dz },
        out: { dx, dz },
      };
    };
    const candidates = [
      ...freeSides.map((side) => mouth(side, 0)),
      ...builtSides.map((side) => mouth(side, -2)),
      ...freeSides.flatMap((side) => [mouth(side, -2), mouth(side, 2)]),
    ];
    const lanes: Lane[] = [];
    for (const { mouth: start, out } of candidates) {
      if (lanes.length >= wanted) break;
      // One lane per side of the square.
      if (lanes.some((l) => l.tiles[0].dir.dx === out.dx && l.tiles[0].dir.dz === out.dz)) continue;
      const lane = growLane(size, lakeMap, surfaceMap, start, out, rng);
      if (lane.tiles.length > 0) lanes.push(lane);
    }
    for (const lane of lanes) for (const t of lane.tiles) surfaceMap[t.x][t.z] = 'path';

    // Houses front the lanes on both sides, doors onto the lane, from the
    // square outward (the first pair frames the lane's mouth); a skipped
    // spot is a garden.
    for (const lane of lanes) {
      for (const t of lane.tiles) {
        for (const sign of [1, -1]) {
          const x = t.x + sign * t.dir.dz;
          const z = t.z + sign * t.dir.dx;
          const buildable =
            inBounds(size, x, z) &&
            !lakeMap[x][z] &&
            surfaceMap[x][z] === 'natural' &&
            heightMap[x][z] === heightMap[t.x][t.z] &&
            !crowded(x, z);
          if (buildable && rng() < LANE_HOUSE_CHANCE) addHouse(x, z, { dx: t.x - x, dz: t.z - z });
        }
      }
    }

    // A few houses on the square's edge, facing the well, between the
    // landmarks and clear of the lane mouths.
    const edgeSlots: Site[] = [];
    for (let dx = -R; dx <= R; dx++) {
      for (let dz = -R; dz <= R; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) === R && Math.abs(dx) !== Math.abs(dz)) edgeSlots.push({ x: village.x + dx, z: village.z + dz });
      }
    }
    shuffle(edgeSlots, rng);
    const nearLane = (x: number, z: number) => NEIGHBORS_4.some(([dx, dz]) => surfaceMap[x + dx]?.[z + dz] === 'path');
    for (const slot of edgeSlots) {
      if (crowded(slot.x, slot.z) || nearLane(slot.x, slot.z) || rng() >= SQUARE_HOUSE_CHANCE) continue;
      const dx = slot.x - village.x;
      const dz = slot.z - village.z;
      const door = Math.abs(dx) > Math.abs(dz) ? { dx: -Math.sign(dx), dz: 0 } : { dx: 0, dz: -Math.sign(dz) };
      addHouse(slot.x, slot.z, door);
    }
  }

  return { villages, houses, buildings };
}
