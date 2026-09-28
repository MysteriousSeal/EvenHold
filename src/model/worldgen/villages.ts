// Village layout: a paved square with a well at its center, houses on the
// rings around it with doors facing the square, and a dirt path from each
// door to the square. Runs before trails and trees, which both avoid what
// it places.

import {
  MAP_WIDTH,
  MAP_DEPTH,
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
} from '../constants';
import { cellKey, inBounds } from '../grid';
import { shuffle } from '../../util/random';
import type { House, Surface, Village } from '../types';

interface Offset {
  dx: number;
  dz: number;
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
      if (!inBounds(x, z) || lakeMap[x][z] || heightMap[x][z] !== tier) return false;
    }
  }
  return true;
}

// Scans once for every valid site rather than guessing random coordinates:
// flat dry patches can be sparse, and rejection sampling with a fixed
// attempt budget silently misses them.
function findCandidateSites(heightMap: number[][], lakeMap: boolean[][], spawnX: number, spawnZ: number): Offset[] {
  const candidates: Offset[] = [];
  for (let x = VILLAGE_MAP_MARGIN; x < MAP_WIDTH - VILLAGE_MAP_MARGIN; x++) {
    for (let z = VILLAGE_MAP_MARGIN; z < MAP_DEPTH - VILLAGE_MAP_MARGIN; z++) {
      if (Math.hypot(x - spawnX, z - spawnZ) < VILLAGE_MIN_DIST_FROM_SPAWN) continue;
      if (isFlatDrySite(heightMap, lakeMap, x, z)) candidates.push({ dx: x, dz: z });
    }
  }
  return candidates;
}

// Every offset outside the square and within the outer ring, except exact
// diagonals, where a door couldn't face the square along a single axis.
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

// One step toward the square along the slot's dominant axis.
function doorDirection(slot: Offset): Offset {
  return Math.abs(slot.dx) > Math.abs(slot.dz) ? { dx: -Math.sign(slot.dx), dz: 0 } : { dx: 0, dz: -Math.sign(slot.dz) };
}

// Y rotation that turns the house's local -Z (its door side) toward `dir`.
function rotationFacing(dir: Offset): number {
  return Math.atan2(-dir.dx, -dir.dz);
}

// Tiles from just outside the door to the edge of the square, stepping
// toward the center. Always stays within VILLAGE_FLAT_RADIUS.
function doorPath(slot: Offset, dir: Offset): Offset[] {
  const path: Offset[] = [];
  let x = slot.dx + dir.dx;
  let z = slot.dz + dir.dz;
  while (Math.max(Math.abs(x), Math.abs(z)) > VILLAGE_PLAZA_RADIUS) {
    path.push({ dx: x, dz: z });
    if (Math.abs(x) > VILLAGE_PLAZA_RADIUS) x -= Math.sign(x);
    else z -= Math.sign(z);
  }
  return path;
}

function hasHouseNearby(houseCells: ReadonlySet<string>, x: number, z: number): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (houseCells.has(cellKey(x + dx, z + dz))) return true;
    }
  }
  return false;
}

// Mutates surfaceMap (square + door paths). A seed with little flat ground
// just ends up with fewer villages rather than failing.
export function generateVillages(
  heightMap: number[][],
  lakeMap: boolean[][],
  surfaceMap: Surface[][],
  rng: () => number,
  spawnX: number,
  spawnZ: number,
): { villages: Village[]; houses: House[] } {
  const villageCount = VILLAGE_MIN_COUNT + Math.floor(rng() * (VILLAGE_MAX_COUNT - VILLAGE_MIN_COUNT + 1));

  const candidates = findCandidateSites(heightMap, lakeMap, spawnX, spawnZ);
  shuffle(candidates, rng);

  const villages: Village[] = [];
  for (const c of candidates) {
    if (villages.length >= villageCount) break;
    if (villages.some((v) => Math.hypot(v.x - c.dx, v.z - c.dz) < VILLAGE_MIN_DIST_BETWEEN)) continue;
    villages.push({ x: c.dx, z: c.dz, groundTier: heightMap[c.dx][c.dz] });
  }

  const houses: House[] = [];
  const houseCells = new Set<string>();

  for (const village of villages) {
    for (let dx = -VILLAGE_PLAZA_RADIUS; dx <= VILLAGE_PLAZA_RADIUS; dx++) {
      for (let dz = -VILLAGE_PLAZA_RADIUS; dz <= VILLAGE_PLAZA_RADIUS; dz++) {
        surfaceMap[village.x + dx][village.z + dz] = 'plaza';
      }
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
      if (!inBounds(x, z) || lakeMap[x][z] || heightMap[x][z] !== village.groundTier) continue;
      if (surfaceMap[x][z] !== 'natural') continue; // on a path
      // Keep a free tile between houses (diagonals too): roofs overhang their
      // walls, so neighbors would touch and read as one long building.
      if (hasHouseNearby(houseCells, x, z)) continue;

      const dir = doorDirection(slot);
      const path = doorPath(slot, dir);
      if (path.some((p) => houseCells.has(cellKey(village.x + p.dx, village.z + p.dz)))) continue; // door blocked

      houseCells.add(cellKey(x, z));
      for (const p of path) surfaceMap[village.x + p.dx][village.z + p.dz] = 'path';
      houses.push({ x, z, groundTier: village.groundTier, rotationY: rotationFacing(dir) });
      placed++;
    }

    // The whole village area is the dirt square the houses stand on (keeps trees out too).
    for (let dx = -VILLAGE_OUTER_RADIUS; dx <= VILLAGE_OUTER_RADIUS; dx++) {
      for (let dz = -VILLAGE_OUTER_RADIUS; dz <= VILLAGE_OUTER_RADIUS; dz++) {
        const x = village.x + dx;
        const z = village.z + dz;
        if (inBounds(x, z) && !lakeMap[x][z] && heightMap[x][z] === village.groundTier) surfaceMap[x][z] = 'plaza';
      }
    }
  }

  return { villages, houses };
}
