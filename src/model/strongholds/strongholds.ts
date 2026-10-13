// Bandit strongholds: old forts gone to outlaws, far rarer than their camps
// or the caves: one to every stretch of STRONGHOLD_REGION tiles a side that
// has the ground for it, out in the wilds (clear of villages, ruins, camps,
// caves and the start): a gatehouse, FOOTING tiles a side, on open level
// ground, its gate in its face, the ground before it open and level with it
// (and open country beyond: never a pocket shut in by water or fences):
// the way in (E to go in, as at any door). Within, a stronghold of the zone's
// level (enemyLevels.ts), named (strongholdNames.ts), laid out from the seed
// and where its gate stands (strongholdLayout.ts, its plan; strongholdProps.ts,
// what's in it); its bandits, its four wings' bosses and its king
// (strongholdFoes.ts). The gatehouse is stone: its tiles blocked.
//
// Placed last of all a region's (world/liveWorld.ts), on ground nothing else
// stands on, so a world is as it ever was but for them.

import { hashCell, mulberry32 } from '../../util/random';
import { FACINGS, cellKey, inArea, spawnOf, wholeMap, type Area, type MapSize } from '../map/grid';
import type { Obstacles } from '../map/obstacles';
import type { Entrance, Room } from '../interiors/interiors';
import { isFloor } from '../dungeons/floorPlan';
import type { Village } from '../types';
import type { Ruin } from '../ruins/ruins';
import type { Camp } from '../camps/camps';
import type { Cave } from '../caves/caves';
import type { Tiles } from '../map/tiles';
import { zoneLevel } from '../enemies/enemyLevels';
import { VILLAGE_OUTER_RADIUS } from '../constants';
import { planStronghold, type StrongholdPlan } from './strongholdLayout';
import { furnishStronghold, strongholdExit, type StrongholdProp } from './strongholdProps';
import { strongholdName } from './strongholdNames';

export const STRONGHOLD_REGION = 1024; // tiles a side of the stretch that may have one (a cave's: half that; a camp's, far less)
const FOOTING = 3; // tiles a side of the gatehouse (its face the gate's row)
const CLEAR_OF_VILLAGES = 16; // tiles past a village's edge
const CLEAR_OF = 12; // tiles from a ruin's or a camp's middle, or a cave's mouth
const CLEAR_OF_SPAWN = 30;
const TRIES = 4000; // spots looked at in a stretch
const COUNTRY = 600; // open tiles that must be walked to from before its gate (open country: not a pocket shut in by water, fences or rock)
const GATE_REACH = 0.62; // from the gate's middle to the spot before it, where the hero stands to go in

export interface Stronghold {
  entrance: Entrance; // the spot before the gate, the way in
  gate: { x: number; z: number }; // its tile, in the world
  footing: Array<{ x: number; z: number }>; // the gatehouse's tiles, the gate's row first (blocked)
  quarterTurns: number; // which way it opens (toward the spot before it), for its look
  level: number;
  name: string; // "the Gallows Hold" (strongholdNames.ts)
}

export interface StrongholdWorld {
  seed: number;
  size: MapSize;
  tiles: Tiles;
  villages: readonly Village[];
  ruins: readonly Ruin[];
  camps: readonly Camp[];
  caves: readonly Cave[];
  isOpenTile(x: number, z: number): boolean;
  stoodOn?(x: number, z: number): boolean; // whether someone's standing on a tile (a foe, an animal: not to be built over)
}

// One stronghold to a stretch with the ground for it: a gate on open, level, natural ground, the gatehouse's tiles
// behind it never lower, the ground before it open, from the seed (looked for at random, the first found).
// (`area`: the part of the map to place them on: its stretches, those starting in it; else the whole map.)
export function placeStrongholds(world: StrongholdWorld, area: Area = wholeMap(world.size)): Stronghold[] {
  const { size } = world;
  const spawn = spawnOf(size);
  const strongholds: Stronghold[] = [];
  const regionsX = Math.max(1, Math.round(size.width / STRONGHOLD_REGION));
  const regionsZ = Math.max(1, Math.round(size.depth / STRONGHOLD_REGION));
  const inMap = (x: number, z: number) => x >= 1 && z >= 1 && x < size.width - 1 && z < size.depth - 1 && inArea(area, x, z); // (all of it on its area: nothing of it on a region not made)
  const wild = (x: number, z: number) =>
    Math.hypot(x - spawn.x, z - spawn.z) > CLEAR_OF_SPAWN &&
    world.villages.every((v) => Math.hypot(x - v.x, z - v.z) > VILLAGE_OUTER_RADIUS + CLEAR_OF_VILLAGES) &&
    world.ruins.every((r) => Math.hypot(x - (r.x + r.w / 2), z - (r.z + r.d / 2)) > CLEAR_OF) &&
    world.camps.every((c) => Math.hypot(x - c.x, z - c.z) > CLEAR_OF) &&
    world.caves.every((c) => Math.hypot(x - c.mouth.x, z - c.mouth.z) > CLEAR_OF);
  for (let rx = 0; rx < regionsX; rx++) {
    for (let rz = 0; rz < regionsZ; rz++) {
      const rng = mulberry32(hashCell(rx * 17 + 3, rz * 19 + 13, world.seed + 5209));
      const [x0, z0] = [Math.floor((rx * size.width) / regionsX), Math.floor((rz * size.depth) / regionsZ)];
      if (!inArea(area, x0, z0)) continue; // (its stretch another area's)
      const [x1, z1] = [Math.min(area.x1, x0 + Math.floor(size.width / regionsX)), Math.min(area.z1, z0 + Math.floor(size.depth / regionsZ))]; // (what of it is on this area)
      for (let t = 0; t < TRIES; t++) {
        const [x, z] = [x0 + Math.floor(rng() * (x1 - x0)), z0 + Math.floor(rng() * (z1 - z0))];
        const stronghold = gateAt(world, x, z, Math.floor(rng() * 4), inMap, wild);
        if (stronghold) {
          strongholds.push({ ...stronghold, level: zoneLevel(spawn, stronghold.gate), name: strongholdName({ x, z }, world.seed) });
          break;
        }
      }
    }
  }
  return strongholds;
}

// A gate at (x, z), opening toward FACINGS[from], or round to the first way that will do; else null.
function gateAt(world: StrongholdWorld, x: number, z: number, from: number, inMap: (x: number, z: number) => boolean, wild: (x: number, z: number) => boolean): Omit<Stronghold, 'level' | 'name'> | null {
  if (!inMap(x, z) || !wild(x, z)) return null;
  const h = (t: { x: number; z: number }) => world.tiles.height(t.x, t.z);
  const open = (t: { x: number; z: number }) => world.isOpenTile(t.x, t.z) && world.tiles.surface(t.x, t.z) === 'natural';
  for (let k = 0; k < 4; k++) {
    const quarterTurns = (from + k) % 4;
    const [ox, oz] = FACINGS[quarterTurns]; // the way out, toward the spot before it
    const [sx, sz] = [Math.abs(oz), Math.abs(ox)]; // across it
    const row = [{ x, z }, { x: x + sx, z: z + sz }, { x: x - sx, z: z - sz }]; // the gate's, across the way in
    const footing = Array.from({ length: FOOTING }, (_, back) => row.map((t) => ({ x: t.x - ox * back, z: t.z - oz * back }))).flat(); // its row, then back from it
    const front = row.map((t) => ({ x: t.x + ox, z: t.z + oz }));
    if (![...footing, ...front].every((t) => inMap(t.x, t.z))) continue;
    const level = h({ x, z });
    // The gate's row and the ground before it: open, natural, level; the rest of the gatehouse's open, never lower; no one stood where it's built.
    if (![...row, ...front].every((t) => open(t) && h(t) === level)) continue;
    if (!footing.every((t) => open(t) && h(t) >= level && !world.stoodOn?.(t.x, t.z))) continue;
    if (!inOpenCountry(world, { x: x + ox, z: z + oz }, new Set(footing.map((t) => cellKey(t.x, t.z))), inMap)) continue;
    const spot = { x: x + ox * (0.5 + GATE_REACH), z: z + oz * (0.5 + GATE_REACH) };
    return { entrance: { type: 'stronghold', x: spot.x, z: spot.z, outX: ox, outZ: oz }, gate: { x, z }, footing, quarterTurns };
  }
  return null;
}

// Whether COUNTRY open tiles can be walked to from `from` (round the gatehouse to be: `built`), step by step: the
// ground before a gate is open country, never a pocket no one could come to.
function inOpenCountry(world: StrongholdWorld, from: { x: number; z: number }, built: ReadonlySet<string>, inMap: (x: number, z: number) => boolean): boolean {
  const seen = new Set<string>([cellKey(from.x, from.z)]);
  const todo = [from];
  while (todo.length > 0 && seen.size < COUNTRY) {
    const at = todo.pop()!;
    for (const [dx, dz] of FACINGS) {
      const [x, z] = [at.x + dx, at.z + dz];
      const key = cellKey(x, z);
      if (seen.has(key) || built.has(key) || !inMap(x, z) || !world.isOpenTile(x, z)) continue;
      seen.add(key);
      todo.push({ x, z });
    }
  }
  return seen.size >= COUNTRY;
}

// The gatehouse's tiles blocked (the hero goes in with E, not by walking in).
export function addStrongholdObstacles(obstacles: Obstacles, strongholds: readonly Stronghold[]): void {
  for (const stronghold of strongholds) for (const t of stronghold.footing) obstacles.addSolid(t.x, t.z);
}

// A stronghold's key, for its record of the slain (the save's): its gate's tile (marked a stronghold's, apart from the crypts' and the caves').
export const strongholdKey = (stronghold: { gate: { x: number; z: number } }): string => `stronghold:${stronghold.gate.x},${stronghold.gate.z}`;

const strongholds = new WeakMap<Entrance, Stronghold>();
// Strongholds known by their way in (the model's, once placed).
export const registerStrongholds = (list: readonly Stronghold[]) => list.forEach((s) => strongholds.set(s.entrance, s));
export const strongholdAt = (entrance: Entrance): Stronghold | null => strongholds.get(entrance) ?? null;

// A stronghold's inside: its plan and what's in it, laid out once (by its way in) and kept; as a room, the way up at its door.
export interface StrongholdInside {
  stronghold: Stronghold;
  plan: StrongholdPlan;
  props: StrongholdProp[];
  room: Room;
  exit: ReturnType<typeof strongholdExit>; // the postern in the great hall's far wall (its way out, once the king's slain)
  gateKeys: ReadonlySet<string>; // the great hall's gate's tiles (plan.gate), as "x,z"
  shut: boolean; // whether that gate's shut now (its run's to say: strongholdFoes.ts)
}
const insides = new WeakMap<Entrance, StrongholdInside>();

export function strongholdInside(seed: number, entrance: Entrance): StrongholdInside {
  let inside = insides.get(entrance);
  if (!inside) {
    const stronghold = strongholds.get(entrance);
    if (!stronghold) throw new Error('no stronghold there');
    const plan = planStronghold(seed, stronghold.gate);
    inside = { stronghold, plan, props: furnishStronghold(seed, stronghold.gate, plan), room: { width: plan.width, depth: plan.depth, door: plan.door, floor: 'flagstones', wall: 'stone' }, exit: strongholdExit(plan), gateKeys: new Set(plan.gate.map((t) => cellKey(t.x, t.z))), shut: true };
    insides.set(entrance, inside);
  }
  return inside;
}

// Whether a walker of half-width r at (x, z) (room tiles) would be in the rock, in something solid, or (while it's
// shut) in the great hall's gate.
export function strongholdBlocks(inside: StrongholdInside, x: number, z: number, r: number): boolean {
  for (const [cx, cz] of [[x - r, z - r], [x + r, z + r], [x - r, z + r], [x + r, z - r]]) {
    const [tx, tz] = [Math.round(cx), Math.round(cz)];
    if (!isFloor(inside.plan, tx, tz) || (inside.shut && inside.gateKeys.has(cellKey(tx, tz)))) return true;
  }
  return inside.props.some((p) => p.solid && x + r > p.x - 0.5 && x - r < p.x + p.w - 0.5 && z + r > p.z - 0.5 && z - r < p.z + p.d - 0.5);
}
