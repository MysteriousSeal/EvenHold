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
import { stepGroup } from './group';
import { stepToward } from './moving';
import type { DeerVariant, Wildlife } from './animal';

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

// Toward (tx, tz) at up to `speed`; returns how far it went.
const go = (deer: Wildlife, world: DeerWorld, tx: number, tz: number, speed: number, dt: number) =>
  stepToward(deer, (x, z) => walkable(world, x, z), tx, tz, speed, dt, (x, z) => world.getGroundY(x, z));

// Open grass with a few trees nearby (`trees`: the tiles with one), far from people.
function meadow(world: DeerWorld, trees: Uint8Array, x: number, z: number): boolean {
  if (!inBounds(world.size, x, z) || !world.isOpenTile(x, z) || world.surfaceMap[x][z] !== 'natural') return false;
  // (squared: the same answer as the distance for tiles, far cheaper against hundreds of villages)
  if (world.villages.some((v) => (v.x - x) ** 2 + (v.z - z) ** 2 < AWAY_FROM_VILLAGES ** 2)) return false;
  if (world.camps.some((c) => (c.x - x) ** 2 + (c.z - z) ** 2 < AWAY_FROM_CAMPS ** 2)) return false;
  let near = 0;
  for (let dx = -WOODS_NEAR; dx <= WOODS_NEAR; dx++) {
    for (let dz = -WOODS_NEAR; dz <= WOODS_NEAR; dz++) if (trees[(x + dx) * world.size.depth + z + dz] === 1 && ++near >= 3) return true;
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
  const trees = new Uint8Array(world.size.width * world.size.depth); // (a grid of the half-million trees, by x * depth + z)
  for (const t of world.trees) trees[t.x * world.size.depth + t.z] = 1;
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

// One frame for a herd (group.ts): the fawns keep by their mothers, the rest round the leader.
export function stepDeerHerd(herd: Wildlife[], world: DeerWorld, hero: { x: number; z: number }, dt: number): void {
  stepGroup(herd, {
    fits: (x, z) => walkable(world, x, z),
    go: (deer, tx, tz, speed, t) => go(deer, world, tx, tz, speed, t),
    place: (deer, _i, leader) => {
      const by = deer.mother ?? leader;
      const [ox, oz] = place(deer);
      return { x: by.x + ox, z: by.z + oz };
    },
    walk: WALK_SPEED,
    flee: FLEE_SPEED,
    catchUp: FOLLOW_CATCH_UP,
    slack: SLACK,
    settle: 0.03,
    wander: WANDER,
    fleeRadius: FLEE_RADIUS,
    calmRadius: CALM_RADIUS,
    fleeDistance: FLEE_DISTANCE,
    fleeNear: 0.2,
    rest: [3, 4],
    feedTime: GRAZE_TIME,
    feedChance: 0.7,
    feedLag: 2,
    salt: 60,
  }, hero, dt);
}
