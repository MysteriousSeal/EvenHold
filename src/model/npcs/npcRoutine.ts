// A villager's day, one step at a time (npcs.ts NpcStep). At each stop of
// the routine they get their steps: to go home or to the inn, out of where
// they are, to its door, in, and settling down there a while; to the
// square, out and to two spots on it in turn, pausing at each (the
// second, sometimes, a free seat on one of its benches); to a
// farmer's field, out and to a few spots in it, working each a while. Settling
// takes a free seat (a chair, an armchair, a bar stool, or at home their
// bed), else somewhere to stand.
//
// Where they go is npcPlaces.ts; how they get there, npcWalk.ts.
// Only villagers of villages near the hero act; out of the hero's sight (another room,
// or outdoors while the hero is in), they don't walk but arrive at once,
// so they cost next to nothing but keep their routine. In sight, they walk
// tile paths around what's in the way (pathfinding.ts), step round the
// hero and each other, and never stay stuck long.

import { ENEMY_ACTIVE_RADIUS } from '../constants';
import type { Village } from '../types';
import type { Inside, Seated } from '../interiors/indoors';
import type { BenchWorld } from '../worldgen/benches';
import { atBar, busyAtBar, sitAtBar } from '../inn/barPatrons';
import { FARMER_ROUTINE, ROUTINE, type Npc, type NpcStep } from './npcs';
import { staffSteps } from '../inn/innStaff';
import { between, benchSeat, doorTile, fieldSpot, heroOnPiece, patrons, roll, settle, squareSpot } from './npcPlaces';
import { easeOffHero, heroOn, place, walk } from './npcWalk';
import { smithSteps } from '../smithy/smithWork';

export interface NpcWorld extends BenchWorld {
  seed: number;
  hero: { x: number; z: number };
  inside: Inside | null; // the hero's
  outdoors: { seated: Seated }; // the hero on a bench
  isBlocked(x: number, z: number, r: number): boolean;
  isOpenTile(x: number, z: number): boolean;
  getGroundY(x: number, z: number): number;
}

const HOME_TIME: [number, number] = [30, 90]; // seconds settled at home
const INN_TIME: [number, number] = [30, 70];
const SQUARE_WAIT: [number, number] = [5, 15];
const FIELD_WORK: [number, number] = [6, 14]; // seconds at each spot in a field
const BENCH_CHANCE = 0.5; // of sitting on a bench, for the second spot on the square
const BEFORE_BENCH = 0.62; // how far in front of a bench's seat one stands to sit down
const INN_CHANCE = 0.25; // of going, when the routine comes to the inn
const INN_CAP = 4; // villagers at an inn at once, at most (its barmaids aside)


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

function act(npc: Npc, npcs: readonly Npc[], world: NpcWorld, seen: boolean, dt: number): void {
  npc.moving = false;
  if (seen && easeOffHero(npc, world, dt)) return;
  if (npc.steps.length === 0) npc.steps = npc.role === 'villager' ? plan(npc, npcs, world) : npc.role === 'smith' ? smithSteps(npc, world) : staffSteps(npc, npcs, world.seed);
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

