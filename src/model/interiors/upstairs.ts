// Upstairs (the inn's): the stairs up to it and the stairwell back down,
// taken with E; its floor, a hallway along the left and back walls (the
// stairwell in it, lanterns along it) walled off from the rooms off it.

import { HERO_RADIUS, INDOOR_SCALE } from '../constants';
import type { Hero } from '../types';
import type { Entrance, Room } from './interiors';
import { bumpsFurniture, clothFor, distanceTo, type Furniture } from './furniture';
import { layoutOf, type Inside } from './indoors';

// Upstairs in a building (the inn): a room of its own, so no one below is
// in it, nor any mugs on a bar; made once for each building, the same size.
const upper = new WeakMap<Entrance, Entrance>();
function upstairsOf(below: Entrance): Entrance {
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

// The floor above's furniture: the stairwell where the stairs come up, and
// a lantern every other tile along the left wall, out from it both ways
// (none over it), and along the back wall.
function upstairsFurniture(stairs: Furniture, room: Room): Furniture[] {
  const lantern = (wall: 'left' | 'back', x: number, z: number): Furniture => ({ kind: 'wallLantern', x, z, w: 1, d: 1, wall, solid: false });
  const lanterns: Furniture[] = [];
  for (let z = stairs.z - 1; z >= 0; z -= 2) lanterns.push(lantern('left', 0, z));
  for (let z = stairs.z + stairs.d; z < room.depth; z += 2) lanterns.push(lantern('left', 0, z));
  for (let x = 1; x < room.width; x += 2) lanterns.push(lantern('back', x, 0));
  return [{ ...stairs, kind: 'stairwell' }, ...lanterns, ...hallway(room, stairs)];
}

// The floor above `below` (its room, with `stairs` up to it), as the hero's
// there, its doors as they were left.
export function upstairsInside(below: Entrance, room: Room, stairs: Furniture, seed: number): Inside {
  const furniture = upstairsFurniture(stairs, room);
  for (const f of furniture) if (f.kind === 'roomBed' || f.kind === 'doubleBed') f.cloth = clothFor(seed, below, f.x, f.z, 1); // each its own blanket
  const open = opened.get(below);
  for (const f of furniture) if (f.kind === 'hallDoor' && open?.has(doorKey(f))) f.open = true;
  return { entrance: upstairsOf(below), room, furniture, seated: null, below };
}

// The doors upstairs left open, by building (its door below), each by where it stands; kept in the save.
const opened = new WeakMap<Entrance, Set<string>>();
const doorKey = (f: Furniture) => `${f.x},${f.z}`;
export const openDoorsAt = (building: Entrance): string[] => [...(opened.get(building) ?? [])];
export const setOpenDoors = (building: Entrance, keys: readonly string[]) => void opened.set(building, new Set(keys));

const DOOR_REACH = 0.6; // from a door's middle, to open or close it (from either side)

// Where a door's middle is: halfway along it, in its wall.
const doorway = (f: Furniture) => (f.wall === 'left' ? { x: f.x - 0.4, z: f.z - 0.5 + f.d / 2 } : { x: f.x - 0.5 + f.w / 2, z: f.z - 0.4 });

// The door the hero, standing, is at (upstairs), if any: the nearest.
export function doorAt(inside: Inside, hero: Hero): Furniture | null {
  if (inside.seated) return null;
  let best: Furniture | null = null;
  let near = DOOR_REACH;
  for (const f of inside.furniture) {
    if (f.kind !== 'hallDoor') continue;
    const p = doorway(f);
    const d = Math.hypot(p.x - hero.x, p.z - hero.z);
    if (d <= near) [best, near] = [f, d];
  }
  return best;
}

// Opens the door by the hero, or closes it (not on them, stood in its
// doorway); returns whether there was one.
export function useHallDoor(model: { inside: Inside | null; hero: Hero }): boolean {
  const inside = model.inside;
  const door = inside?.below ? doorAt(inside, model.hero) : null;
  if (!inside?.below || !door) return false;
  if (door.open && bumpsFurniture([{ ...door, open: false }], model.hero.x, model.hero.z, HERO_RADIUS * INDOOR_SCALE)) return true; // in its way
  door.open = !door.open;
  const open = opened.get(inside.below) ?? new Set<string>();
  opened.set(inside.below, open);
  if (door.open) open.add(doorKey(door));
  else open.delete(doorKey(door));
  return true;
}

const HALL = 2; // the hallway's width, in tiles
const DOOR_EVERY = 3; // a room's door along it, every so many tiles

// Upstairs, a hallway along the left and back walls (the stairwell in it),
// walled off from the rooms beyond by a low wall: a row of rooms along the
// back, a door into each from the hallway, the last two made one, the
// biggest, front to back; and one long room along the front behind the
// others, through a door up the hall from the stairwell; a bed in each.
function hallway(room: Room, stairs: Furniture): Furniture[] {
  const piece = (wall: 'left' | 'back', x: number, z: number, door: boolean): Furniture => ({ kind: door ? 'hallDoor' : 'hallWall', x, z, w: 1, d: 1, wall, solid: true });
  const walls: Furniture[] = [];
  const mid = HALL + Math.floor((room.depth - HALL) / 2); // halfway to the front
  // The front room's door, up the hall from the stairwell: across the joint of
  // the two tiles before it, out of the stairs' reach, clear of the cross wall.
  const door = Math.max(mid, stairs.z - 2);
  for (let z = HALL; z < room.depth; z++) if (z !== door && z !== door + 1) walls.push(piece('left', HALL, z, false));
  walls.push({ ...piece('left', HALL, door, true), d: 2 });
  for (let x = HALL; x < room.width; x++) walls.push(piece('back', x, HALL, (x - HALL) % DOOR_EVERY === 1));
  // Between the back rooms, halfway from door to door, the same low wall; the
  // last two rooms one, the biggest, front to back (its wall on to the front,
  // the long front room stopping short of it).
  const dividers: number[] = [];
  for (let x = HALL + DOOR_EVERY; x < room.width; x += DOOR_EVERY) dividers.push(x);
  const big = dividers.length >= 2 ? dividers[dividers.length - 2] : room.width; // where the biggest room starts
  for (const x of dividers) {
    if (x > big) continue; // inside it
    for (let z = HALL; z < (x === big ? room.depth : mid); z++) walls.push(piece('left', x, z, false));
  }
  // Halfway to the front, up to the biggest room: the back rooms from the long front one.
  for (let x = HALL; x < big; x++) walls.push(piece('back', x, mid, false));
  // A bed in each room, in a corner clear of its door, its head against a
  // wall (drawn at its far end): a single along a back room's left wall, head
  // to its front; a double in the big room's front corner, head to the
  // house's front; and along the long front room's back wall, head to its end.
  const bed = (kind: 'roomBed' | 'doubleBed', wall: 'left' | 'back', x: number, z: number, w: number): Furniture => ({ kind, x, z, w, d: 2, wall, solid: true });
  // Each with a nightstand beside its head, its back to the same wall (facing away from it).
  const stand = (x: number, z: number, facing: [number, number]): Furniture => ({ kind: 'nightstand', x, z, w: 1, d: 1, wall: 'none', solid: true, facing });
  const beds: Furniture[] = [];
  if (mid - 2 >= HALL) for (const x of [HALL, ...dividers.filter((x) => x < big)]) beds.push(bed('roomBed', 'left', x, mid - 2, 1), stand(x + 1, mid - 1, [0, -1]));
  if (big + 2 < room.width) beds.push(bed('doubleBed', 'left', big, room.depth - 2, 2), stand(big + 2, room.depth - 1, [0, -1]));
  if (big - 2 > HALL && mid + 2 < room.depth) beds.push(bed('doubleBed', 'back', big - 2, mid, 2), stand(big - 1, mid + 2, [-1, 0]));
  return [...walls, ...beds];
}

// Takes the stairs by the hero: up to the floor above (beside the top of
// the stairwell, by the wall, where its railing's open: its far side), or back down (just past the
// foot of the stairs, in the room). Returns whether they did.
export function takeStairs(model: { inside: Inside | null; hero: Hero; seed: number }): boolean {
  const inside = model.inside;
  if (!inside || !stairsInReach(inside, model.hero)) return false;
  const stairs = stairsOf(inside)!;
  const foot = { x: stairs.x + stairs.w - 0.5 + HERO_RADIUS * INDOOR_SCALE + 0.05, z: stairs.z }; // right at their foot (they climb from the room, +x, toward the wall)
  const top = { x: stairs.x, z: stairs.z - 1 }; // off its top, where the railing's open (its far side)
  if (inside.below) {
    const { room, furniture } = layoutOf(model.seed, inside.below);
    model.inside = { entrance: inside.below, room, furniture, seated: null };
    Object.assign(model.hero, { ...clearOf(furniture, room, foot), y: 0, facing: Math.PI / 2 }); // stepped off them, facing away
  } else {
    model.inside = upstairsInside(inside.entrance, inside.room, stairs, model.seed);
    Object.assign(model.hero, { ...clearOf(model.inside.furniture, inside.room, top), y: 0, facing: Math.PI });
  }
  return true;
}

// The spot, or the nearest free one round it (something may stand there).
function clearOf(furniture: readonly Furniture[], room: Room, at: { x: number; z: number }): { x: number; z: number } {
  const r = HERO_RADIUS * INDOOR_SCALE;
  const around = [[0, 0], [0, 1], [1, 0], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [-1, 0]].map(([dx, dz]) => ({ x: at.x + dx, z: at.z + dz }));
  const inRoom = (p: { x: number; z: number }) => p.x >= -0.5 + r && p.z >= -0.5 + r && p.x <= room.width - 0.5 - r && p.z <= room.depth - 0.5 - r; // as far as one walks
  return around.find((p) => inRoom(p) && !bumpsFurniture(furniture, p.x, p.z, r)) ?? at;
}
