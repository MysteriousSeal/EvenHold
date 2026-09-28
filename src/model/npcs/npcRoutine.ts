// A villager's day, one step at a time (npcs.ts NpcStep). At each stop of
// the routine they get their steps: to go home or to the inn, out of where
// they are, to its door, in, and settling down there a while; to the
// square, out and to two spots on it in turn, pausing at each. Settling
// takes a free seat (a chair, an armchair, a bar stool, or at home their
// bed), else somewhere to stand.
//
// Only villagers of villages near the hero act; out of the hero's sight (another room,
// or outdoors while the hero is in), they don't walk but arrive at once,
// so they cost next to nothing but keep their routine. In sight, they walk
// tile paths around what's in the way (pathfinding.ts), step round the
// hero and each other, and never stay stuck long.

import { ENEMY_ACTIVE_RADIUS, HERO_RADIUS, INDOOR_SCALE, VILLAGE_OUTER_RADIUS } from '../constants';
import { hashUnit } from '../../util/random';
import { findPath } from '../pathfinding';
import type { Point } from '../obstacles';
import type { Village } from '../types';
import type { Entrance } from '../interiors/interiors';
import { bumpsFurniture, distanceTo, seatOf, type Furniture, type Seat } from '../interiors/furniture';
import { layoutOf, type Inside } from '../interiors/indoors';
import { NPC_RADIUS, ROUTINE, bumpsNpc, type Npc, type NpcStep } from './npcs';

export interface NpcWorld {
  seed: number;
  hero: { x: number; z: number };
  inside: Inside | null; // the hero's
  isBlocked(x: number, z: number, r: number): boolean;
  isOpenTile(x: number, z: number): boolean;
  getGroundY(x: number, z: number): number;
}

const WALK_SPEED = 1.1;
const PATH_RADIUS = 24; // tiles searched for a way
const STUCK_TIME = 3; // seconds without getting anywhere before skipping ahead
const HOME_TIME: [number, number] = [30, 90]; // seconds settled at home
const INN_TIME: [number, number] = [30, 70];
const SQUARE_WAIT: [number, number] = [5, 15];
const SIT_CHANCE = 0.75;

// A roll for a villager at this point of their routine, the same every time on a seed.
const roll = (npc: Npc, salt: number) => hashUnit(npc.id, npc.stop * 7 + salt, npc.salt);
const between = (npc: Npc, [a, b]: [number, number], salt: number) => a + roll(npc, salt) * (b - a);

// Villagers by village, gathered once, so only villages near the hero are looked at.
const byVillage = new WeakMap<readonly Npc[], Map<Village, Npc[]>>();
function villagesOf(npcs: readonly Npc[]): Map<Village, Npc[]> {
  let map = byVillage.get(npcs);
  if (!map) {
    map = new Map();
    for (const npc of npcs) map.set(npc.village, [...(map.get(npc.village) ?? []), npc]);
    byVillage.set(npcs, map);
  }
  return map;
}

export function stepNpcs(npcs: readonly Npc[], world: NpcWorld, dt: number): void {
  const heroIn = world.inside?.entrance ?? null;
  const heroOut = heroIn ?? world.hero; // where the hero is on the map
  for (const [village, folk] of villagesOf(npcs)) {
    if (Math.abs(village.x - heroOut.x) > ENEMY_ACTIVE_RADIUS || Math.abs(village.z - heroOut.z) > ENEMY_ACTIVE_RADIUS) continue;
    for (const npc of folk) act(npc, npcs, world, npc.where === heroIn, dt);
  }
}

// The door's tile inside a building's room.
function doorTile(seed: number, entrance: Entrance): Point {
  const { room } = layoutOf(seed, entrance);
  return { x: room.door, z: room.depth - 1 };
}

// The steps for the next stop of the routine.
function plan(npc: Npc, world: NpcWorld): NpcStep[] {
  const stop = ROUTINE[npc.stop % ROUTINE.length];
  npc.stop++;
  const steps: NpcStep[] = [];
  const leave = () => {
    if (npc.where) steps.push({ kind: 'go', to: doorTile(world.seed, npc.where) }, { kind: 'exit' });
  };
  if (stop === 'square') {
    leave();
    for (const k of [0, 1]) steps.push({ kind: 'go', to: squareSpot(npc, world, k) }, { kind: 'wait', for: between(npc, SQUARE_WAIT, 10 + k) });
    return steps;
  }
  const building = stop === 'inn' && npc.inn ? npc.inn : npc.home;
  if (npc.where !== building) {
    leave();
    steps.push({ kind: 'go', to: building }, { kind: 'enter', entrance: building });
  }
  steps.push({ kind: 'settle', for: between(npc, building === npc.home ? HOME_TIME : INN_TIME, 12) });
  return steps;
}

// Somewhere open on the village square (around the well), from the routine.
function squareSpot(npc: Npc, world: NpcWorld, k: number): Point {
  const { village } = npc;
  for (let tries = 0; tries < 12; tries++) {
    const x = village.x + Math.floor(roll(npc, 20 + k * 13 + tries) * (VILLAGE_OUTER_RADIUS * 2 + 1)) - VILLAGE_OUTER_RADIUS;
    const z = village.z + Math.floor(roll(npc, 40 + k * 13 + tries) * (VILLAGE_OUTER_RADIUS * 2 + 1)) - VILLAGE_OUTER_RADIUS;
    if (world.isOpenTile(x, z)) return { x: x + (roll(npc, 60 + k) - 0.5) * 0.4, z: z + (roll(npc, 61 + k) - 0.5) * 0.4 };
  }
  return { x: npc.home.x, z: npc.home.z };
}

// Whether someone else is on a piece of furniture, or on their way to it.
function claimed(piece: Furniture, npc: Npc, npcs: readonly Npc[], world: NpcWorld): boolean {
  if (world.inside?.entrance === npc.where && world.inside?.seated?.seat.piece === piece) return true;
  return npcs.some((o) => o !== npc && o.where === npc.where && (o.seat?.piece === piece || o.steps.some((s) => s.kind === 'sit' && s.seat.piece === piece)));
}

// Settling in a room: a free seat (their own bed only at home) and the free
// tile beside it to sit down from, else a free tile to stand on.
function settle(npc: Npc, npcs: readonly Npc[], world: NpcWorld, seconds: number): NpcStep[] {
  const { room, furniture } = layoutOf(world.seed, npc.where!);
  const free = roomFree(world.seed, npc.where!);
  const tiles: Point[] = [];
  for (let x = 0; x < room.width; x++) for (let z = 0; z < room.depth - 1; z++) if (free(x, z)) tiles.push({ x, z });
  if (roll(npc, 30) < SIT_CHANCE) {
    const seats = furniture
      .map((piece) => seatOf(piece))
      .filter((seat): seat is Seat => !!seat && (!seat.lying || npc.where === npc.home) && !claimed(seat.piece, npc, npcs, world));
    const seat = seats[Math.floor(roll(npc, 31) * seats.length)];
    const from = seat && tiles.filter((t) => distanceTo(seat.piece, t.x, t.z) <= 0.6).sort((a, b) => distanceTo(seat.piece, a.x, a.z) - distanceTo(seat.piece, b.x, b.z))[0];
    if (seat && from) return [{ kind: 'go', to: from }, { kind: 'sit', seat, for: seconds }];
  }
  const spot = tiles[Math.floor(roll(npc, 32) * tiles.length)] ?? doorTile(world.seed, npc.where!);
  return [{ kind: 'go', to: spot }, { kind: 'wait', for: seconds }];
}

// Where a villager fits in a building's room.
function roomFree(seed: number, entrance: Entrance): (x: number, z: number) => boolean {
  const { room, furniture } = layoutOf(seed, entrance);
  const r = NPC_RADIUS * INDOOR_SCALE;
  return (x, z) => x >= -0.5 + r && z >= -0.5 + r && x <= room.width - 0.5 - r && z <= room.depth - 0.5 - r && !bumpsFurniture(furniture, x, z, r);
}

function act(npc: Npc, npcs: readonly Npc[], world: NpcWorld, seen: boolean, dt: number): void {
  npc.moving = false;
  if (npc.steps.length === 0) npc.steps = plan(npc, world);
  const step = npc.steps[0];
  const done = () => {
    npc.steps.shift();
    npc.path = null;
    npc.waited = 0;
  };
  switch (step.kind) {
    case 'go':
      // Out of sight, they're simply there; in sight, they walk.
      if (!seen) place(npc, world, step.to);
      if (!seen || walk(npc, npcs, world, step.to, dt)) done();
      return;
    case 'enter': {
      npc.where = step.entrance;
      place(npc, world, doorTile(world.seed, step.entrance));
      npc.facing = Math.PI; // into the room
      done();
      return;
    }
    case 'exit': {
      const door = npc.where!;
      npc.where = null;
      place(npc, world, door);
      npc.facing = Math.atan2(door.outX, door.outZ);
      done();
      return;
    }
    case 'settle':
      npc.steps.splice(0, 1, ...settle(npc, npcs, world, step.for));
      return;
    case 'sit':
      if (npc.waited === 0) {
        npc.stood = { x: npc.x, z: npc.z };
        npc.seat = step.seat;
        npc.x = step.seat.x;
        npc.z = step.seat.z;
        npc.y = step.seat.y;
        npc.facing = step.seat.facing;
      }
      npc.waited += dt;
      if (npc.waited >= step.for) {
        place(npc, world, npc.stood!);
        npc.seat = null;
        npc.stood = null;
        done();
      }
      return;
    case 'wait':
      npc.waited += dt;
      if (npc.waited >= step.for) done();
      return;
  }
}

// Stands a villager at a point, on the ground there.
function place(npc: Npc, world: NpcWorld, at: Point): void {
  npc.x = at.x;
  npc.z = at.z;
  npc.y = npc.where ? 0 : world.getGroundY(at.x, at.z);
}

// One frame's walk toward `to`, along a path around what's in the way;
// returns whether they've arrived (or given up on getting any closer).
function walk(npc: Npc, npcs: readonly Npc[], world: NpcWorld, to: Point, dt: number): boolean {
  const indoors = npc.where;
  const free = indoors ? roomFree(world.seed, indoors) : (x: number, z: number) => !world.isBlocked(x, z, NPC_RADIUS);
  if (!npc.path) npc.path = [...findPath(npc, to, PATH_RADIUS, free), to];
  const scale = indoors ? INDOOR_SCALE : 1;
  // Someone standing on the next point: past it, or (the last) close enough.
  const taken = (p: Point) => npcs.some((o) => o !== npc && o.where === indoors && Math.hypot(o.x - p.x, o.z - p.z) < NPC_RADIUS * 2 * scale);
  while (npc.path.length > 0 && taken(npc.path[0])) {
    if (npc.path.length === 1 && Math.hypot(npc.path[0].x - npc.x, npc.path[0].z - npc.z) < 0.8 * scale) return true;
    if (npc.path.length === 1) break;
    npc.path.shift();
  }
  const next = npc.path[0];
  const dx = next.x - npc.x;
  const dz = next.z - npc.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.05) {
    npc.path.shift();
    return npc.path.length === 0;
  }
  const step = Math.min(WALK_SPEED * dt, d);
  const x0 = npc.x;
  const z0 = npc.z;
  // Round the hero and each other, never into them (by the same rule as the
  // hero bumps villagers: no step that overlaps and brings two closer).
  const hero = world.hero;
  const reach = (NPC_RADIUS + HERO_RADIUS) * scale;
  const clear = (x: number, z: number) =>
    free(x, z) &&
    !(Math.hypot(hero.x - x, hero.z - z) < reach && Math.hypot(hero.x - x, hero.z - z) < Math.hypot(hero.x - npc.x, hero.z - npc.z)) &&
    !bumpsNpc(npcs, indoors, npc, x, z, NPC_RADIUS * scale);
  // Straight on if the way's clear; else veering round whoever's in the way
  // (each villager favoring a side of their own, so they don't dither);
  // else sliding along a wall, axis by axis.
  const side = npc.id % 2 === 0 ? 1 : -1;
  const heading = Math.atan2(dx, dz);
  const veer = [0, 0.8, -0.8, 1.6, -1.6].map((turn) => heading + turn * side).find((a) => clear(npc.x + Math.sin(a) * step, npc.z + Math.cos(a) * step));
  if (veer !== undefined) {
    npc.x += Math.sin(veer) * step;
    npc.z += Math.cos(veer) * step;
  } else {
    if (clear(npc.x + (dx / d) * step, npc.z)) npc.x += (dx / d) * step;
    if (clear(npc.x, npc.z + (dz / d) * step)) npc.z += (dz / d) * step;
  }
  const moved = Math.hypot(npc.x - x0, npc.z - z0);
  if (moved > 1e-5) {
    npc.facing = Math.atan2(npc.x - x0, npc.z - z0);
    npc.moving = true;
    npc.waited = 0;
    if (!indoors) npc.y = world.getGroundY(npc.x, npc.z);
    return false;
  }
  // Stuck: past this point after a while (or done, if it was the last).
  npc.waited += dt;
  if (npc.waited < STUCK_TIME) return false;
  npc.waited = 0;
  place(npc, world, npc.path.shift()!);
  return npc.path.length === 0;
}
