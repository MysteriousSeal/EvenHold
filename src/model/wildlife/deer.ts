// Deer: herds of one to seven grazing in meadows by the woods, away from
// villages and camps: a stag, does, and fawns, each fawn beside its mother
// (a fawn is never without her). The first of each herd leads (a doe if
// there is one): it wanders around home, rests, and grazes; the adults keep
// loosely around it and each fawn close by its mother. When the hero comes
// near, the whole herd bounds away together, and settles once the hero's gone.
//
// Placed from hashes, like the ducks, so the world rng is untouched; their
// choices come from hashes of where they are, so tests are repeatable.

import { hashUnit } from '../../util/random';
import { inBounds, type MapSize } from '../grid';
import type { Surface, Tree, Village } from '../types';
import type { Camp } from '../camps/camps';
import type { DeerVariant, Wildlife } from './wildlife';

export interface DeerWorld {
  seed: number;
  size: MapSize;
  surfaceMap: Surface[][];
  villages: Village[];
  camps: Camp[];
  trees: Tree[];
  isOpenTile(x: number, z: number): boolean;
  isBlocked(x: number, z: number, r: number): boolean; // water, buildings, props, fences
  getGroundY(x: number, z: number): number;
}

const GRID = 14; // one candidate herd per GRID x GRID tiles
const CHANCE = 0.55; // of a herd, where there's a meadow by the woods
const RADIUS = 0.16; // a deer's footprint, for walking around things
const WALK_SPEED = 0.5;
const FLEE_SPEED = 2.6; // bounding away
const FOLLOW_CATCH_UP = 1.4; // followers can go this much faster than the leader, to keep up
const SLACK = 0.25; // a follower lets its place drift this far before walking back to it
const WANDER = 4; // tiles from home
const FLEE_RADIUS = 3.5; // the hero this close sends the herd off
const CALM_RADIUS = 7; // and this far lets it settle
const FLEE_DISTANCE = 6;
const AWAY_FROM_VILLAGES = 12; // tiles
const AWAY_FROM_CAMPS = 9;
const WOODS_NEAR = 5; // trees within this many tiles make it a meadow by the woods
export const GRAZE_TIME = 3.5; // seconds with the head down

// Room for a deer at (x, z): on the map and nothing in the way.
function walkable(world: DeerWorld, x: number, z: number): boolean {
  return x > 0.5 && z > 0.5 && x < world.size.width - 1.5 && z < world.size.depth - 1.5 && !world.isBlocked(x, z, RADIUS);
}

// Open grass with a few trees nearby (`trees`: the tiles with one), far from people.
function meadow(world: DeerWorld, trees: Set<number>, x: number, z: number): boolean {
  if (!inBounds(world.size, x, z) || !world.isOpenTile(x, z) || world.surfaceMap[x][z] !== 'natural') return false;
  if (world.villages.some((v) => Math.hypot(v.x - x, v.z - z) < AWAY_FROM_VILLAGES)) return false;
  if (world.camps.some((c) => Math.hypot(c.x - x, c.z - z) < AWAY_FROM_CAMPS)) return false;
  let near = 0;
  for (let dx = -WOODS_NEAR; dx <= WOODS_NEAR; dx++) {
    for (let dz = -WOODS_NEAR; dz <= WOODS_NEAR; dz++) if (trees.has((x + dx) * world.size.depth + z + dz) && ++near >= 3) return true;
  }
  return false;
}

// Who's in a herd, leader first then the other adults, fawns last: a lone
// stag or doe; or does (with a stag, often), each with no, one or two fawns.
function herdOf(roll: (n: number) => number): { variant: DeerVariant; mother?: number }[] {
  if (roll(50) < 0.12) return [{ variant: 'stag' }];
  if (roll(51) < 0.14) return [{ variant: 'doe' }];
  const does = 1 + Math.floor(roll(52) * 3);
  const herd: { variant: DeerVariant; mother?: number }[] = Array.from({ length: does }, () => ({ variant: 'doe' }));
  if (roll(53) < 0.6) herd.push({ variant: 'stag' });
  for (let doe = 0; doe < does && herd.length < 7; doe++) {
    const fawns = Math.floor(roll(54 + doe) * 3);
    for (let i = 0; i < fawns && herd.length < 7; i++) herd.push({ variant: 'fawn', mother: doe });
  }
  return herd;
}

function makeDeer(id: number, variant: DeerVariant, x: number, z: number, heading: number, world: DeerWorld): Wildlife {
  return {
    id,
    kind: 'deer',
    variant,
    x,
    z,
    y: world.getGroundY(x, z),
    heading,
    homeX: x,
    homeZ: z,
    pack: [],
    mother: null,
    target: null,
    restFor: hashUnit(Math.round(x * 10), Math.round(z * 10), 57) * 3,
    dabble: null,
    fleeing: false,
    speed: 0,
  };
}

// Where a follower keeps, from whoever it follows (the leader, or a fawn's
// mother): a spot of its own around them, from its id.
function place(deer: Wildlife): [number, number] {
  const angle = hashUnit(deer.id, 0, 58) * Math.PI * 2;
  const distance = deer.variant === 'fawn' ? 0.35 : 0.7 + hashUnit(deer.id, 0, 59) * 0.6;
  return [Math.sin(angle) * distance, Math.cos(angle) * distance];
}

export function spawnDeer(world: DeerWorld, firstId: number): Wildlife[] {
  const deer: Wildlife[] = [];
  const salt = world.seed % 1000;
  const trees = new Set(world.trees.map((t) => t.x * world.size.depth + t.z));
  for (let gx = 0; gx < world.size.width; gx += GRID) {
    for (let gz = 0; gz < world.size.depth; gz += GRID) {
      const roll = (n: number) => hashUnit(gx, gz, salt + n);
      if (roll(60) > CHANCE) continue;
      const x = gx + Math.floor(roll(61) * GRID);
      const z = gz + Math.floor(roll(62) * GRID);
      if (!meadow(world, trees, x, z)) continue;
      const heading = roll(63) * Math.PI * 2;
      const members = herdOf(roll);
      const herd = members.map(({ variant }, i) => makeDeer(firstId + deer.length + i, variant, x, z, heading, world));
      members.forEach(({ mother }, i) => (herd[i].mother = mother === undefined ? null : herd[mother]));
      for (const member of herd) {
        member.pack = herd;
        if (member === herd[0]) continue;
        // Around the leader (a fawn by its mother), where there's room.
        const by = member.mother ?? herd[0];
        const [ox, oz] = place(member);
        if (walkable(world, by.x + ox, by.z + oz)) {
          member.x = by.x + ox;
          member.z = by.z + oz;
          member.y = world.getGroundY(member.x, member.z);
        }
      }
      deer.push(...herd);
    }
  }
  return deer;
}

// Moves a deer by (dx, dz), axis by axis so it slides along what's in the
// way; returns how far it went.
function walk(deer: Wildlife, world: DeerWorld, dx: number, dz: number): number {
  const x0 = deer.x;
  const z0 = deer.z;
  if (walkable(world, deer.x + dx, deer.z)) deer.x += dx;
  if (walkable(world, deer.x, deer.z + dz)) deer.z += dz;
  const moved = Math.hypot(deer.x - x0, deer.z - z0);
  if (moved > 1e-6) {
    deer.heading = Math.atan2(deer.x - x0, deer.z - z0);
    deer.y = world.getGroundY(deer.x, deer.z);
  }
  return moved;
}

// Heads toward (tx, tz) at up to `speed`; returns how far it went.
function walkToward(deer: Wildlife, world: DeerWorld, tx: number, tz: number, speed: number, dt: number): number {
  const dx = tx - deer.x;
  const dz = tz - deer.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return 0;
  const step = Math.min(speed * dt, d);
  return walk(deer, world, (dx / d) * step, (dz / d) * step);
}

// Somewhere away from the hero: straight away if there's room, else
// turning a little either way, else closer.
function fleeTarget(deer: Wildlife, world: DeerWorld, hero: { x: number; z: number }): { x: number; z: number } | null {
  const away = Math.atan2(deer.x - hero.x, deer.z - hero.z);
  for (const distance of [FLEE_DISTANCE, FLEE_DISTANCE * 0.6, FLEE_DISTANCE * 0.35]) {
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
      const x = deer.x + Math.sin(away + turn) * distance;
      const z = deer.z + Math.cos(away + turn) * distance;
      if (walkable(world, x, z)) return { x, z };
    }
  }
  return null;
}

// A roll from where a deer is now, so choices vary as it moves but repeat exactly.
const rollAt = (deer: Wildlife, salt: number) => hashUnit(Math.round(deer.x * 100), Math.round(deer.z * 100), salt + deer.id);

// One frame for a herd: fleeing or calm, the leader's wandering and
// resting, the others keeping their places, and everyone's grazing.
export function stepDeerHerd(herd: Wildlife[], world: DeerWorld, hero: { x: number; z: number }, dt: number): void {
  const leader = herd[0];
  const near = Math.min(...herd.map((d) => Math.hypot(d.x - hero.x, d.z - hero.z)));
  if (!leader.fleeing && near < FLEE_RADIUS) {
    for (const deer of herd) {
      deer.fleeing = true;
      deer.dabble = null;
    }
    leader.target = null;
  } else if (leader.fleeing && near > CALM_RADIUS) {
    for (const deer of herd) deer.fleeing = false;
    leader.target = null;
    leader.restFor = 1 + rollAt(leader, 60) * 2;
  }

  for (const deer of herd) {
    if (deer.dabble === null) continue;
    deer.dabble += dt;
    if (deer.dabble >= GRAZE_TIME) deer.dabble = null;
  }

  // The leader.
  let moved = 0;
  if (leader.fleeing) {
    if (!leader.target || Math.hypot(leader.target.x - leader.x, leader.target.z - leader.z) < 0.2) leader.target = fleeTarget(leader, world, hero);
    if (leader.target) moved = walkToward(leader, world, leader.target.x, leader.target.z, FLEE_SPEED, dt);
    if (leader.target && moved === 0) leader.target = null; // cornered: look again next frame
  } else if (!leader.target) {
    leader.restFor -= dt;
    if (leader.restFor <= 0) {
      const x = leader.homeX + (rollAt(leader, 61) - 0.5) * 2 * WANDER;
      const z = leader.homeZ + (rollAt(leader, 62) - 0.5) * 2 * WANDER;
      if (walkable(world, x, z)) leader.target = { x, z };
      else leader.restFor = 0.3; // try somewhere else shortly
    }
  } else {
    moved = walkToward(leader, world, leader.target.x, leader.target.z, WALK_SPEED, dt);
    if (moved === 0 || Math.hypot(leader.target.x - leader.x, leader.target.z - leader.z) < 0.05) {
      // Arrived (or something's in the way): rest, and graze. The others
      // may graze too, each starting a moment later.
      leader.target = null;
      leader.restFor = 3 + rollAt(leader, 63) * 4;
      moved = 0;
      herd.forEach((deer, i) => {
        if (rollAt(deer, 64) < 0.7) deer.dabble = i === 0 ? 0 : -rollAt(deer, 65) * 2;
      });
    }
  }
  leader.speed = moved / dt;

  // The others (adults before fawns, so each mother has moved first): each
  // to its place around the leader, or its mother.
  const pace = (leader.fleeing ? FLEE_SPEED : WALK_SPEED) * FOLLOW_CATCH_UP;
  for (const deer of herd) {
    if (deer === leader) continue;
    const by = deer.mother ?? leader;
    const [ox, oz] = place(deer);
    const off = Math.hypot(by.x + ox - deer.x, by.z + oz - deer.z);
    const step = off > (deer.speed > 0 ? 0.03 : SLACK) ? walkToward(deer, world, by.x + ox, by.z + oz, pace, dt) : 0;
    deer.speed = step / dt;
  }

  // Deer on the move stop grazing (one still settling may yet start).
  for (const deer of herd) if (deer.speed > 0.05 && deer.dabble !== null && deer.dabble >= 0) deer.dabble = null;
}
