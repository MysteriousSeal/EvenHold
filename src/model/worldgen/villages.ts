// Village layout: a dirt square with a well at its center and houses on
// the ring around it, doors facing the well. Runs before trails and trees,
// which both avoid what it places.

import {
  VILLAGE_MIN_COUNT,
  VILLAGE_MAX_COUNT,
  HOUSES_PER_VILLAGE_MIN,
  HOUSES_PER_VILLAGE_MAX,
  VILLAGE_FLAT_RADIUS,
  VILLAGE_PLAZA_RADIUS,
  VILLAGE_OUTER_RADIUS,
  VILLAGE_MIN_DIST_FROM_SPAWN,
  VILLAGE_MIN_DIST_BETWEEN,
  VILLAGE_MAP_MARGIN,
  VILLAGE_COUNT_AREA,
} from '../constants';
import { NEIGHBORS_4, cellKey, inBounds, sizeOf } from '../grid';
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

// The square and the house ring need level, dry ground. Any house slot
// beyond VILLAGE_FLAT_RADIUS is checked individually instead, since
// requiring a larger fully level patch makes village sites rare.
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

// Every offset outside the open ground around the well and within the
// outer ring, except exact diagonals, where a door couldn't face the well
// along a single axis.
function houseSlots(): Offset[] {
  const slots: Offset[] = [];
  for (let dx = -VILLAGE_OUTER_RADIUS; dx <= VILLAGE_OUTER_RADIUS; dx++) {
    for (let dz = -VILLAGE_OUTER_RADIUS; dz <= VILLAGE_OUTER_RADIUS; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) <= VILLAGE_PLAZA_RADIUS) continue;
      if (Math.abs(dx) === Math.abs(dz)) continue;
      slots.push({ dx, dz });
    }
  }
  return slots;
}

// One step toward the well along the slot's dominant axis.
function doorDirection(slot: Offset): Offset {
  return Math.abs(slot.dx) > Math.abs(slot.dz) ? { dx: -Math.sign(slot.dx), dz: 0 } : { dx: 0, dz: -Math.sign(slot.dz) };
}

// Y rotation that turns the house's local -Z (its door side) toward `dir`.
function rotationFacing(dir: Offset): number {
  return Math.atan2(-dir.dx, -dir.dz);
}

function hasHouseNearby(houseCells: ReadonlySet<string>, x: number, z: number): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (houseCells.has(cellKey(x + dx, z + dz))) return true;
    }
  }
  return false;
}

// The inn and the smithy stand on two different sides of the square's
// outer ring, each covering the ring tile straight out from the well and
// the next one along the edge, door facing the well.
function landmarkBuildings(village: Village, rng: () => number): Building[] {
  const sides = [0, 1, 2, 3];
  shuffle(sides, rng);
  const kinds: BuildingKind[] = ['inn', 'smithy'];
  return kinds.map((kind, i) => {
    const [dx, dz] = NEIGHBORS_4[sides[i]];
    const along = { dx: Math.abs(dz), dz: Math.abs(dx) }; // the edge's direction
    const x0 = village.x + dx * VILLAGE_OUTER_RADIUS;
    const z0 = village.z + dz * VILLAGE_OUTER_RADIUS;
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
}

// Marks each village's area as 'plaza' in surfaceMap. A seed with little
// flat ground just ends up with fewer villages rather than failing.
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

  const houses: House[] = [];
  const buildings: Building[] = [];
  const houseCells = new Set<string>(); // every building tile, houses included

  for (const village of villages) {
    // The whole square is flat and dry (VILLAGE_FLAT_RADIUS covers it), so
    // the inn and smithy always fit; houses keep their distance from them.
    for (const building of landmarkBuildings(village, rng)) {
      buildings.push(building);
      for (const [x, z] of building.tiles) houseCells.add(cellKey(x, z));
    }
    const houseCount =
      HOUSES_PER_VILLAGE_MIN + Math.floor(rng() * (HOUSES_PER_VILLAGE_MAX - HOUSES_PER_VILLAGE_MIN + 1));
    const slots = houseSlots();
    shuffle(slots, rng);

    let placed = 0;
    for (const slot of slots) {
      if (placed >= houseCount) break;

      const x = village.x + slot.dx;
      const z = village.z + slot.dz;
      // Slots beyond VILLAGE_FLAT_RADIUS aren't guaranteed level and dry.
      if (!inBounds(size, x, z) || lakeMap[x][z] || heightMap[x][z] !== village.groundTier) continue;
      // Keep a free tile between houses (diagonals too): roofs overhang their
      // walls, so neighbors would touch and read as one long building.
      if (hasHouseNearby(houseCells, x, z)) continue;

      houseCells.add(cellKey(x, z));
      houses.push({ x, z, groundTier: village.groundTier, rotationY: rotationFacing(doorDirection(slot)) });
      placed++;
    }

    // The whole village area is the dirt square the houses stand on (keeps trees out too).
    for (let dx = -VILLAGE_OUTER_RADIUS; dx <= VILLAGE_OUTER_RADIUS; dx++) {
      for (let dz = -VILLAGE_OUTER_RADIUS; dz <= VILLAGE_OUTER_RADIUS; dz++) {
        const x = village.x + dx;
        const z = village.z + dz;
        if (inBounds(size, x, z) && !lakeMap[x][z] && heightMap[x][z] === village.groundTier) surfaceMap[x][z] = 'plaza';
      }
    }
  }

  return { villages, houses, buildings };
}
