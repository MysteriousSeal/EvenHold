// The hero indoors: walking a room's floor among its furniture, and sitting
// down on a chair, an armchair or a bar stool, or lying down in bed (and
// getting back up).

import { goesUnder } from '../dungeons/dungeonTypes';
import { dungeonRoom } from '../dungeons/dungeons';
import { HERO_RADIUS, INDOOR_SCALE } from '../constants';
import type { Hero } from '../types';
import { ENTER_RANGE, roomFor, type Entrance, type Room } from './interiors';
import { SIT_RANGE, bumpsFurniture, distanceTo, seatOf, type Furniture, type Seat } from './furniture';
import { furnish } from './furnish';
import { Nearby } from '../../util/nearby';


// Where the hero is while indoors: the building's door and its room (the
// hero's x/z are then room coordinates), and the seat they're on, if any,
// with the spot they stood on before sitting down (where they get up to).
export interface Inside {
  entrance: Entrance; // the room's own (upstairs, a door of its own: upstairs.ts)
  room: Room;
  furniture: Furniture[];
  seated: Seated;
  below?: Entrance; // upstairs: the building it's the upper floor of
  walls?: (x: number, z: number, r: number) => boolean; // what else blocks, past the room's bounds and furniture (a crypt's rock and tombs)
  exitAt?: () => { x: number; z: number } | null; // a way out besides its door, where to stand for it (a crypt's, at its far end: crypts/cryptProps.ts: exitDoor), if open
}

// Where the hero's sitting (or lying), and the spot they sat down from; null standing.
export type Seated = { seat: Seat; from: { x: number; z: number } } | null;

// A building's room and its furniture, rolled once and shared by everyone
// in it (the hero and villagers alike, so a seat taken is the same seat).
const layouts = new WeakMap<Entrance, { room: Room; furniture: Furniture[] }>();
export function layoutOf(seed: number, entrance: Entrance): { room: Room; furniture: Furniture[] } {
  let layout = layouts.get(entrance);
  if (!layout) {
    if (goesUnder(entrance)) layout = { room: dungeonRoom(seed, entrance), furniture: [] }; // (a dungeon's: its tombs, its rocks, its own: crypts/)
    else {
      const room = roomFor(seed, entrance);
      layout = { room, furniture: furnish(seed, entrance, room) };
    }
    layouts.set(entrance, layout);
  }
  return layout;
}

// Walks the hero `dist` along (dirX, dirZ) on the room's floor, walled in,
// the doorway too (they leave with E at the door, not by walking into it),
// and not into anyone `bumps` says is in the way.
export function walkInside(
  inside: Inside,
  hero: Hero,
  dirX: number,
  dirZ: number,
  dist: number,
  bumps: (x: number, z: number, r: number) => boolean = () => false,
): void {
  const { room, furniture } = inside;
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-9 || !(dist > 0)) return; // (no way to go, or nowhere: never a step of 0 / 0, which would lose them)
  const r = HERO_RADIUS * INDOOR_SCALE; // drawn bigger indoors, so bigger to bump into things too
  hero.facing = Math.atan2(dirX, dirZ);
  // Axis by axis, so the hero slides along furniture instead of sticking to it.
  const nx = Math.min(room.width - 0.5 - r, Math.max(-0.5 + r, hero.x + (dirX / len) * dist));
  const blocked = (x: number, z: number) => bumpsFurniture(furniture, x, z, r) || bumps(x, z, r) || !!inside.walls?.(x, z, r);
  if (!blocked(nx, hero.z)) hero.x = nx;
  const nz = hero.z + (dirZ / len) * dist;
  const clampedZ = Math.min(room.depth - 0.5 - r, Math.max(-0.5 + r, nz));
  if (!blocked(hero.x, clampedZ)) hero.z = clampedZ;
}

// The nearest seat the hero could sit on from where they stand (one no one
// else is on), or null.
export function seatInReach(inside: Inside, hero: Hero, taken: (piece: Furniture) => boolean = () => false): Seat | null {
  if (inside.seated) return null;
  let best: Seat | null = null;
  let bestDistance = SIT_RANGE;
  for (const piece of inside.furniture) {
    const seat = seatOf(piece, hero); // (a double bed: the side they're by)
    if (!seat || taken(piece)) continue;
    const d = distanceTo(piece, hero.x, hero.z);
    if (d <= bestDistance) {
      best = seat;
      bestDistance = d;
    }
  }
  return best;
}

// Sits the hero down on `seat`, facing the way it faces (or lays them in
// bed); `at` keeps where (a room, or outdoors on a bench).
export function sitDown(at: { seated: Seated }, hero: Hero, seat: Seat): void {
  at.seated = { seat, from: { x: hero.x, z: hero.z } };
  hero.x = seat.x;
  hero.z = seat.z;
  hero.y = seat.y;
  hero.facing = seat.facing;
}

// Gets the hero up, back onto the spot they sat down from, on the floor
// (or the ground, outdoors: `y`).
export function standUp(at: { seated: Seated }, hero: Hero, y = 0): void {
  if (!at.seated) return;
  hero.x = at.seated.from.x;
  hero.z = at.seated.from.z;
  hero.y = y;
  at.seated = null;
}

// The door the hero can use right now: outdoors, the nearest one whose spot
// they stand on; indoors, the room's own door when they're by it (none upstairs).
// Whether arms are put away here: in an inn (downstairs or up), weapons sheathed and no blows struck.
export const armsSheathed = (inside: Pick<Inside, 'entrance'> | null): boolean => inside?.entrance.type === 'inn';

const EXIT_REACH = 0.8; // tiles from a way out's spot (exitAt) it's in reach

// Whether the hero's at a room's other way out (a crypt's, at its far end), open.
export function atWayOut(inside: Pick<Inside, 'exitAt'>, hero: { x: number; z: number }): boolean {
  const exit = inside.exitAt?.();
  return !!exit && Math.hypot(hero.x - exit.x, hero.z - exit.z) < EXIT_REACH;
}

export function doorInReach(inside: Inside | null, entrances: readonly Entrance[], hero: Hero): Entrance | null {
  if (inside) {
    if (atWayOut(inside, hero)) return inside.entrance; // (a crypt's way out, at the far end, once its lord's slain)
    const wide = goesUnder(inside.entrance) ? 1 : 0; // (a dungeon's way up two tiles wide: door and door + 1)
    const x = hero.x - inside.room.door;
    return !inside.below && x > -0.6 && x < 0.6 + wide && hero.z > inside.room.depth - 1.4 ? inside.entrance : null;
  }
  const near = entrancesAround(entrances, hero).filter((e) => reachOf(e, hero) <= ENTER_RANGE);
  return near.reduce<Entrance | null>((best, e) => (!best || reachOf(e, hero) <= reachOf(best, hero) ? e : best), null);
}

// The entrances round the hero, kept to hand (the full map has ten thousand doors: each measured to, each frame, for
// its prompt, cost half a millisecond a time).
const around = new WeakMap<readonly Entrance[], Nearby<Entrance>>();
function entrancesAround(entrances: readonly Entrance[], hero: Hero): readonly Entrance[] {
  let near = around.get(entrances);
  if (!near) around.set(entrances, (near = new Nearby(entrances, (e) => e, ENTER_RANGE + 2)));
  return near.near(hero);
}

// How far the hero is from a door's spot: a crypt's way down, from the nearest point along its front
// (two tiles wide: before either of them, the way down in reach).
function reachOf(e: Entrance, hero: Hero): number {
  const [dx, dz] = [hero.x - e.x, hero.z - e.z];
  if (!goesUnder(e)) return Math.hypot(dx, dz);
  const [ax, az] = [Math.abs(e.outZ), Math.abs(e.outX)]; // across the way down
  const along = Math.max(-0.6, Math.min(0.6, dx * ax + dz * az));
  return Math.hypot(dx - along * ax, dz - along * az);
}
