// The inn's stairs and its floor above in voxels (see furnitureVoxels.ts
// for how pieces are painted; interiors/upstairs.ts for where they stand):
// the stairs up and the stairwell they come up through; the hallway's walls
// (low, or full height and plastered like the inn's own, the walls option)
// and its doors (their leaves meshed apart, to swing: roomView.ts); and the
// rooms off it: beds single and double, a wardrobe, a picture, a bathtub.

import { WOOD, WOOD_DARK, WOOD_LIGHT, EMBER, IRON, IRON_LIGHT, SOOT, COAL, BRASS, FUR_DARK, FUR_LIGHT, PARCHMENT, BRASS_DARK, WATER, MOSS, MOSS_DARK, type Box } from './furniturePalette';
import { paintBed } from './bedVoxels';
import type { Furniture } from '../../model/interiors/furniture';

export type UpstairsKind = 'stairs' | 'stairwell' | 'hallWall' | 'hallDoor' | 'roomBed' | 'doubleBed' | 'wardrobe' | 'framedPicture' | 'bathtub';

const HALL_WALL = 5; // the hallway's walls' thickness, in voxels
// A painter's frame turned end for end along its wall (u), to put a bed's head at its far end.
const headFar = (box: Box, len: number): Box => (u0, y0, v0, u1, y1, v1, color) =>
  box(len - 1 - u1, y0, v0, len - 1 - u0, y1, v1, typeof color === 'number' ? color : (u, y, v) => color(len - 1 - u, y, v));
// A painter's frame moved out past a hallway wall, to stand against it.
const offWall = (box: Box): Box => (u0, y0, v0, u1, y1, v1, color) =>
  box(u0, y0, v0 + HALL_WALL, u1, y1, v1 + HALL_WALL, typeof color === 'number' ? color : (u, y, v) => color(u, y, v - HALL_WALL));

const WALL_TOP = 34; // a full-height inner wall's top, as high as the back walls
// The room's own wall colours (roomVoxels.ts ROOM_COLORS), for the full-height walls to match the building's.
const [PLASTER, PLASTER_SHADE, TIMBER, SKIRTING] = [8, 9, 10, 13];
const dapple = (u: number, y: number) => (((Math.imul(u, 73856093) ^ Math.imul(y, 19349663)) >>> 0) % 11 === 0);

// A full-height inner wall as the inn's own walls are: a dark skirting,
// framed panels up to a lit dado rail, then dappled plaster between timber
// posts (each tile's end) under a timber beam.
function plasterWall(u: number, y: number): number {
  if (y < 3) return SKIRTING;
  if (y < 10) return u % 8 === 0 || y === 3 || y === 9 ? WOOD_DARK : WOOD; // panels, framed
  if (y < 12) return WOOD_LIGHT; // dado rail
  if (u % 25 <= 1 || y >= WALL_TOP - 2) return TIMBER; // posts, top beam
  return dapple(u, y) ? PLASTER_SHADE : PLASTER;
}

// A stretch of the hallway's wall, u0..u1 along it, five voxels thick, from
// `from` up: low (dark boards, a post at each tile's end, a lit rail on top),
// or full height (`tall`, the walls option) and like the inn's own walls.
function hallWall(box: Box, u0: number, u1: number, tall = false, from = 0): void {
  if (tall) return box(u0, from, 0, u1, WALL_TOP, 4, (u, y) => plasterWall(u, y));
  box(u0, from, 0, u1, 5, 4, (u) => (u % 25 <= 1 ? FUR_DARK : WOOD_DARK)); // boards
  box(u0, 6, 0, u1, 6, 4, WOOD_LIGHT); // the rail on top
}

// A hallway door's leaf, on its own (from its hinge side, u 0, and its foot,
// y 0): planked, iron strap hinges and a brass ring on both faces.
export const DOOR_LEAF = { width: 13, height: 27, thick: 5, hinge: 6 }; // its size in voxels; `hinge`: where it hangs in the door's tile
export function paintDoorLeaf(box: Box): void {
  const { width, height } = DOOR_LEAF;
  box(0, 0, 1, width - 1, height - 1, 3, (u) => (u % 4 === 0 ? WOOD_DARK : WOOD)); // planks
  for (const v of [0, 4]) {
    for (const y of [5, 20]) box(0, y, v, width - 3, y + 1, v, (u) => (u === 0 ? IRON_LIGHT : IRON)); // strap hinges, across the planks
    box(width - 4, 12, v, width - 3, 13, v, BRASS); // ring
  }
}

export const UPSTAIRS_PAINTERS: Record<UpstairsKind, (box: Box, len: number, dep: number, item: Furniture) => void> = {
  // Stairs up to the floor above, rising from their foot toward u = 0 (out
  // in the room, climbing to the wall), up into the ceiling: chunky steps
  // with lit nosings, the side toward the camera (+v) dark as a stringer,
  // and a handrail on posts along the far side (v = 1), stepping with them.
  stairs: (box, len, dep) => {
    const steps = Math.max(2, Math.floor(len / 6));
    const run = Math.floor(len / steps); // every tread the same length (the spare voxels to the top one, a landing)
    const rise = Math.round(30 / steps); // up to just under the back walls' top (34): into the floor above
    const v1 = dep - 2; // the steps' width, from the rail's side (v = 1)
    const RAIL = 9; // the handrail's top, over each tread (at the top, over the walls: up into the floor above)
    for (let i = 0; i < steps; i++) {
      const u1 = len - 1 - i * run;
      const u0 = i === steps - 1 ? 0 : u1 - run + 1;
      const h = (i + 1) * rise;
      box(u0, 0, 1, u1, h - 1, v1, (u, y, v) => (y === h - 1 ? (u === u1 ? WOOD_LIGHT : WOOD) : v === v1 ? WOOD_DARK : WOOD)); // a step, its nosing lit
      // The handrail follows the steps: flat over the tread, two voxels thick with a lit top, rising at the next nosing.
      box(u0, h + RAIL - 1, 1, u1, h + RAIL, 1, (_u, y) => (y === h + RAIL ? WOOD : WOOD_DARK));
      if (i < steps - 1) box(u0 - 1, h + RAIL - 1, 1, u0 - 1, h + rise + RAIL, 1, WOOD_DARK);
      if (i > 0) box(u1 - 1, h, 1, u1 - 1, h + RAIL - 2, 1, WOOD_DARK); // a baluster on each tread, against the rail's rise at its nosing (the foot's is the newel)
    }
    box(len - 2, 0, 1, len - 1, rise + RAIL + 1, 2, (_u, y) => (y === rise + RAIL + 1 ? WOOD_LIGHT : WOOD_DARK)); // the newel post at the foot, capped
  },
  // Upstairs, where the stairs come up: a shaft down through the floor
  // (the room's grid reaching under it, roomVoxels.ts DEEP), boarded, the
  // stairs going down in it, each tread a rise lower and a shade darker, its
  // nosing lit and its riser toward the camera, into the dark; a lit lip
  // along its open side, and a railing right at its far side (v = 0) and
  // across its lower end, the far side's left open by the top two treads
  // (u = 0, by the wall), to step down from.
  stairwell: (box, len, dep) => {
    const v1 = dep - 2;
    const steps = Math.max(2, Math.floor(len / 6));
    const run = Math.floor(len / steps); // the stairs' treads, below (the top one the longer)
    const rise = 4;
    const DEEP = 16; // as far down as it's drawn: the dark beyond
    const open = len - (steps - 2) * run; // the top two treads, no rail by them
    const TOP = [WOOD, FUR_LIGHT, WOOD_DARK, FUR_DARK]; // treads, going down
    const NOSE = [WOOD_LIGHT, WOOD, FUR_LIGHT, WOOD_DARK];
    const RISER = [WOOD_DARK, FUR_DARK, SOOT, COAL];
    box(0, 0, 1, len - 2, 0, v1, 0); // the opening, as wide as the steps below (a rim of floor left at its lower end, under the railing)
    // Its boarded sides, darker down, a seam every few boards.
    const board = (a: number, y: number) => (y > -6 ? (a % 5 === 0 ? FUR_DARK : WOOD_DARK) : y > -11 ? (a % 5 === 0 ? SOOT : FUR_DARK) : COAL);
    box(0, -DEEP, 0, len - 1, -1, 0, (u, y) => board(u, y)); // the far side, toward the camera
    box(0, -DEEP, v1 + 1, len - 1, -1, v1 + 1, (u, y) => board(u, y));
    box(-1, -DEEP, 0, -1, -1, v1 + 1, (_u, y, v) => board(v, y)); // the top end, under the wall
    box(len - 1, -DEEP, 0, len - 1, -1, v1 + 1, COAL);
    box(0, -DEEP, 1, len - 2, -DEEP, v1, COAL); // the dark, further down
    for (let i = 0; i < steps; i++) {
      const k = steps - 1 - i; // treads down from the top
      const top = -rise * (k + 1);
      if (top < -DEEP) continue;
      const u1 = len - 1 - i * run;
      const u0 = i === steps - 1 ? 0 : u1 - run + 1;
      box(u0, -DEEP, 1, u1, top, v1, (u, y) => (y === top ? (u === u1 ? NOSE[k] : TOP[k]) : u === u1 ? RISER[k] : COAL)); // a step, its nosing lit, its riser below
    }
    box(0, 0, v1 + 1, len - 1, 0, v1 + 1, WOOD_LIGHT); // the lip along its open side
    for (let u = len - 1; u > open + 1; u -= run) box(u, 1, 0, u, 11, 0, WOOD_DARK); // balusters along its far side, a tread apart
    box(open, 12, 0, len - 1, 13, 0, (_u, y) => (y === 13 ? WOOD : WOOD_DARK)); // the rail, lit on top
    for (let v = run; v < v1; v += run) box(len - 1, 1, v, len - 1, 11, v, WOOD_DARK); // across its lower end
    box(len - 1, 12, 0, len - 1, 13, v1, (_u, y) => (y === 13 ? WOOD : WOOD_DARK));
    for (const u of [open, len - 2]) box(u, 0, 0, u + 1, 14, 1, (_u, y) => (y === 14 ? WOOD_LIGHT : WOOD_DARK)); // newel posts at its ends
    box(len - 2, 0, v1 - 1, len - 1, 14, v1, (_u, y) => (y === 14 ? WOOD_LIGHT : WOOD_DARK));
  },
  // Upstairs, between the hallway and the rooms off it: a low wall of dark
  // boards (cut low like the room's near walls, to see over), a lit rail on top.
  hallWall: (box, len, _dep, item) => hallWall(box, 0, len - 1, item.tall),
  // A room's door in it: timber posts and a lintel standing tall over a
  // threshold (the door itself meshed apart, to swing: paintDoorLeaf).
  hallDoor: (box, len, _dep, item) => {
    const o = Math.floor((len - 25) / 2); // the door a tile wide, in the middle of its piece (one tile, or two across their joint)
    hallWall(box, 0, o + 3, item.tall);
    hallWall(box, o + 21, len - 1, item.tall);
    if (item.tall) hallWall(box, o + 4, o + 20, true, 31); // full height: the wall on over the lintel
    for (const u of [o + 4, o + 19]) box(u, 0, 0, u + 1, 28, 4, FUR_DARK); // posts
    box(o + 3, 29, 0, o + 21, 30, 4, (_u, y) => (y === 30 ? WOOD_LIGHT : FUR_DARK)); // lintel, past the posts, lit on top
    box(o + 6, 0, 0, o + 18, 0, 4, WOOD_LIGHT); // threshold
  },


  // Upstairs, in the rooms: a bed, single (the homes' own, as wide) or
  // double, off the hallway's wall it stands against (that wall's inside its
  // tiles' edge), its head at its far end (u), against the wall there.
  roomBed: (box, len, dep, item) => paintBed(offWall(headFar(box, len)), len, dep, false, item.cloth),
  doubleBed: (box, len, dep, item) => paintBed(offWall(headFar(box, len)), len, dep - HALL_WALL, true, item.cloth),
  // A wardrobe, off the wall behind it: a tall dark body on a plinth under a
  // lit crown, two lighter doors, iron hinges, brass knobs where they meet.
  wardrobe: (box) => {
    const b = offWall(box); // all of it off the wall
    b(4, 1, 0, 22, 2, 12, WOOD_DARK); // plinth
    b(5, 3, 0, 21, 29, 11, WOOD_DARK); // the body
    b(4, 30, 0, 22, 31, 13, (_u, y, v) => (y === 31 && v === 13 ? WOOD_LIGHT : y === 31 ? WOOD : WOOD_DARK)); // the crown, overhanging, lit
    for (const [u0, u1] of [[6, 12], [14, 20]]) b(u0, 4, 12, u1, 28, 12, (u, y) => (u === u0 || u === u1 || y === 4 || y === 28 ? WOOD : WOOD_LIGHT)); // the doors, framed
    for (const [u, y] of [[6, 8], [6, 23], [20, 8], [20, 23]]) b(u, y, 13, u, y + 1, 13, IRON); // hinges
    for (const u of [12, 14]) b(u, 15, 13, u, 16, 13, BRASS); // knobs
  },
  // A small picture on the wall it's on: propped on a low wall's rail, or
  // on a full one hung on its face at eye height; a gilded frame round a
  // landscape (moss hills under a pale sky, a sun), toward the room (+v).
  framedPicture: (box, _len, _dep, item) => {
    const [dy, dv] = item.tall ? [10, 4] : [0, 0]; // hung: up, and out of the wall onto its face
    const p: Box = (u0, y0, v0, u1, y1, v1, color) =>
      box(u0, y0 + dy, v0 + dv, u1, y1 + dy, v1 + dv, typeof color === 'number' ? color : (u, y, v) => color(u, y - dy, v - dv));
    p(6, 7, 1, 18, 20, 3, (u, y) => (y === 7 || u === 6 ? BRASS_DARK : BRASS)); // the frame, shaded at its foot
    p(8, 9, 3, 16, 18, 3, (u, y) => {
      if (u === 14 && y === 16) return EMBER; // the sun
      const hill = u < 12 ? 12 - Math.abs(u - 10) : 11 - Math.abs(u - 14) / 2; // two hills, the near one higher
      return y <= hill ? (y <= 10 ? MOSS_DARK : MOSS) : PARCHMENT;
    });
  },

  // A wooden tub, two tiles long, rounded: staves (every third a shade
  // darker) bound by two iron hoops, a lit rim, water inside.
  bathtub: (box, len, dep) => {
    const [cu, cv] = [(len - 1) / 2, (dep - 1) / 2];
    const [a, b] = [cu - 3, cv - 3]; // its half length and width
    const inTub = (u: number, v: number, a: number, b: number) => (Math.abs(u - cu) / a) ** 4 + (Math.abs(v - cv) / b) ** 4 <= 1;
    for (let u = 0; u < len; u++) {
      for (let v = 0; v < dep; v++) {
        if (!inTub(u, v, a, b)) continue;
        if (inTub(u, v, a - 2, b - 2)) box(u, 1, v, u, 7, v, WATER); // the water
        else box(u, 1, v, u, 10, v, (_u, y) => (y === 10 ? WOOD_LIGHT : y === 3 || y === 8 ? IRON : (u + v) % 3 === 0 ? WOOD_DARK : WOOD));
      }
    }
  },
};
