// The hero indoors: walking a room's floor among its furniture, and sitting
// down on a chair, an armchair or a bar stool, or lying down in bed (and
// getting back up).

import { HERO_RADIUS, INDOOR_SCALE } from '../constants';
import type { Hero } from '../types';
import type { Entrance, Room } from './interiors';
import { bumpsFurniture, distanceTo, seatOf, type Furniture, type Seat } from './furniture';

const SIT_RANGE = 0.4; // how close to a seat (or bed) the hero must stand to use it

// Where the hero is while indoors: the building's door and its room (the
// hero's x/z are then room coordinates), and the seat they're on, if any,
// with the spot they stood on before sitting down (where they get up to).
export interface Inside {
  entrance: Entrance;
  room: Room;
  furniture: Furniture[];
  seated: { seat: Seat; from: { x: number; z: number } } | null;
}

// Walks the hero `dist` along (dirX, dirZ) on the room's floor, walled in but
// for the door; returns 'door' if they walked out through it.
export function walkInside(inside: Inside, hero: Hero, dirX: number, dirZ: number, dist: number): 'moved' | 'door' {
  const { room, furniture } = inside;
  const len = Math.hypot(dirX, dirZ);
  const r = HERO_RADIUS * INDOOR_SCALE; // drawn bigger indoors, so bigger to bump into things too
  hero.facing = Math.atan2(dirX, dirZ);
  // Axis by axis, so the hero slides along furniture instead of sticking to it.
  const nx = Math.min(room.width - 0.5 - r, Math.max(-0.5 + r, hero.x + (dirX / len) * dist));
  if (!bumpsFurniture(furniture, nx, hero.z, r)) hero.x = nx;
  const inDoorway = Math.abs(hero.x - room.door) < 0.5 - r;
  const nz = hero.z + (dirZ / len) * dist;
  if (inDoorway && nz >= room.depth - 0.5 - r) return 'door';
  const clampedZ = Math.min(room.depth - 0.5 - r, Math.max(-0.5 + r, nz));
  if (!bumpsFurniture(furniture, hero.x, clampedZ, r)) hero.z = clampedZ;
  return 'moved';
}

// The nearest seat the hero could sit on from where they stand, or null.
export function seatInReach(inside: Inside, hero: Hero): Seat | null {
  if (inside.seated) return null;
  let best: Seat | null = null;
  let bestDistance = SIT_RANGE;
  for (const piece of inside.furniture) {
    const seat = seatOf(piece);
    if (!seat) continue;
    const d = distanceTo(piece, hero.x, hero.z);
    if (d <= bestDistance) {
      best = seat;
      bestDistance = d;
    }
  }
  return best;
}

// Sits the hero down on `seat`, facing the way it faces (or lays them in bed).
export function sitDown(inside: Inside, hero: Hero, seat: Seat): void {
  inside.seated = { seat, from: { x: hero.x, z: hero.z } };
  hero.x = seat.x;
  hero.z = seat.z;
  hero.y = seat.y;
  hero.facing = seat.facing;
}

// Gets the hero up, back onto the spot they sat down from.
export function standUp(inside: Inside, hero: Hero): void {
  if (!inside.seated) return;
  hero.x = inside.seated.from.x;
  hero.z = inside.seated.from.z;
  hero.y = 0;
  inside.seated = null;
}
