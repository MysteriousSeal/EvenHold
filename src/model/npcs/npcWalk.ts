// How villagers get about (npcRoutine.ts decides where): walking a tile path
// round what's in the way (pathfinding.ts), round the hero and each other,
// never stuck long; put down somewhere at once when out of the hero's sight;
// easing off the hero when they overlap, making way when walked into. And
// where they fit in a room.

import { HERO_RADIUS, INDOOR_SCALE } from '../constants';
import { findPath } from '../map/pathfinding';
import type { Point } from '../map/obstacles';
import type { Entrance } from '../interiors/interiors';
import { bumpsFurniture } from '../interiors/furniture';
import { layoutOf } from '../interiors/indoors';
import { NPC_RADIUS, bumpsNpc, type Npc } from './npcs';
import type { NpcWorld } from './npcRoutine';

const WALK_SPEED = 1.1;
const PATH_RADIUS = 24; // tiles searched for a way
const STUCK_TIME = 3; // seconds without getting anywhere before skipping ahead
const PROGRESS = 0.02; // tiles nearer the next point that count as getting somewhere
// How near each villager has come to the point they're walking to (a new point starts afresh).
const closest = new WeakMap<Npc, { to: Point; d: number }>();
const EASE_SPEED = 1.2; // how fast a villager eases off the hero, when they overlap
const BARELY = 0.02; // overlapping the hero by less than this: just touching
const MAKE_WAY = 0.12; // this near the hero (past touching), and in their way: making way (the hero's next step would touch)

// Where someone fits in a building's room. Behind the inn's bar (between
// the counter and the wall, along its length) is the barmaids' alone.
export function roomFree(seed: number, entrance: Entrance, staff = false): (x: number, z: number) => boolean {
  const { room, furniture } = layoutOf(seed, entrance);
  const r = NPC_RADIUS * INDOOR_SCALE;
  const counter = staff ? undefined : furniture.find((f) => f.kind === 'counter');
  const behindBar = (x: number, z: number) => !!counter && x - r < counter.x && z - r < counter.z + counter.d - 0.5;
  return (x, z) =>
    x >= -0.5 + r && z >= -0.5 + r && x <= room.width - 0.5 - r && z <= room.depth - 0.5 - r && !bumpsFurniture(furniture, x, z, r) && !behindBar(x, z);
}

// Whether the hero stands on (x, z) in `where` (a building, or outdoors):
// nowhere to put a villager down.
export function heroOn(world: NpcWorld, where: Entrance | null, x: number, z: number): boolean {
  if ((world.inside?.entrance ?? null) !== where) return false;
  const reach = (NPC_RADIUS + HERO_RADIUS) * (where ? INDOOR_SCALE : 1);
  return Math.hypot(world.hero.x - x, world.hero.z - z) < reach;
}

// A villager overlapping the hero (put down on them, or pressed together)
// eases away from them (straight away, else aslant, else sideways), and does
// nothing else meanwhile; returns whether it did. Hemmed in (furniture all
// that way), it gets on with what it was doing instead, so neither's stuck.
export function easeOffHero(npc: Npc, world: NpcWorld, dt: number): boolean {
  if (npc.seat || !heroOn(world, npc.where, npc.x, npc.z)) return false;
  const reach = (NPC_RADIUS + HERO_RADIUS) * (npc.where ? INDOOR_SCALE : 1);
  const dx = npc.x - world.hero.x;
  const dz = npc.z - world.hero.z;
  const d = Math.hypot(dx, dz);
  if (reach - d < BARELY) return false; // (just touching: not worth easing off, and it'd never quite get clear)
  const [ux, uz] = d > 1e-4 ? [dx / d, dz / d] : [Math.sin(npc.id), Math.cos(npc.id)]; // right on them: off some way of its own
  return stepAway(npc, world, ux, uz, Math.min(reach - d, EASE_SPEED * dt));
}

// A villager the hero walks into (all but touching them, ahead of them) makes way:
// steps off from them, as easing off, so the hero's never held up by
// someone stood still. `dirX, dirZ`: the way the hero's pressing.
export function makeWay(npcs: readonly Npc[], world: NpcWorld, dirX: number, dirZ: number, dt: number): void {
  const where = world.inside?.entrance ?? null;
  const reach = (NPC_RADIUS + HERO_RADIUS) * (where ? INDOOR_SCALE : 1) + MAKE_WAY;
  const { hero } = world;
  for (const npc of npcs) {
    if (npc.where !== where || npc.seat || Math.abs(npc.x - hero.x) > reach || Math.abs(npc.z - hero.z) > reach) continue;
    const [dx, dz] = [npc.x - hero.x, npc.z - hero.z];
    const d = Math.hypot(dx, dz);
    if (d >= reach || d < 1e-4 || dx * dirX + dz * dirZ <= 0) continue; // (not that near, or not in the way)
    stepAway(npc, world, dx / d, dz / d, EASE_SPEED * dt);
  }
}

// A step of `step` along (ux, uz), else aslant, else sideways, wherever there's room; returns whether it took one.
function stepAway(npc: Npc, world: NpcWorld, ux: number, uz: number, step: number): boolean {
  const free = npc.where ? roomFree(world.seed, npc.where, npc.role !== 'villager') : (x: number, z: number) => !world.isBlocked(x, z, NPC_RADIUS);
  for (const turn of [0, 0.8, -0.8, 1.6, -1.6]) {
    const [cos, sin] = [Math.cos(turn), Math.sin(turn)];
    const [nx, nz] = [npc.x + (ux * cos - uz * sin) * step, npc.z + (ux * sin + uz * cos) * step];
    if (!free(nx, nz)) continue;
    npc.x = nx;
    npc.z = nz;
    if (!npc.where) npc.y = world.getGroundY(nx, nz);
    return true;
  }
  return false;
}

// Stands a villager at a point, on the ground there.
export function place(npc: Npc, world: NpcWorld, at: Point): void {
  npc.x = at.x;
  npc.z = at.z;
  npc.y = npc.where ? 0 : world.getGroundY(at.x, at.z);
}

// One frame's walk toward `to`, along a path around what's in the way;
// returns whether they've arrived (or given up on getting any closer).
export function walk(npc: Npc, npcs: readonly Npc[], world: NpcWorld, to: Point, dt: number, direct = false): boolean {
  const indoors = npc.where;
  const free = indoors ? roomFree(world.seed, indoors, npc.role !== 'villager') : (x: number, z: number) => !world.isBlocked(x, z, NPC_RADIUS);
  // The way there goes round the hero too, where they stand now.
  if (!npc.path) npc.path = direct ? [to] : [...findPath(npc, to, PATH_RADIUS, (x, z) => free(x, z) && !heroOn(world, indoors, x, z)), to];
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
    // Only getting closer counts as getting anywhere: shuffling along a wall
    // (or round the hero) without nearing the point runs the stuck clock on.
    const now = Math.hypot(next.x - npc.x, next.z - npc.z);
    const best = closest.get(npc);
    if (!best || best.to !== next || now < best.d - PROGRESS) {
      closest.set(npc, { to: next, d: now });
      npc.waited = 0;
    } else npc.waited += dt;
    if (!indoors) npc.y = world.getGroundY(npc.x, npc.z);
    if (npc.waited < STUCK_TIME) return false;
  } else {
    npc.waited += dt;
    if (npc.waited < STUCK_TIME) return false;
  }
  // Stuck: past this point after a while (or done, if it was the last).
  npc.waited = 0;
  closest.delete(npc);
  if (heroOn(world, npc.where, next.x, next.z)) {
    // The hero's standing there: that'll do, if it was where they were going; else a way round them.
    if (npc.path.length === 1) {
      npc.path = [];
      return true;
    }
    npc.path = null;
    return false;
  }
  place(npc, world, npc.path.shift()!);
  return npc.path.length === 0;
}
