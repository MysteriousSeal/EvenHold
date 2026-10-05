// Caves in the hills: one to every stretch of CAVE_REGION tiles a side that
// has a hillside for it, out in the wilds (clear of villages, ruins, camps,
// roads, water and the start): a rocky knoll, KNOLL tiles a side, at the foot
// of a rise (the ground climbing MOUTH_RISE tiers within RISE_WITHIN tiles
// behind it: the land rolls gently, a tier at a time), its mouth in its face
// toward the low ground, the ground before it open and level with it: the way
// in (E to go down, as at any door). Below, a burrow of the zone's level
// (enemyLevels.ts), named (caveNames.ts), dug from the seed and where it
// opens (caveLayout.ts, its plan; caveProps.ts, what's in it); its beasts
// (caveFoes.ts). The knoll is rock: its tiles blocked.

import { hashCell, mulberry32 } from '../../util/random';
import { FACINGS, cellKey, inArea, spawnOf, wholeMap, type Area, type MapSize } from '../map/grid';
import type { Obstacles } from '../map/obstacles';
import type { Entrance, Room } from '../interiors/interiors';
import { isFloor } from '../dungeons/floorPlan';
import { planCave, type CavePlan } from './caveLayout';
import { caveExit, furnishCave, nestSeal, type CaveProp } from './caveProps';
import type { Village } from '../types';
import type { Ruin } from '../ruins/ruins';
import type { Camp } from '../camps/camps';
import { zoneLevel } from '../enemies/enemyLevels';
import { VILLAGE_OUTER_RADIUS } from '../constants';
import { caveName } from './caveNames';
import type { Tiles } from '../map/tiles';

export const CAVE_REGION = 512; // tiles a side of the stretch that may have one
const MOUTH_RISE = 2; // tiers the ground climbs behind the knoll, at least (a hillside, not a bump)
const RISE_WITHIN = 5; // tiles behind the mouth it does so within
const KNOLL = 3; // tiles a side of the rock the mouth's in (its face the mouth's row)
const CLEAR_OF_VILLAGES = 24; // tiles past a village's edge
const CLEAR_OF = 14; // tiles from a ruin's or a camp's middle
const CLEAR_OF_SPAWN = 40;
const TRIES = 2000; // spots looked at in a region
const MOUTH_REACH = 0.62; // from the mouth's middle to the spot before it, where the hero stands to go in

export interface Cave {
  entrance: Entrance; // the spot before the mouth, the way in
  mouth: { x: number; z: number }; // its tile, in the world
  rock: Array<{ x: number; z: number }>; // the knoll's tiles, the mouth's row first (blocked)
  quarterTurns: number; // which way it opens (toward the spot before it), for its look
  level: number;
  name: string; // "Spinner's Hollow" (caveNames.ts)
}

export interface CaveWorld {
  seed: number;
  size: MapSize;
  tiles: Tiles;
  villages: readonly Village[];
  ruins: readonly Ruin[];
  camps: readonly Camp[];
  isOpenTile(x: number, z: number): boolean;
}

// One cave to a region with a hillside: a mouth where the ground rises behind it and to either side, the ground
// before it open and level, from the seed (looked for at random, the first found).
// (`area`: the part of the map to place them on: its stretches, those starting in it; else the whole map.)
export function placeCaves(world: CaveWorld, area: Area = wholeMap(world.size)): Cave[] {
  const { size } = world;
  const h = (x: number, z: number) => world.tiles.height(x, z);
  const spawn = spawnOf(size);
  const caves: Cave[] = [];
  const regionsX = Math.max(1, Math.round(size.width / CAVE_REGION));
  const regionsZ = Math.max(1, Math.round(size.depth / CAVE_REGION));
  const inMap = (x: number, z: number) => x >= 1 && z >= 1 && x < size.width - 1 && z < size.depth - 1 && inArea(area, x, z); // (all of it on its area: nothing of it on a region not made)
  const wild = (x: number, z: number) =>
    Math.hypot(x - spawn.x, z - spawn.z) > CLEAR_OF_SPAWN &&
    world.villages.every((v) => Math.hypot(x - v.x, z - v.z) > VILLAGE_OUTER_RADIUS + CLEAR_OF_VILLAGES) &&
    world.ruins.every((r) => Math.hypot(x - (r.x + r.w / 2), z - (r.z + r.d / 2)) > CLEAR_OF) &&
    world.camps.every((c) => Math.hypot(x - c.x, z - c.z) > CLEAR_OF) &&
    caves.every((c) => Math.hypot(x - c.mouth.x, z - c.mouth.z) > CLEAR_OF);
  for (let rx = 0; rx < regionsX; rx++) {
    for (let rz = 0; rz < regionsZ; rz++) {
      const rng = mulberry32(hashCell(rx * 13 + 5, rz * 7 + 11, world.seed + 6151));
      const [x0, z0] = [Math.floor((rx * size.width) / regionsX), Math.floor((rz * size.depth) / regionsZ)];
      if (!inArea(area, x0, z0)) continue; // (its stretch another area's)
      const [w, d] = [Math.floor(size.width / regionsX), Math.floor(size.depth / regionsZ)];
      for (let t = 0; t < TRIES; t++) {
        const [x, z] = [x0 + Math.floor(rng() * w), z0 + Math.floor(rng() * d)];
        const cave = mouthAt(world, x, z, Math.floor(rng() * 4), inMap, wild, h);
        if (cave) {
          caves.push({ ...cave, level: zoneLevel(spawn, cave.mouth), name: caveName(x, z, world.seed) });
          break;
        }
      }
    }
  }
  return caves;
}

// A mouth at (x, z), opening toward FACINGS[from], or round to the first way that will do; else null.
function mouthAt(
  world: CaveWorld,
  x: number,
  z: number,
  from: number,
  inMap: (x: number, z: number) => boolean,
  wild: (x: number, z: number) => boolean,
  h: (x: number, z: number) => number,
): Omit<Cave, 'level' | 'name'> | null {
  if (!inMap(x, z) || !wild(x, z)) return null;
  for (let k = 0; k < 4; k++) {
    const quarterTurns = (from + k) % 4;
    const [ox, oz] = FACINGS[quarterTurns]; // the way out, toward the spot before it
    const [sx, sz] = [Math.abs(oz), Math.abs(ox)]; // across it
    const row = [{ x, z }, { x: x + sx, z: z + sz }, { x: x - sx, z: z - sz }]; // the mouth's, across the way in
    const rock = Array.from({ length: KNOLL }, (_, k) => row.map((t) => ({ x: t.x - ox * k, z: t.z - oz * k }))).flat(); // its row, then back into the hill
    const front = row.map((t) => ({ x: t.x + ox, z: t.z + oz }));
    const hill = { x: x - ox * RISE_WITHIN, z: z - oz * RISE_WITHIN };
    if (![...rock, ...front, hill].every((t) => inMap(t.x, t.z))) continue;
    const level = h(x, z);
    const open = (t: { x: number; z: number }) => world.isOpenTile(t.x, t.z) && world.tiles.surface(t.x, t.z) === 'natural';
    // The mouth's row and the ground before it: open, natural, level; the knoll's tiles behind open, never lower; the hill rising.
    if (![...row, ...front].every((t) => open(t) && h(t.x, t.z) === level)) continue;
    if (!rock.every((t) => open(t) && h(t.x, t.z) >= level)) continue;
    if (h(hill.x, hill.z) < level + MOUTH_RISE) continue;
    const spot = { x: x + ox * (0.5 + MOUTH_REACH), z: z + oz * (0.5 + MOUTH_REACH) };
    return { entrance: { type: 'cave', x: spot.x, z: spot.z, outX: ox, outZ: oz }, mouth: { x, z }, rock, quarterTurns };
  }
  return null;
}

// The mouth's tiles blocked (the hero goes in with E, not by walking in).
export function addCaveObstacles(obstacles: Obstacles, caves: readonly Cave[]): void {
  for (const cave of caves) for (const t of cave.rock) obstacles.addSolid(t.x, t.z);
}

// A cave's key, for its record of the slain (the save's): its mouth's tile (marked a cave's, apart from the crypts').
export const caveKey = (cave: { mouth: { x: number; z: number } }): string => `cave:${cave.mouth.x},${cave.mouth.z}`;

const caves = new WeakMap<Entrance, Cave>();
// Caves known by their way in (the model's, once placed).
export const registerCaves = (list: readonly Cave[]) => list.forEach((c) => caves.set(c.entrance, c));
export const caveAt = (entrance: Entrance): Cave | null => caves.get(entrance) ?? null;

// A cave's inside: its plan and what's in it, dug once (by its way in) and kept; as a room, the way up at its door.
export interface CaveInside {
  cave: Cave;
  plan: CavePlan;
  props: CaveProp[];
  room: Room;
  exit: ReturnType<typeof caveExit>; // the crack to the daylight in the nest's far wall (its way out, once she's slain)
  seal: Array<{ x: number; z: number }>; // the silk walling the nest off (caveProps.ts: nestSeal; none if it can't be)
  sealKeys: ReadonlySet<string>;
  sealed: boolean; // whether it's whole now (its run's to say: caveFoes.ts)
}
const insides = new WeakMap<Entrance, CaveInside>();

export function caveInside(seed: number, entrance: Entrance): CaveInside {
  let inside = insides.get(entrance);
  if (!inside) {
    const cave = caves.get(entrance);
    if (!cave) throw new Error('no cave there');
    const plan = planCave(seed, cave.mouth);
    const seal = nestSeal(plan) ?? [];
    inside = { cave, plan, props: furnishCave(seed, cave.mouth, plan), room: { width: plan.width, depth: plan.depth, door: plan.door, floor: 'earth', wall: 'rock' }, exit: caveExit(plan), seal, sealKeys: new Set(seal.map((t) => cellKey(t.x, t.z))), sealed: false };
    insides.set(entrance, inside);
  }
  return inside;
}

// Whether a walker of half-width r at (x, z) (room tiles) would be in the rock, in something solid, or (while it's
// whole) in the silk walling the nest off.
export function caveBlocks(inside: CaveInside, x: number, z: number, r: number): boolean {
  for (const [cx, cz] of [[x - r, z - r], [x + r, z + r], [x - r, z + r], [x + r, z - r]]) {
    const [tx, tz] = [Math.round(cx), Math.round(cz)];
    if (!isFloor(inside.plan, tx, tz) || (inside.sealed && inside.sealKeys.has(cellKey(tx, tz)))) return true;
  }
  return inside.props.some((p) => p.solid && Math.abs(x - p.x) < r + PROP_HALF && Math.abs(z - p.z) < r + PROP_HALF);
}
const PROP_HALF = 0.32; // a stalagmite's, an egg sac's, a crystal's: most of their tile
