// Crypts under the ruins: in every ruin, on open floor inside it, a stone
// stairway goes down into a little stone tomb (the stairs two tiles side by side, the tomb two behind
// them; the spot before them to stand on, E to go down, as at any door); below, a crypt of the zone's level (how far out the
// ruin lies, as a village's: enemyLevels.ts), named (cryptNames.ts), laid out from the seed and the ruin (cryptLayout.ts, its plan;
// cryptProps.ts, what's in it); its guards, the dead at their posts (cryptFoes.ts).
//
// A crypt is gone into as a room is (interiors.ts): its plan's floor in room
// tiles, the stairs up at its door; only the rock between its passages and
// what stands solid in them block the way (cryptBlocks).

import { hashCell, mulberry32 } from '../../util/random';
import { FACINGS, spawnOf, type MapSize } from '../map/grid';
import type { Obstacles } from '../map/obstacles';
import type { Entrance, Room } from '../interiors/interiors';
import type { Ruin, RuinPiece } from '../ruins/ruins';
import { zoneLevel } from '../enemies/enemyLevels';
import { cryptName } from './cryptNames';
import { isFloor, planCrypt, type CryptPlan } from './cryptLayout';
import { furnishCrypt, type CryptProp } from './cryptProps';

const CLEARED: ReadonlySet<RuinPiece['kind']> = new Set(['floor', 'rubble', 'column', 'columnBroken', 'columnFallen']); // what a tomb may stand in place of
const STAIR_REACH = 0.62; // from the stairs' middle to the spot before them, where the hero stands to go down

export interface Crypt {
  entrance: Entrance; // the spot before the stairs, the way down
  stairs: { x: number; z: number }; // their first tile, in the world
  steps: Array<{ x: number; z: number }>; // the stairs' two tiles, side by side (across the way down)
  tiles: Array<{ x: number; z: number }>; // all it stands on: the stairs, and the tomb's two behind them
  middle: { x: number; z: number }; // amid the four, where it's drawn
  quarterTurns: number; // which way they open (toward the spot), for their look
  ruin: Ruin;
  level: number;
  name: string; // "the tomb of Lady Morwen" (cryptNames.ts)
}

export interface CryptWorld {
  seed: number;
  size: MapSize;
  ruins: readonly Ruin[];
  heightMap: readonly (readonly number[])[];
  isOpenTile(x: number, z: number): boolean;
}

// One crypt to every ruin that has room for it (nearly all): the stairs on two open tiles side by side inside
// it, the tomb on the two behind them, all four level; the ground before the stairs open too, from the seed.
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
    // On bare ground if there's room (nothing of the ruin there); else on its flagstones and what's lying
    // about (rubble, columns down or broken), cleared away; the ground before the stairs walkable.
    const piece = (x: number, z: number) => ruin.pieces.find((p) => p.x === x && p.z === z);
    const walkable = (x: number, z: number) => world.isOpenTile(x, z) && (piece(x, z)?.kind ?? 'floor') === 'floor';
    for (const paved of [false, true]) {
      const free = (x: number, z: number) => {
        const kind = piece(x, z)?.kind;
        if (!kind) return world.isOpenTile(x, z);
        return paved && (kind === 'floor' ? world.isOpenTile(x, z) : CLEARED.has(kind));
      };
      for (const [x, z] of tiles) {
        for (const quarterTurns of [0, 1, 3, 2]) {
          const [ox, oz] = FACINGS[quarterTurns];
          const [sx, sz] = [Math.abs(oz), Math.abs(ox)]; // the second tile, beside the first across the way down
          const [x2, z2] = [x + sx, z + sz];
          const steps = [{ x, z }, { x: x2, z: z2 }];
          const all = [...steps, ...steps.map((t) => ({ x: t.x - ox, z: t.z - oz }))]; // (the tomb, behind)
          if (all.some((t) => t.x < ruin.x + 2 || t.z < ruin.z + 2 || t.x > ruin.x + ruin.w - 3 || t.z > ruin.z + ruin.d - 3)) continue;
          if (!all.every((t) => free(t.x, t.z)) || !steps.every((t) => walkable(t.x + ox, t.z + oz))) continue;
          if (all.some((t) => world.heightMap[t.x][t.z] !== world.heightMap[x][z])) continue;
          ruin.pieces = ruin.pieces.filter((p) => !all.some((t) => t.x === p.x && t.z === p.z)); // (nothing of the ruin under it)
          const front = { x: x + sx / 2, z: z + sz / 2 };
          const entrance: Entrance = { type: 'crypt', x: front.x + ox * STAIR_REACH, z: front.z + oz * STAIR_REACH, outX: ox, outZ: oz };
          const level = zoneLevel(spawn, { x: ruin.x + ruin.w / 2, z: ruin.z + ruin.d / 2 });
          const middle = { x: front.x - ox / 2, z: front.z - oz / 2 };
          return [{ entrance, stairs: { x, z }, steps, tiles: all, middle, quarterTurns, ruin, level, name: cryptName(x, z, world.seed) }];
        }
      }
    }
    return [];
  });
}

// The stairs' tiles blocked (the hero goes down them with E, not by walking in).
export function addCryptObstacles(obstacles: Obstacles, crypts: readonly Crypt[]): void {
  for (const crypt of crypts) for (const t of crypt.tiles) obstacles.addSolid(t.x, t.z);
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
