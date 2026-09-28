// Teleport destinations for the dev cheat panel. Pure queries over the
// model, so they're testable and the panel stays a thin UI.

import { VILLAGE_OUTER_RADIUS } from './constants';
import type { GameModel } from './GameModel';
import { NEIGHBORS_4, spawnOf } from './grid';
import type { Village } from './types';

export interface Tile {
  x: number;
  z: number;
}

const distance = (a: Tile, b: Tile) => Math.hypot(a.x - b.x, a.z - b.z);

// The nearest village to `from` that isn't in `visited`; once every village
// has been visited the tour starts over (visited is cleared). Null if the
// world has no villages.
export function nextVillage(model: GameModel, from: Tile, visited: Set<Village>): Village | null {
  if (model.villages.length === 0) return null;
  if (visited.size >= model.villages.length) visited.clear();
  const candidates = model.villages.filter((v) => !visited.has(v));
  candidates.sort((a, b) => distance(a, from) - distance(b, from));
  visited.add(candidates[0]);
  return candidates[0];
}

// Where to arrive at a village: at the end of the trail where it meets the
// square if a trail leads there, otherwise just outside the square on the
// side facing `from` (falling back to the other sides if that tile is
// blocked), so the whole village is in view on arrival.
export function villageEntrance(model: GameModel, village: Village, from: Tile): Tile {
  const inSquare = (x: number, z: number) =>
    Math.max(Math.abs(x - village.x), Math.abs(z - village.z)) <= VILLAGE_OUTER_RADIUS;
  for (const route of model.trails) {
    const lastPath = [...route].reverse().find(([x, z]) => model.surfaceMap[x][z] === 'path');
    if (lastPath && NEIGHBORS_4.some(([dx, dz]) => inSquare(lastPath[0] + dx, lastPath[1] + dz))) {
      return { x: lastPath[0], z: lastPath[1] };
    }
  }
  const reach = VILLAGE_OUTER_RADIUS + 1;
  const sides = NEIGHBORS_4.map(([dx, dz]) => ({ x: village.x + dx * reach, z: village.z + dz * reach }));
  sides.sort((a, b) => distance(a, from) - distance(b, from));
  return sides.find((t) => model.isOpenTile(t.x, t.z)) ?? nearestOpenTile(model, sides[0]);
}

// The nearest open tile on the shore of a lake (next to water), or null if
// the world has no lakes. Searches outward ring by ring from `from`.
export function nearestLakeShore(model: GameModel, from: Tile): Tile | null {
  const isShore = (x: number, z: number) =>
    model.isOpenTile(x, z) && NEIGHBORS_4.some(([dx, dz]) => model.lakeMap[x + dx]?.[z + dz]);
  return ringSearch(model, from, isShore);
}

export function spawnTile(model: GameModel): Tile {
  return spawnOf(model.size);
}

function nearestOpenTile(model: GameModel, from: Tile): Tile {
  return ringSearch(model, from, (x, z) => model.isOpenTile(x, z)) ?? from;
}

// First tile matching `accept`, searching square rings of growing radius
// around `from` (nearest ring first, and the nearest tile within it).
function ringSearch(model: GameModel, from: Tile, accept: (x: number, z: number) => boolean): Tile | null {
  const maxRadius = Math.max(model.size.width, model.size.depth);
  for (let r = 0; r <= maxRadius; r++) {
    const ring: Tile[] = [];
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const t = { x: Math.round(from.x) + dx, z: Math.round(from.z) + dz };
        if (accept(t.x, t.z)) ring.push(t);
      }
    }
    if (ring.length > 0) return ring.sort((a, b) => distance(a, from) - distance(b, from))[0];
  }
  return null;
}
