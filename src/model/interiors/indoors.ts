// The hero indoors: walking a room's floor among its furniture, and sitting
// down on a chair, an armchair or a bar stool, or lying down in bed (and
// getting back up).

import { HERO_RADIUS, INDOOR_SCALE } from '../constants';
import type { Hero } from '../types';
import { ENTER_RANGE, roomFor, type Entrance, type Room } from './interiors';
import { bumpsFurniture, distanceTo, seatOf, type Furniture, type Seat } from './furniture';
import { furnish } from './furnish';

const SIT_RANGE = 0.4; // how close to a seat (or bed) the hero must stand to use it

// Where the hero is while indoors: the building's door and its room (the
// hero's x/z are then room coordinates), and the seat they're on, if any,
// with the spot they stood on before sitting down (where they get up to).
export interface Inside {
  entrance: Entrance; // the room's own (upstairs, a door of its own: upstairs.ts)
  room: Room;
  furniture: Furniture[];
  seated: Seated;
  below?: Entrance; // upstairs: the building it's the upper floor of
}

// Where the hero's sitting (or lying), and the spot they sat down from; null standing.
export type Seated = { seat: Seat; from: { x: number; z: number } } | null;

// A building's room and its furniture, rolled once and shared by everyone
// in it (the hero and villagers alike, so a seat taken is the same seat).
const layouts = new WeakMap<Entrance, { room: Room; furniture: Furniture[] }>();
export function layoutOf(seed: number, entrance: Entrance): { room: Room; furniture: Furniture[] } {
  let layout = layouts.get(entrance);
  if (!layout) {
    const room = roomFor(seed, entrance);
    layout = { room, furniture: furnish(seed, entrance, room) };
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
  const r = HERO_RADIUS * INDOOR_SCALE; // drawn bigger indoors, so bigger to bump into things too
  hero.facing = Math.atan2(dirX, dirZ);
  // Axis by axis, so the hero slides along furniture instead of sticking to it.
  const nx = Math.min(room.width - 0.5 - r, Math.max(-0.5 + r, hero.x + (dirX / len) * dist));
  if (!bumpsFurniture(furniture, nx, hero.z, r) && !bumps(nx, hero.z, r)) hero.x = nx;
  const nz = hero.z + (dirZ / len) * dist;
  const clampedZ = Math.min(room.depth - 0.5 - r, Math.max(-0.5 + r, nz));
  if (!bumpsFurniture(furniture, hero.x, clampedZ, r) && !bumps(hero.x, clampedZ, r)) hero.z = clampedZ;
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
export function doorInReach(inside: Inside | null, entrances: readonly Entrance[], hero: Hero): Entrance | null {
  if (inside) return !inside.below && Math.abs(hero.x - inside.room.door) < 0.6 && hero.z > inside.room.depth - 1.4 ? inside.entrance : null;
  const near = entrances.filter((e) => Math.hypot(e.x - hero.x, e.z - hero.z) <= ENTER_RANGE);
  return near.reduce<Entrance | null>((best, e) => (!best || Math.hypot(e.x - hero.x, e.z - hero.z) <= Math.hypot(best.x - hero.x, best.z - hero.z) ? e : best), null);
}
