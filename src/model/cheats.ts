// Teleport destinations for the dev cheat panel. Pure queries over the
// model, so they're testable and the panel stays a thin UI.

import { enemyLevel } from './enemyLevels';
import { VILLAGE_OUTER_RADIUS } from './constants';
import type { GameModel } from './GameModel';
import { NEIGHBORS_4, spawnOf } from './grid';
import { campPieces, makeEnemy } from './enemies';
import type { EnemyKind, Village } from './types';

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

// The entrance of the nearest bandit camp (just outside its palisade gap),
// or null if there are none.
export function nearestCamp(model: GameModel, from: Tile): Tile | null {
  if (model.camps.length === 0) return null;
  const camp = model.camps.reduce((a, b) => (distance(a, from) < distance(b, from) ? a : b));
  const fire = campPieces(camp)[0];
  // The entrance faces local +Z; three tiles out from the fire along it.
  const [dx, dz] = [[0, 3], [3, 0], [0, -3], [-3, 0]][camp.quarterTurns];
  return nearestOpenTile(model, { x: fire.x + dx, z: fire.z + dz });
}

// A few tiles from the nearest living wolf, or null if there are none.
export function nearestPack(model: GameModel, from: Tile): Tile | null {
  const wolves = model.enemies.filter((e) => e.kind === 'wolf' && e.state !== 'dead');
  if (wolves.length === 0) return null;
  const wolf = wolves.reduce((a, b) => (distance(a, from) < distance(b, from) ? a : b));
  return nearestOpenTile(model, { x: Math.round(wolf.x) - 4, z: Math.round(wolf.z) });
}

// Adds a new enemy on open ground a couple of tiles in front of the hero.
export function spawnEnemyNear(model: GameModel, kind: EnemyKind): void {
  const ahead = { x: Math.round(model.hero.x + Math.sin(model.hero.facing) * 2), z: Math.round(model.hero.z + Math.cos(model.hero.facing) * 2) };
  const at = nearestOpenTile(model, ahead);
  const id = Math.max(-1, ...model.enemies.map((e) => e.id)) + 1;
  const enemy = makeEnemy(id, kind, at.x, at.z, at.x, at.z, enemyLevel(spawnOf(model.size), at.x, at.z, id));
  enemy.y = model.getGroundY(at.x, at.z);
  model.enemies.push(enemy);
}

// Kills every living enemy within `radius` tiles; returns how many.
export function slayNearby(model: GameModel, radius = 15): number {
  let slain = 0;
  for (const enemy of model.enemies) {
    if (enemy.state === 'dead' || distance(enemy, model.hero) > radius) continue;
    enemy.hp = 0;
    enemy.state = 'dead';
    slain++;
  }
  return slain;
}
