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
import { stepGroup } from './group';
import { stepToward } from './moving';
import type { DuckVariant, Wildlife } from './animal';

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

// Toward (tx, tz) at up to `speed`, afloat; returns how far it went.
const go = (duck: Wildlife, world: DuckWorld, tx: number, tz: number, speed: number, dt: number) => stepToward(duck, (x, z) => swimmable(world, x, z), tx, tz, speed, dt);

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

// One frame for a pack (group.ts): the others in line behind the leader.
export function stepDuckPack(pack: Wildlife[], world: DuckWorld, hero: { x: number; z: number }, dt: number): void {
  stepGroup(pack, {
    fits: (x, z) => swimmable(world, x, z),
    go: (duck, tx, tz, speed, t) => go(duck, world, tx, tz, speed, t),
    place: (_duck, i, leader) => {
      const side = i % 2 === 0 ? -0.1 : 0.1;
      return {
        x: leader.x - Math.sin(leader.heading) * SPACING * i + Math.cos(leader.heading) * side,
        z: leader.z - Math.cos(leader.heading) * SPACING * i - Math.sin(leader.heading) * side,
      };
    },
    walk: PADDLE_SPEED,
    flee: FLEE_SPEED,
    catchUp: FOLLOW_CATCH_UP,
    slack: SLACK,
    settle: 0.02,
    wander: WANDER,
    fleeRadius: FLEE_RADIUS,
    calmRadius: CALM_RADIUS,
    fleeDistance: FLEE_DISTANCE,
    fleeNear: 0.1,
    rest: [2, 3],
    feedTime: DABBLE_TIME,
    feedChance: 0.5,
    feedLag: 1.5,
    salt: 40,
    faceLeader: true,
  }, hero, dt);
}
