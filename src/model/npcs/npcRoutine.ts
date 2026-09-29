// A villager's day, one step at a time (npcs.ts NpcStep). At each stop of
// the routine they get their steps: to go home or to the inn, out of where
// they are, to its door, in, and settling down there a while; to the
// square, out and to two spots on it in turn, pausing at each (the
// second, sometimes, a free seat on one of its benches); to a
// farmer's field, out and to a few spots in it, working each a while. Settling
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
import type { Field, Village } from '../types';
import type { Entrance } from '../interiors/interiors';
import { bumpsFurniture, distanceTo, seatOf, type Furniture, type Seat } from '../interiors/furniture';
import { layoutOf, type Inside, type Seated } from '../interiors/indoors';
import { squareBenches, type BenchWorld } from '../worldgen/benches';
import { atBar, busyAtBar, sitAtBar } from './barPatrons';
import { FARMER_ROUTINE, NPC_RADIUS, ROUTINE, bumpsNpc, type Npc, type NpcStep } from './npcs';
import { staffSteps } from './innStaff';

export interface NpcWorld extends BenchWorld {
  seed: number;
  hero: { x: number; z: number };
  inside: Inside | null; // the hero's
  outdoors: { seated: Seated }; // the hero on a bench
  isBlocked(x: number, z: number, r: number): boolean;
  isOpenTile(x: number, z: number): boolean;
  getGroundY(x: number, z: number): number;
}

const WALK_SPEED = 1.1;
const PATH_RADIUS = 24; // tiles searched for a way
const STUCK_TIME = 3; // seconds without getting anywhere before skipping ahead
const PROGRESS = 0.02; // tiles nearer the next point that count as getting somewhere
// How near each villager has come to the point they're walking to (a new point starts afresh).
const closest = new WeakMap<Npc, { to: Point; d: number }>();
const HOME_TIME: [number, number] = [30, 90]; // seconds settled at home
const INN_TIME: [number, number] = [30, 70];
const SQUARE_WAIT: [number, number] = [5, 15];
const FIELD_WORK: [number, number] = [6, 14]; // seconds at each spot in a field
const SIT_CHANCE = 0.75;
const BAR_PULL = 0.5; // at the inn, of making for a stool at the bar (rather than any seat)
const BENCH_CHANCE = 0.5; // of sitting on a bench, for the second spot on the square
const BEFORE_BENCH = 0.62; // how far in front of a bench's seat one stands to sit down
const EASE_SPEED = 1.2; // how fast a villager eases off the hero, when they overlap
const INN_CHANCE = 0.25; // of going, when the routine comes to the inn
const INN_CAP = 4; // villagers at an inn at once, at most (its barmaids aside)

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
// The inn is only now and then, and never past full: otherwise that stop's
// spent at home or on the square instead.
function plan(npc: Npc, npcs: readonly Npc[], world: NpcWorld): NpcStep[] {
  const routine = npc.field ? FARMER_ROUTINE : ROUTINE;
  let stop = routine[npc.stop % routine.length];
  if (stop === 'inn' && (roll(npc, 13) >= INN_CHANCE || !npc.inn || patrons(npcs, npc.inn) >= INN_CAP)) stop = roll(npc, 14) < 0.5 ? 'home' : 'square';
  npc.stop++;
  const steps: NpcStep[] = [];
  const leave = () => {
    if (npc.where) steps.push({ kind: 'go', to: doorTile(world.seed, npc.where) }, { kind: 'exit' });
  };
  if (stop === 'field' && npc.field) {
    // Out to their field, and a few spots in it worked in turn.
    leave();
    const spots = 3 + Math.floor(roll(npc, 15) * 2);
    for (let k = 0; k < spots; k++) steps.push({ kind: 'go', to: fieldSpot(npc, npc.field, k) }, { kind: 'work', for: between(npc, FIELD_WORK, 16 + k) });
    return steps;
  }
  if (stop === 'square') {
    leave();
    steps.push({ kind: 'go', to: squareSpot(npc, world, 0) }, { kind: 'wait', for: between(npc, SQUARE_WAIT, 10) });
    const seat = roll(npc, 17) < BENCH_CHANCE ? benchSeat(npc, npcs, world) : null;
    const [fx, fz] = seat?.piece.facing ?? [0, 0];
    if (seat) steps.push({ kind: 'go', to: { x: seat.x + fx * BEFORE_BENCH, z: seat.z + fz * BEFORE_BENCH } }, { kind: 'sit', seat, for: between(npc, SQUARE_WAIT, 11) });
    else steps.push({ kind: 'go', to: squareSpot(npc, world, 1) }, { kind: 'wait', for: between(npc, SQUARE_WAIT, 11) });
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

// A tile of wheat in a field (not its corner, heaped with bales), from the routine.
function fieldSpot(npc: Npc, field: Field, k: number): Point {
  for (let tries = 0; tries < 8; tries++) {
    const x = field.x0 + Math.floor(roll(npc, 70 + k * 11 + tries) * field.width);
    const z = field.z0 + Math.floor(roll(npc, 90 + k * 11 + tries) * field.depth);
    if (x !== field.corner[0] || z !== field.corner[1]) return { x, z };
  }
  return { x: field.gate[0], z: field.gate[1] };
}

// Villagers at an inn, or on their way in.
function patrons(npcs: readonly Npc[], inn: Entrance): number {
  return npcs.filter((o) => o.role === 'villager' && o.inn === inn && (o.where === inn || o.steps.some((s) => s.kind === 'enter' && s.entrance === inn))).length;
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

// A free seat on one of their village's benches, picked from the routine; else null.
function benchSeat(npc: Npc, npcs: readonly Npc[], world: NpcWorld): Seat | null {
  const seats = squareBenches(world)
    .filter((b) => world.villages[b.village] === npc.village)
    .flatMap((b) => b.seats)
    .filter((seat) => !claimed(seat.piece, npc, npcs, world, null)); // outdoors, wherever they are now
  return seats[Math.floor(roll(npc, 18) * seats.length)] ?? null;
}

// Whether the hero's on a piece of furniture (or a bench seat), where `where` is.
function heroOnPiece(world: NpcWorld, where: Entrance | null, piece: Furniture): boolean {
  return where ? world.inside?.entrance === where && world.inside.seated?.seat.piece === piece : world.outdoors.seated?.seat.piece === piece;
}

// Whether someone else is on a piece of furniture (in `where`: a room, or null outdoors), or on their way to it.
function claimed(piece: Furniture, npc: Npc, npcs: readonly Npc[], world: NpcWorld, where = npc.where): boolean {
  if (heroOnPiece(world, where, piece)) return true;
  return npcs.some((o) => o !== npc && (o.seat?.piece === piece || o.steps.some((s) => s.kind === 'sit' && s.seat.piece === piece)));
}

// Settling in a room: a free seat (their own bed only at home) and the free
// tile beside it to sit down from, else a free tile to stand on.
function settle(npc: Npc, npcs: readonly Npc[], world: NpcWorld, seconds: number): NpcStep[] {
  const { room, furniture } = layoutOf(world.seed, npc.where!);
  const free = roomFree(world.seed, npc.where!);
  const tiles: Point[] = [];
  for (let x = 0; x < room.width; x++) for (let z = 0; z < room.depth - 1; z++) if (free(x, z)) tiles.push({ x, z });
  const atInn = npc.where !== npc.home; // at the inn: always a seat, if there's one free
  if (atInn || roll(npc, 30) < SIT_CHANCE) {
    const seats = furniture
      .map((piece) => seatOf(piece))
      .filter((seat): seat is Seat => !!seat && (!seat.lying || npc.where === npc.home) && !claimed(seat.piece, npc, npcs, world));
    // At the inn, the bar draws them: often a free stool there first, then any seat.
    const stools = seats.filter((seat) => seat.piece.kind === 'barStool');
    const first = stools.length > 0 && roll(npc, 33) < BAR_PULL ? stools : seats;
    const start = Math.floor(roll(npc, 31) * first.length);
    const order = [...first.slice(start), ...first.slice(0, start), ...seats.filter((seat) => !first.includes(seat))];
    // The first of them with a free tile beside it to sit down from.
    for (const seat of order) {
      const from = tiles.filter((t) => distanceTo(seat.piece, t.x, t.z) <= 0.6).sort((a, b) => distanceTo(seat.piece, a.x, a.z) - distanceTo(seat.piece, b.x, b.z))[0];
      if (from) return [{ kind: 'go', to: from }, { kind: 'sit', seat, for: seconds }];
    }
  }
  // Nowhere to sit: standing, at the inn turned to the bar (waiting on a place there).
  const spot = tiles[Math.floor(roll(npc, 32) * tiles.length)] ?? doorTile(world.seed, npc.where!);
  const counter = atInn ? furniture.find((f) => f.kind === 'counter') : undefined;
  return [{ kind: 'go', to: spot, ...(counter && { faceToward: { x: counter.x, z: spot.z } }) }, { kind: 'wait', for: seconds }];
}

// Where someone fits in a building's room. Behind the inn's bar (between
// the counter and the wall, along its length) is the barmaids' alone.
function roomFree(seed: number, entrance: Entrance, staff = false): (x: number, z: number) => boolean {
  const { room, furniture } = layoutOf(seed, entrance);
  const r = NPC_RADIUS * INDOOR_SCALE;
  const counter = staff ? undefined : furniture.find((f) => f.kind === 'counter');
  const behindBar = (x: number, z: number) => !!counter && x - r < counter.x && z - r < counter.z + counter.d - 0.5;
  return (x, z) =>
    x >= -0.5 + r && z >= -0.5 + r && x <= room.width - 0.5 - r && z <= room.depth - 0.5 - r && !bumpsFurniture(furniture, x, z, r) && !behindBar(x, z);
}

// Whether the hero stands on (x, z) in `where` (a building, or outdoors):
// nowhere to put a villager down.
function heroOn(world: NpcWorld, where: Entrance | null, x: number, z: number): boolean {
  if ((world.inside?.entrance ?? null) !== where) return false;
  const reach = (NPC_RADIUS + HERO_RADIUS) * (where ? INDOOR_SCALE : 1);
  return Math.hypot(world.hero.x - x, world.hero.z - z) < reach;
}

// A villager overlapping the hero (put down on them, or pressed together)
// eases away from them, and does nothing else meanwhile; returns whether it did.
function easeOffHero(npc: Npc, world: NpcWorld, dt: number): boolean {
  if (npc.seat || !heroOn(world, npc.where, npc.x, npc.z)) return false;
  const reach = (NPC_RADIUS + HERO_RADIUS) * (npc.where ? INDOOR_SCALE : 1);
  const dx = npc.x - world.hero.x;
  const dz = npc.z - world.hero.z;
  const d = Math.hypot(dx, dz);
  const [ux, uz] = d > 1e-4 ? [dx / d, dz / d] : [Math.sin(npc.id), Math.cos(npc.id)]; // right on them: off some way of its own
  const step = Math.min(reach - d, EASE_SPEED * dt);
  const free = npc.where ? roomFree(world.seed, npc.where, npc.role !== 'villager') : (x: number, z: number) => !world.isBlocked(x, z, NPC_RADIUS);
  const [nx, nz] = [npc.x + ux * step, npc.z + uz * step];
  if (free(nx, nz)) {
    npc.x = nx;
    npc.z = nz;
    if (!npc.where) npc.y = world.getGroundY(nx, nz);
  }
  return true;
}

function act(npc: Npc, npcs: readonly Npc[], world: NpcWorld, seen: boolean, dt: number): void {
  npc.moving = false;
  if (seen && easeOffHero(npc, world, dt)) return;
  if (npc.steps.length === 0) npc.steps = npc.role === 'villager' ? plan(npc, npcs, world) : staffSteps(npc, npcs, world.seed);
  const step = npc.steps[0];
  const done = () => {
    npc.steps.shift();
    npc.path = null;
    npc.waited = 0;
  };
  switch (step.kind) {
    case 'go':
      // Out of sight, they're simply there; in sight, they walk. Then they
      // turn the way the step says, if it says.
      if (!seen) place(npc, world, step.to);
      if (!seen || walk(npc, npcs, world, step.to, dt, step.direct)) {
        if (step.face !== undefined) npc.facing = step.face;
        if (step.faceToward) npc.facing = Math.atan2(step.faceToward.x - npc.x, step.faceToward.z - npc.z);
        done();
      }
      return;
    case 'enter': {
      const inside = doorTile(world.seed, step.entrance);
      if (heroOn(world, step.entrance, inside.x, inside.z)) return; // the hero's in the doorway: wait
      npc.where = step.entrance;
      place(npc, world, inside);
      npc.facing = Math.PI; // into the room
      done();
      return;
    }
    case 'exit': {
      const door = npc.where!;
      if (heroOn(world, null, door.x, door.z)) return; // the hero's outside the door: wait
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
      const sitting = npc.seat === step.seat; // down already (not by the clock: at the bar, it waits on the ale)
      if (!sitting && heroOnPiece(world, npc.where, step.seat.piece)) {
        npc.steps.splice(0, 1, { kind: 'wait', for: step.for }); // the hero took it meanwhile: stand instead
        return;
      }
      if (!sitting) {
        if (npc.where && step.seat.piece.kind === 'barStool') sitAtBar(npc, npcs, step.seat.piece); // an ale ordered
        npc.stood = { x: npc.x, z: npc.z };
        npc.seat = step.seat;
        npc.x = step.seat.x;
        npc.z = step.seat.z;
        npc.y = step.seat.y;
        npc.facing = step.seat.facing;
      }
      // At the bar, the stay counts only once served; they don't get up still waiting, or mid-drink.
      const atTheBar = !!npc.where && step.seat.piece.kind === 'barStool';
      if (!atTheBar || atBar(npc, npcs, step.seat.piece, dt, step.for - npc.waited)) npc.waited += dt;
      if (npc.waited >= step.for && !(atTheBar && busyAtBar(npc)) && !heroOn(world, npc.where, npc.stood!.x, npc.stood!.z)) {
        place(npc, world, npc.stood!);
        npc.seat = null;
        npc.stood = null;
        done();
      }
      return;
    case 'hand':
      step.then();
      done();
      return;
    case 'wait':
    case 'work':
      npc.working = step.kind === 'work';
      npc.waited += dt;
      if (npc.waited >= step.for) {
        npc.working = false;
        done();
      }
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
function walk(npc: Npc, npcs: readonly Npc[], world: NpcWorld, to: Point, dt: number, direct = false): boolean {
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
