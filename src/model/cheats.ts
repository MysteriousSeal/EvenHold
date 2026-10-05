// Teleport destinations for the dev cheat panel. Pure queries over the
// model, so they're testable and the panel stays a thin UI.

import type { Cave } from './caves/caves';
import { onRoad, type Traveller, type TravellerRole } from './travellers/travellers';
import type { BuildingType, Entrance } from './interiors/interiors';
import { enemyLevel } from './enemies/enemyLevels';
import { VILLAGE_OUTER_RADIUS } from './constants';
import type { GameModel } from './GameModel';
import { NEIGHBORS_4, spawnOf } from './map/grid';
import { makeEnemy } from './enemies/enemies';
import { CRYPT_FOE_ID } from './crypts/cryptFoes';
import { AWARD_POST, SUMMONED } from './crypts/cryptLord';
import type { EnemyKind, Village } from './types';
import type { Ruin } from './ruins/ruins';
import type { Camp } from './camps/camps';
import type { Scenery, SceneryKind } from './scenery/scenery';
import { meadowPatches } from './scenery/meadowPatches';
import { LIFE_CELL, LIFE_HOUR, lifeIn, lifeOut, type LifeKind, type LifeSpot } from './scenery/ambientSpots';
import { createMeadowDensity } from './worldgen/meadows';
import { nextHour } from './clock';

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
function ringSearch(model: GameModel, from: Tile, accept: (x: number, z: number) => boolean, maxRadius = Math.max(model.size.width, model.size.depth)): Tile | null {
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

// The next stop on a tour of `places` (ruins, camps, caves): the nearest not
// yet visited (all of them seen, round again); where to arrive, just outside
// its way in (`wayOf`). Null if there are none.
function nextOn<T>(model: GameModel, places: readonly T[], from: Tile, visited: Set<T>, wayOf: (place: T) => Tile): Tile | null {
  if (places.length === 0) return null;
  if (visited.size >= places.length) visited.clear();
  const place = places.filter((p) => !visited.has(p)).sort((a, b) => distance(wayOf(a), from) - distance(wayOf(b), from))[0];
  visited.add(place);
  return nearestOpenTile(model, wayOf(place));
}

export const nextRuin = (model: GameModel, from: Tile, visited: Set<Ruin>) => nextOn(model, model.ruins, from, visited, (r) => r.way);
export const nextCamp = (model: GameModel, from: Tile, visited: Set<Camp>) => nextOn(model, model.camps, from, visited, (c) => c.way);
export const nextCave = (model: GameModel, from: Tile, visited: Set<Cave>) => nextOn(model, model.caves, from, visited, (c) => ({ x: Math.round(c.entrance.x), z: Math.round(c.entrance.z) }));

// A few tiles from the nearest living wolf, or null if there are none.
export function nearestPack(model: GameModel, from: Tile): Tile | null {
  return nearestOf(model, from, 'wolf');
}

// A few paces from the nearest living foe of `kind` (a wolf pack, a bear, a lynx), or null if there's none.
export function nearestOf(model: GameModel, from: Tile, kind: EnemyKind): Tile | null {
  const found = model.enemies.filter((e) => e.kind === kind && e.state !== 'dead');
  if (found.length === 0) return null;
  const nearest = found.reduce((a, b) => (distance(a, from) < distance(b, from) ? a : b));
  return nearestOpenTile(model, { x: Math.round(nearest.x) - 4, z: Math.round(nearest.z) });
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

// A draugr at the hero's own level, a step ahead of them: down in a dungeon, one more of its foes (in a crypt, its
// breath and cleave its own; not the dungeon's to count); out in the world, a foe there (its axe or sword alone).
export function spawnDraugr(model: GameModel): void {
  const { hero } = model;
  const below = model.dungeon;
  if (!below) {
    spawnEnemyNear(model, 'draugr');
    const draugr = model.enemies[model.enemies.length - 1];
    Object.assign(draugr, makeEnemy(draugr.id, 'draugr', draugr.x, draugr.z, draugr.homeX, draugr.homeZ, hero.level), { y: draugr.y });
    return;
  }
  const ahead = { x: hero.x + Math.sin(hero.facing) * 1.5, z: hero.z + Math.cos(hero.facing) * 1.5 };
  const at = below.free(ahead.x, ahead.z, 0.17) ? ahead : { x: hero.x, z: hero.z }; // (into the rock ahead: where they stand)
  const id = CRYPT_FOE_ID + SUMMONED + 900_000 + model.foes.length;
  model.foes.push(below.standing({ ...makeEnemy(id, 'draugr', at.x, at.z, at.x, at.z, hero.level), state: 'chase' }));
}

// Every dungeon's foes back at their posts (a crypt's guards, a cave's beasts), none slain; the hero, if down in one,
// out at its way up first.
export function resetCrypts(model: GameModel): void {
  if (model.dungeon && model.inside) {
    Object.assign(model.hero, { x: model.inside.room.door, z: model.inside.room.depth - 1 }); // (the foot of the stairs)
    model.useDoor();
  }
  for (const slain of model.cryptsCleared.values()) for (const post of [...slain]) if (post !== AWARD_POST) slain.delete(post); // (the points their bosses gave kept: once a dungeon, ever)
}

// Kills every living enemy within `radius` tiles (the world's, or a crypt's guards, down in one); returns how many.
export function slayNearby(model: GameModel, radius = 15): number {
  let slain = 0;
  for (const enemy of model.foes) {
    if (enemy.state === 'dead' || distance(enemy, model.hero) > radius) continue;
    enemy.hp = 0;
    enemy.state = 'dead';
    slain++;
  }
  return slain;
}

// Steps inside the nearest building of `type` (a house, the inn, a smithy)
// not in `visited`, leaving the one the hero's in first; once every one has
// been visited the tour starts over (visited is cleared, bar the one just
// left). Returns whether there was one.
export function enterNearest(model: GameModel, type: BuildingType, visited: Set<Entrance>): boolean {
  const current = model.inside?.entrance;
  if (model.inside) model.useDoor();
  const all = model.entrances.filter((e) => e.type === type);
  if (all.length === 0) return false;
  if (current) visited.add(current);
  if (all.every((e) => visited.has(e))) {
    visited.clear();
    if (current && all.length > 1) visited.add(current);
  }
  const next = all
    .filter((e) => !visited.has(e))
    .reduce((best, e) => (distance(e, model.hero) < distance(best, model.hero) ? e : best));
  visited.add(next);
  model.teleport(next.x, next.z);
  return model.useDoor();
}

// The nearest traveller of `role` on the roads, and the spot on their road a pace ahead of them (in reach
// for a word): or null, none about.
export function nearestTraveller(model: GameModel, from: Tile, role: TravellerRole): { traveller: Traveller; at: Tile } | null {
  let best: Traveller | null = null;
  for (const t of model.travellers.list) {
    if (t.role !== role || t.leader !== null) continue; // (a patrol by its leader)
    if (!best || distance(t, from) < distance(best, from)) best = t;
  }
  if (!best) return null;
  const ahead = onRoad(model.travellers.roads[best.road], best.along + best.way * 1.2);
  return { traveller: best, at: { x: ahead.x, z: ahead.z } };
}

// The Sights (the cheats' tab): the next of each kind of thing out in the wilds not yet visited, nearest first (all
// of them seen, round again), and where to stand to see it.

// The next rock or landmark of `kind`: stood just before it (on the camera's side); a ring of standing stones, in its
// middle (its stones all counted visited with it).
export function nextScenery(model: GameModel, from: Tile, kind: SceneryKind, visited: Set<Scenery>): Tile | null {
  const all = model.scenery.filter((s) => s.kind === kind);
  if (all.length === 0) return null;
  if (all.every((s) => visited.has(s))) for (const s of all) visited.delete(s);
  const middle = (s: Scenery) => ({ x: s.x + (s.w - 1) / 2, z: s.z + (s.d - 1) / 2 });
  const piece = all.filter((s) => !visited.has(s)).sort((a, b) => distance(middle(a), from) - distance(middle(b), from))[0];
  if (kind !== 'menhir') {
    visited.add(piece);
    return nearestOpenTile(model, { x: piece.x + piece.w, z: piece.z + piece.d });
  }
  const ring = all.filter((s) => distance(s, piece) <= 8);
  for (const s of ring) visited.add(s);
  const centre = { x: Math.round(ring.reduce((a, s) => a + s.x, 0) / ring.length), z: Math.round(ring.reduce((a, s) => a + s.z, 0) / ring.length) };
  return nearestOpenTile(model, centre);
}

const SIGHT_REACH = 600; // tiles round the hero looked over for a meadow or the small life (no further: the world's big)

// The next thick meadow patch of wildflowers (of `kind`, BLOOMS' index, if given), in its middle.
export function nextMeadow(model: GameModel, from: Tile, kind: number | null, visited: Set<string>): Tile | null {
  const patches = meadowPatches(model.seed);
  const cell = (x: number, z: number) => `${Math.floor(x / 14)},${Math.floor(z / 14)}`; // (a patch's own ground)
  const find = () =>
    ringSearch(
      model,
      from,
      (x, z) => model.isOpenTile(x, z) && model.surfaceMap[x]?.[z] === 'natural' && patches.strength(x, z) > 0.75 && (kind === null || patches.kind(x, z) === kind) && !visited.has(cell(x, z)),
      SIGHT_REACH,
    );
  const at = find() ?? (visited.clear(), find());
  if (!at) return null;
  const [cx, cz] = [Math.floor(at.x / 14), Math.floor(at.z / 14)];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) visited.add(`${cx + dx},${cz + dz}`);
  return at;
}

// The next place with the small life of `kind` (a flock of songbirds, butterflies, fireflies): stood a few paces off
// (not to scare them), and the hour turned to one they're out at, if they're not.
export function nextLife(model: GameModel, from: Tile, kind: LifeKind, visited: Set<string>): Tile | null {
  const meadow = createMeadowDensity(model.seed);
  const [hx, hz] = [Math.floor(from.x / LIFE_CELL), Math.floor(from.z / LIFE_CELL)];
  const find = (): LifeSpot | null => {
    for (let r = 0; r <= SIGHT_REACH / LIFE_CELL; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || visited.has(`${hx + dx},${hz + dz}`)) continue;
        const spot = lifeIn(model, hx + dx, hz + dz, meadow).find((c) => c.kind === kind);
        if (spot) return (visited.add(`${hx + dx},${hz + dz}`), spot);
      }
    }
    return null;
  };
  const spot = find() ?? (visited.clear(), find());
  if (!spot) return null;
  if (!lifeOut(kind, model.minutes)) model.minutes = nextHour(model.minutes, LIFE_HOUR[kind]);
  return nearestOpenTile(model, { x: Math.round(spot.x) + 5, z: Math.round(spot.z) + 5 });
}

// Into the house of the nearest herbalist not yet visited (the tour round again once all have been); whether there
// was one.
export function visitHerbalist(model: GameModel, visited: Set<Entrance>): boolean {
  if (model.inside) model.useDoor();
  const homes = [...new Set(model.npcs.filter((n) => n.role === 'herbalist').map((n) => n.home))];
  if (homes.length === 0) return false;
  if (homes.every((h) => visited.has(h))) visited.clear();
  const next = homes.filter((h) => !visited.has(h)).reduce((best, h) => (distance(h, model.hero) < distance(best, model.hero) ? h : best));
  visited.add(next);
  model.teleport(next.x, next.z);
  return model.useDoor();
}
