// Crypts under the ruins: in every ruin, on open floor inside it, a stone
// stairway goes down (its own tile, and the spot before it to stand on, E to go
// down, as at any door); below, a crypt of the zone's level (how far out the
// ruin lies, as a village's: enemyLevels.ts), named for whoever was laid to
// rest there, laid out from the seed and the ruin (cryptLayout.ts, its plan;
// cryptProps.ts, what's in it). No one down there, for now.
//
// A crypt is gone into as a room is (interiors.ts): its plan's floor in room
// tiles, the stairs up at its door; only the rock between its passages and
// what stands solid in them block the way (cryptBlocks).

import { hashCell, mulberry32 } from '../../util/random';
import { spawnOf, type MapSize } from '../map/grid';
import type { Obstacles } from '../map/obstacles';
import type { Entrance, Room } from '../interiors/interiors';
import type { Ruin } from '../ruins/ruins';
import { zoneLevel } from '../enemies/enemyLevels';
import { nameAt } from '../npcs/npcs';
import { isFloor, planCrypt, type CryptPlan } from './cryptLayout';
import { furnishCrypt, type CryptProp } from './cryptProps';

const STAIR_REACH = 0.62; // from the stairs' middle to the spot before them, where the hero stands to go down

export interface Crypt {
  entrance: Entrance; // the spot before the stairs, the way down
  stairs: { x: number; z: number }; // their tile, in the world
  quarterTurns: number; // which way they open (toward the spot), for their look
  ruin: Ruin;
  level: number;
  name: string; // "the crypt of Aldric"
}

export interface CryptWorld {
  seed: number;
  size: MapSize;
  ruins: readonly Ruin[];
  isOpenTile(x: number, z: number): boolean;
}

// One crypt to every ruin that has room for its stairs (nearly all): the stairs on an open tile
// inside it, the spot before them open too, picked from the seed.
export function placeCrypts(world: CryptWorld): Crypt[] {
  const spawn = spawnOf(world.size);
  return world.ruins.flatMap((ruin) => {
    const rng = mulberry32(hashCell(ruin.x * 7 + 3, ruin.z * 11 + 5, world.seed + 977));
    const tiles: Array<[number, number]> = [];
    for (let x = ruin.x + 2; x <= ruin.x + ruin.w - 3; x++) for (let z = ruin.z + 2; z <= ruin.z + ruin.d - 3; z++) tiles.push([x, z]);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    // The stairs on bare ground (nothing of the ruin on it: not even its flagstones), the spot before them walkable.
    const bare = (x: number, z: number) => world.isOpenTile(x, z) && !ruin.pieces.some((p) => p.x === x && p.z === z);
    const walkable = (x: number, z: number) => world.isOpenTile(x, z) && !ruin.pieces.some((p) => p.x === x && p.z === z && p.kind !== 'floor');
    for (const [x, z] of tiles) {
      for (const [quarterTurns, [ox, oz]] of [[0, [0, 1]], [1, [1, 0]], [3, [-1, 0]], [2, [0, -1]]] as const) {
        if (!bare(x, z) || !walkable(x + ox, z + oz)) continue;
        const middle = { x: ruin.x + ruin.w / 2, z: ruin.z + ruin.d / 2 };
        const entrance: Entrance = { type: 'crypt', x: x + ox * STAIR_REACH, z: z + oz * STAIR_REACH, outX: ox, outZ: oz };
        return [{ entrance, stairs: { x, z }, quarterTurns, ruin, level: zoneLevel(spawn, middle), name: `the crypt of ${nameAt(x, z, world.seed)}` }];
      }
    }
    return [];
  });
}

// The stairs' tiles blocked (the hero goes down them with E, not by walking in).
export function addCryptObstacles(obstacles: Obstacles, crypts: readonly Crypt[]): void {
  for (const crypt of crypts) obstacles.addSolid(crypt.stairs.x, crypt.stairs.z);
}

// A crypt's inside: its plan and what's in it, rolled once (by its way in) and kept.
export interface CryptInside {
  crypt: Crypt;
  plan: CryptPlan;
  props: CryptProp[];
  room: Room; // as a room: its plan's bounds, the stairs up at its door
}
const crypts = new WeakMap<Entrance, Crypt>();
const insides = new WeakMap<Entrance, CryptInside>();

// Crypts known by their way in (the model's, once placed).
export const registerCrypts = (list: readonly Crypt[]) => list.forEach((c) => crypts.set(c.entrance, c));
export const cryptAt = (entrance: Entrance): Crypt | null => crypts.get(entrance) ?? null;

export function cryptInside(seed: number, entrance: Entrance): CryptInside {
  let inside = insides.get(entrance);
  if (!inside) {
    const crypt = crypts.get(entrance);
    if (!crypt) throw new Error('no crypt there');
    const plan = planCrypt(seed, crypt.ruin);
    inside = { crypt, plan, props: furnishCrypt(seed, crypt.ruin, plan), room: { width: plan.width, depth: plan.depth, door: plan.door, floor: 'flagstones', wall: 'stone' } };
    insides.set(entrance, inside);
  }
  return inside;
}

// Whether a walker of half-width r at (x, z) (room tiles) would be in the rock, or in something solid.
export function cryptBlocks(inside: CryptInside, x: number, z: number, r: number): boolean {
  for (const [cx, cz] of [[x - r, z - r], [x + r, z - r], [x - r, z + r], [x + r, z + r]]) if (!isFloor(inside.plan, Math.round(cx), Math.round(cz))) return true;
  return inside.props.some((p) => p.solid && x + r > p.x - 0.5 && x - r < p.x + p.w - 0.5 && z + r > p.z - 0.5 && z - r < p.z + p.d - 0.5);
}
