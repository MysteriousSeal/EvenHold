// Village/house placement. Depends on the height grid and lake map; runs
// before trees so trees can avoid the cells houses end up on.

import {
  MAP_WIDTH,
  MAP_DEPTH,
  VILLAGE_MIN_COUNT,
  VILLAGE_MAX_COUNT,
  HOUSES_PER_VILLAGE_MIN,
  HOUSES_PER_VILLAGE_MAX,
  VILLAGE_FLAT_RADIUS,
  VILLAGE_MIN_DIST_FROM_SPAWN,
  VILLAGE_MIN_DIST_BETWEEN,
  VILLAGE_MAP_MARGIN,
} from './constants';
import type { House } from './types';

// A village needs a patch of dry, level ground to sit on — otherwise houses
// end up straddling a slope or half in a lake. "Flat" here means every cell
// within VILLAGE_FLAT_RADIUS shares the exact same height as the center.
function isFlatDrySite(heightMap: number[][], lakeMap: boolean[][], cx: number, cz: number): boolean {
  const targetHeight = heightMap[cx][cz];

  for (let dx = -VILLAGE_FLAT_RADIUS; dx <= VILLAGE_FLAT_RADIUS; dx++) {
    for (let dz = -VILLAGE_FLAT_RADIUS; dz <= VILLAGE_FLAT_RADIUS; dz++) {
      const x = cx + dx;
      const z = cz + dz;
      if (x < 0 || x >= MAP_WIDTH || z < 0 || z >= MAP_DEPTH) return false;
      if (lakeMap[x][z] || heightMap[x][z] !== targetHeight) return false;
    }
  }
  return true;
}

// A fully flat, dry 5x5+ patch is rare — often under 1% of the map. Blindly
// guessing random coordinates and rejecting bad ones (as this used to do)
// needs on the order of hundreds of attempts to reliably find such a sparse
// site, so a fixed small attempt budget silently produced zero villages on
// most seeds even when good sites existed. Scanning once for every valid
// site and shuffling that list instead guarantees every available site gets
// a fair chance of being picked.
function findCandidateSites(
  heightMap: number[][],
  lakeMap: boolean[][],
  spawnX: number,
  spawnZ: number,
): Array<{ x: number; z: number }> {
  const candidates: Array<{ x: number; z: number }> = [];
  for (let x = VILLAGE_MAP_MARGIN; x < MAP_WIDTH - VILLAGE_MAP_MARGIN; x++) {
    for (let z = VILLAGE_MAP_MARGIN; z < MAP_DEPTH - VILLAGE_MAP_MARGIN; z++) {
      if (Math.hypot(x - spawnX, z - spawnZ) < VILLAGE_MIN_DIST_FROM_SPAWN) continue;
      if (isFlatDrySite(heightMap, lakeMap, x, z)) candidates.push({ x, z });
    }
  }
  return candidates;
}

function shuffle<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
}

// Reuses the same rng stream right after tree-eligible height/lake data is
// ready. A seed with little flat ground just ends up with fewer villages
// (or none) rather than failing.
export function generateVillages(
  heightMap: number[][],
  lakeMap: boolean[][],
  rng: () => number,
  spawnX: number,
  spawnZ: number,
): House[] {
  const houses: House[] = [];
  const occupied = new Set<string>();

  const villageCount = VILLAGE_MIN_COUNT + Math.floor(rng() * (VILLAGE_MAX_COUNT - VILLAGE_MIN_COUNT + 1));

  const candidates = findCandidateSites(heightMap, lakeMap, spawnX, spawnZ);
  shuffle(candidates, rng);

  const centers: Array<{ x: number; z: number }> = [];
  for (const candidate of candidates) {
    if (centers.length >= villageCount) break;
    if (centers.some((c) => Math.hypot(c.x - candidate.x, c.z - candidate.z) < VILLAGE_MIN_DIST_BETWEEN)) continue;
    centers.push(candidate);
  }

  for (const center of centers) {
    const groundHeight = heightMap[center.x][center.z];
    const houseCount =
      HOUSES_PER_VILLAGE_MIN + Math.floor(rng() * (HOUSES_PER_VILLAGE_MAX - HOUSES_PER_VILLAGE_MIN + 1));

    let placed = 0;
    let houseAttempts = 0;
    while (placed < houseCount && houseAttempts < houseCount * 20) {
      houseAttempts++;

      const dx = Math.round((rng() * 2 - 1) * VILLAGE_FLAT_RADIUS);
      const dz = Math.round((rng() * 2 - 1) * VILLAGE_FLAT_RADIUS);
      const x = center.x + dx;
      const z = center.z + dz;
      const key = `${x},${z}`;

      // findCandidateSites already guaranteed every cell in this radius is
      // dry and level, so the only thing left to check is that no other
      // house (in this village or another) already sits here.
      if (occupied.has(key) || (x === spawnX && z === spawnZ)) continue;

      occupied.add(key);
      const rotationY = Math.floor(rng() * 4) * (Math.PI / 2); // cardinal-aligned
      houses.push({ x, z, groundHeight, rotationY });
      placed++;
    }
  }

  return houses;
}
