// The hero indoors: walking a room's floor among its furniture, and sitting
// down on a chair, an armchair or a bar stool, or lying down in bed (and
// getting back up).

import { HERO_RADIUS, INDOOR_SCALE } from '../constants';
import type { Hero } from '../types';
import { roomFor, type Entrance, type Room } from './interiors';
import { bumpsFurniture, distanceTo, furnish, seatOf, type Furniture, type Seat } from './furniture';

const SIT_RANGE = 0.4; // how close to a seat (or bed) the hero must stand to use it

// Where the hero is while indoors: the building's door and its room (the
// hero's x/z are then room coordinates), and the seat they're on, if any,
// with the spot they stood on before sitting down (where they get up to).
export interface Inside {
  entrance: Entrance; // the room's own (upstairs, a door of its own: upstairsOf)
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
    const seat = seatOf(piece);
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

// Upstairs in a building (the inn): a room of its own, so no one below is
// in it, nor any mugs on a bar; made once for each building, the same
// size, empty but for the stairwell where the stairs come up.
const upper = new WeakMap<Entrance, Entrance>();
export function upstairsOf(below: Entrance): Entrance {
  let floor = upper.get(below);
  if (!floor) upper.set(below, (floor = { ...below }));
  return floor;
}

const STAIRS_REACH = 0.75; // from the stairs (or stairwell), to take them

// The stairs in a room (up, or the stairwell down), if it has any.
export const stairsOf = (inside: Inside) => inside.furniture.find((f) => f.kind === 'stairs' || f.kind === 'stairwell');

// Whether the hero, standing, is by the stairs.
export function stairsInReach(inside: Inside, hero: Hero): boolean {
  const stairs = stairsOf(inside);
  return !!stairs && !inside.seated && distanceTo(stairs, hero.x, hero.z) <= STAIRS_REACH;
}

// Takes the stairs by the hero: up to the floor above (beside the top of
// the stairwell, by the wall, on its open side, toward the door), or back down (just past the
// foot of the stairs, in the room). Returns whether they did.
export function takeStairs(model: { inside: Inside | null; hero: Hero; seed: number }): boolean {
  const inside = model.inside;
  if (!inside || !stairsInReach(inside, model.hero)) return false;
  const stairs = stairsOf(inside)!;
  const foot = { x: stairs.x + stairs.w, z: stairs.z }; // the stairs climb from the room (+x) toward the wall
  const top = { x: stairs.x, z: stairs.z + 1 }; // on the open side (the rail's on the bar's side)
  if (inside.below) {
    const { room, furniture } = layoutOf(model.seed, inside.below);
    model.inside = { entrance: inside.below, room, furniture, seated: null };
    Object.assign(model.hero, { ...clearOf(furniture, room, foot), y: 0, facing: -Math.PI / 2 }); // facing the stairs
  } else {
    model.inside = { entrance: upstairsOf(inside.entrance), room: inside.room, furniture: [{ ...stairs, kind: 'stairwell' }], seated: null, below: inside.entrance };
    Object.assign(model.hero, { ...clearOf(model.inside.furniture, inside.room, top), y: 0, facing: Math.PI });
  }
  return true;
}

// The spot, or the nearest free one round it (something may stand there).
function clearOf(furniture: readonly Furniture[], room: Room, at: { x: number; z: number }): { x: number; z: number } {
  const r = HERO_RADIUS * INDOOR_SCALE;
  const around = [[0, 0], [0, 1], [1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [-1, 0]].map(([dx, dz]) => ({ x: at.x + dx, z: at.z + dz }));
  return around.find((p) => p.x >= 0 && p.z >= 0 && p.x < room.width && p.z < room.depth - 1 && !bumpsFurniture(furniture, p.x, p.z, r)) ?? at;
}
