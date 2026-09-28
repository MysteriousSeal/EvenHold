// Ducks: packs of two or three on open water (a drake and a hen, maybe a
// duckling, or a hen with two ducklings). The first of each pack leads: it
// drifts around home, rests, and sometimes dabbles (tips headfirst to feed);
// the others trail behind it in a line. When the hero comes near, the whole
// pack paddles away across the water, and settles once the hero's gone.
// They keep a little off the shore and never leave the water.
//
// Placed from hashes, like enemies, so the world rng is untouched; their
// choices come from hashes of where they are, so tests are repeatable.

import { TILE_HEIGHT, WATER_LEVEL } from '../constants';
import { inBounds, type MapSize } from '../grid';
import { hashUnit } from '../../util/random';
import type { DuckVariant, Wildlife } from './wildlife';

export interface DuckWorld {
  seed: number;
  size: MapSize;
  lakeMap: boolean[][];
}

export const WATER_Y = WATER_LEVEL * TILE_HEIGHT; // the lakes' surface
const GRID = 12; // one candidate pack per GRID x GRID tiles
const CHANCE = 0.6; // of a pack, where there's open water
const SHORE_MARGIN = 0.3; // how far off the bank they keep
const PADDLE_SPEED = 0.45;
const FLEE_SPEED = 1.5;
const FOLLOW_CATCH_UP = 1.4; // followers can go this much faster than the leader, to keep up
const SPACING = 0.32; // between ducks in a line
const SLACK = 0.12; // a follower lets its place drift this far before paddling back to it
const WANDER = 3; // tiles from home
const FLEE_RADIUS = 2.5; // the hero this close sends the pack off
const CALM_RADIUS = 4.5; // and this far lets it settle
const FLEE_DISTANCE = 3;
export const DABBLE_TIME = 1.8; // seconds tipped up

// Water under all four corners of a square around (x, z): room to swim.
export function swimmable(world: DuckWorld, x: number, z: number): boolean {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = Math.round(x + dx * SHORE_MARGIN);
    const tz = Math.round(z + dz * SHORE_MARGIN);
    if (!inBounds(world.size, tx, tz) || !world.lakeMap[tx][tz]) return false;
  }
  return true;
}

// A tile with water all around it.
function openWater(world: DuckWorld, x: number, z: number): boolean {
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) if (!inBounds(world.size, x + dx, z + dz) || !world.lakeMap[x + dx][z + dz]) return false;
  }
  return true;
}

function makeDuck(id: number, variant: DuckVariant, x: number, z: number, heading: number): Wildlife {
  return {
    id,
    kind: 'duck',
    variant,
    x,
    z,
    y: WATER_Y,
    heading,
    homeX: x,
    homeZ: z,
    pack: [],
    mother: null,
    target: null,
    restFor: hashUnit(Math.round(x * 10), Math.round(z * 10), 37) * 3,
    dabble: null,
    fleeing: false,
    speed: 0,
  };
}

export function spawnDucks(world: DuckWorld, firstId: number): Wildlife[] {
  const ducks: Wildlife[] = [];
  const salt = world.seed % 1000;
  for (let gx = 0; gx < world.size.width; gx += GRID) {
    for (let gz = 0; gz < world.size.depth; gz += GRID) {
      const roll = (n: number) => hashUnit(gx, gz, salt + n);
      if (roll(33) > CHANCE) continue;
      const x = gx + Math.floor(roll(31) * GRID);
      const z = gz + Math.floor(roll(32) * GRID);
      if (!inBounds(world.size, x, z) || !openWater(world, x, z)) continue;
      const variants: DuckVariant[] = roll(34) < 0.5 ? ['drake', 'hen'] : roll(35) < 0.6 ? ['drake', 'hen', 'duckling'] : ['hen', 'duckling', 'duckling'];
      const heading = roll(36) * Math.PI * 2;
      const pack = variants.map((variant, i) => {
        // In a line behind the leader, where there's water for it.
        const bx = x - Math.sin(heading) * SPACING * i;
        const bz = z - Math.cos(heading) * SPACING * i;
        const [px, pz] = swimmable(world, bx, bz) ? [bx, bz] : [x, z];
        return makeDuck(firstId + ducks.length + i, variant, px, pz, heading);
      });
      for (const duck of pack) duck.pack = pack;
      ducks.push(...pack);
    }
  }
  return ducks;
}

// Moves a duck by (dx, dz), axis by axis so it slides along the bank;
// returns how far it went.
function swim(duck: Wildlife, world: DuckWorld, dx: number, dz: number): number {
  const x0 = duck.x;
  const z0 = duck.z;
  if (swimmable(world, duck.x + dx, duck.z)) duck.x += dx;
  if (swimmable(world, duck.x, duck.z + dz)) duck.z += dz;
  const moved = Math.hypot(duck.x - x0, duck.z - z0);
  if (moved > 1e-6) duck.heading = Math.atan2(duck.x - x0, duck.z - z0);
  return moved;
}

// Heads toward (tx, tz) at up to `speed`; returns how far it went.
function swimToward(duck: Wildlife, world: DuckWorld, tx: number, tz: number, speed: number, dt: number): number {
  const dx = tx - duck.x;
  const dz = tz - duck.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return 0;
  const step = Math.min(speed * dt, d);
  return swim(duck, world, (dx / d) * step, (dz / d) * step);
}

// Somewhere out on the water, away from the hero: straight away if there's
// water there, else turning a little either way, else closer.
function fleeTarget(duck: Wildlife, world: DuckWorld, hero: { x: number; z: number }): { x: number; z: number } | null {
  const away = Math.atan2(duck.x - hero.x, duck.z - hero.z);
  for (const distance of [FLEE_DISTANCE, FLEE_DISTANCE * 0.6, FLEE_DISTANCE * 0.35]) {
    for (const turn of [0, 0.5, -0.5, 1, -1, 1.5, -1.5]) {
      const x = duck.x + Math.sin(away + turn) * distance;
      const z = duck.z + Math.cos(away + turn) * distance;
      if (swimmable(world, x, z)) return { x, z };
    }
  }
  return null;
}

// A roll from where a duck is now, so choices vary as it moves but repeat exactly.
const rollAt = (duck: Wildlife, salt: number) => hashUnit(Math.round(duck.x * 100), Math.round(duck.z * 100), salt + duck.id);

// One frame for a pack: fleeing or calm, the leader's wandering and resting,
// the others keeping their places in line, and everyone's dabbling.
export function stepDuckPack(pack: Wildlife[], world: DuckWorld, hero: { x: number; z: number }, dt: number): void {
  const leader = pack[0];
  const near = Math.min(...pack.map((d) => Math.hypot(d.x - hero.x, d.z - hero.z)));
  if (!leader.fleeing && near < FLEE_RADIUS) {
    for (const duck of pack) {
      duck.fleeing = true;
      duck.dabble = null;
    }
    leader.target = null;
  } else if (leader.fleeing && near > CALM_RADIUS) {
    for (const duck of pack) duck.fleeing = false;
    leader.target = null;
    leader.restFor = 1 + rollAt(leader, 40) * 2;
  }

  for (const duck of pack) {
    if (duck.dabble === null) continue;
    duck.dabble += dt;
    if (duck.dabble >= DABBLE_TIME) duck.dabble = null;
  }

  // The leader.
  let moved = 0;
  if (leader.fleeing) {
    if (!leader.target || Math.hypot(leader.target.x - leader.x, leader.target.z - leader.z) < 0.1) leader.target = fleeTarget(leader, world, hero);
    if (leader.target) moved = swimToward(leader, world, leader.target.x, leader.target.z, FLEE_SPEED, dt);
    if (leader.target && moved === 0) leader.target = null; // cornered: look again next frame
  } else if (!leader.target) {
    leader.restFor -= dt;
    if (leader.restFor <= 0) {
      const x = leader.homeX + (rollAt(leader, 41) - 0.5) * 2 * WANDER;
      const z = leader.homeZ + (rollAt(leader, 42) - 0.5) * 2 * WANDER;
      if (swimmable(world, x, z)) leader.target = { x, z };
      else leader.restFor = 0.3; // try somewhere else shortly
    }
  } else {
    moved = swimToward(leader, world, leader.target.x, leader.target.z, PADDLE_SPEED, dt);
    if (moved === 0 || Math.hypot(leader.target.x - leader.x, leader.target.z - leader.z) < 0.05) {
      // Arrived (or the bank's in the way): rest, and maybe feed. The
      // others may feed too, each starting a moment later.
      leader.target = null;
      leader.restFor = 2 + rollAt(leader, 43) * 3;
      moved = 0; // that last step brought it to a stop
      pack.forEach((duck, i) => {
        if (rollAt(duck, 44) < 0.5) duck.dabble = i === 0 ? 0 : -rollAt(duck, 45) * 1.5;
      });
    }
  }
  leader.speed = moved / dt;

  // The others: each to its place in line behind the leader.
  const pace = (leader.fleeing ? FLEE_SPEED : PADDLE_SPEED) * FOLLOW_CATCH_UP;
  pack.forEach((duck, i) => {
    if (i === 0) return;
    const side = i % 2 === 0 ? -0.1 : 0.1;
    const sx = leader.x - Math.sin(leader.heading) * SPACING * i + Math.cos(leader.heading) * side;
    const sz = leader.z - Math.cos(leader.heading) * SPACING * i - Math.sin(leader.heading) * side;
    // Paddle once its place has drifted SLACK away, and keep going until
    // right on it, so it doesn't stop and start every frame.
    const off = Math.hypot(sx - duck.x, sz - duck.z);
    const step = off > (duck.speed > 0 ? 0.02 : SLACK) ? swimToward(duck, world, sx, sz, pace, dt) : 0;
    duck.speed = step / dt;
    // Close to its place it faces the way the leader does, rather than
    // turning to every little correction (which could point it backwards).
    if (off < SLACK * 1.5) duck.heading = leader.heading;
  });

  // Ducks on the move stop feeding (one still settling may yet start).
  for (const duck of pack) if (duck.speed > 0.05 && duck.dabble !== null && duck.dabble >= 0) duck.dabble = null;
}
