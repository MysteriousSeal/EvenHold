// What stands in a room: the kinds of furniture, where a piece is, bumping
// into it, and sitting (or lying) on it. How each kind of building is
// furnished is furnish.ts' (a layout per kind, placed by roomPlanner.ts).

import { hashCell } from '../../util/random';
import type { Entrance } from './interiors';

// Every kind of furniture: add one here and it's part of the game, and of
// the furniture yard (the dev cheat, furnitureYard.ts).
export const FURNITURE_KINDS = [
  'hearth',
  'bed',
  'nightstand', // by a bed's head
  'table',
  'chair',
  'chest',
  'shelf',
  'barrel',
  'rug',
  'counter',
  'keg',
  'sink', // behind the bar, where the empty mugs go
  'stairs', // up to the inn's upper floor, along the wall past the bar
  'stairwell', // where they come up, upstairs
  'hallWall', // upstairs: a low wall between the hallway and the rooms off it
  'hallDoor', // and a room's door in it
  'roomBed', // and in the rooms, a bed
  'doubleBed', // or, in the bigger ones, a double
  'wardrobe', // and in the bigger ones, a wardrobe,
  'framedPicture', // a picture propped on a wall's rail,
  'bathtub', // and a wooden tub
  'forge',
  'bellows', // beside the forge
  'smithCounter', // where the smith trades, by the door
  'weaponWall', // his weapons on show, hung on a wall
  'armorStand', // a suit of his armour on a stand
  'grindstone',
  'toolBoard', // his tongs and hammers, hung on a wall
  'anvil',
  'trough',
  'rack',
  'coal',
  // The inn's own
  'armchair',
  'bearRug',
  'barStool',
  'bench', // on the village squares, outdoors (worldgen/benches.ts)
  'bottleShelf',
  'tavernTable',
  'antlers',
  'wallShield',
  'noticeBoard',
  'wallLantern',
] as const;

export type FurnitureKind = (typeof FURNITURE_KINDS)[number];

export const SIT_RANGE = 0.4; // how close to a seat (or bed) the hero must stand to use it

export interface Furniture {
  kind: FurnitureKind;
  x: number; // its first floor tile
  z: number;
  w: number; // tiles it covers along x
  d: number; // along z
  wall: 'back' | 'left' | 'none'; // which wall it stands against (and faces away from)
  solid: boolean; // blocks walking (rugs don't)
  facing?: [number, number]; // a chair: the way its seat faces (toward its table), as (dx, dz)
  open?: boolean; // a door (upstairs, hallDoor): open, its doorway passable
  locked?: boolean; // and locked: it won't open (the inn's rooms: upstairs.ts)
  tried?: number; // how many times it's been tried, locked (each a rattle: roomView.ts)
  cloth?: number; // a bed: its blanket's colour, of four (clothFor)
  suit?: number; // an armour stand: the suit on it, of four (chain, plate, studded leather, brigandine)
  tall?: boolean; // an inner wall (hallWall, hallDoor): full height (the walls option), else low; a picture on one: hung on its face
}

// A bed's blanket colour (of four), the same each time for the world (`seed`), its building and where it stands.
export const clothFor = (seed: number, entrance: Entrance, x: number, z: number, salt = 0): number =>
  hashCell(Math.round(entrance.x * 4) + x * 31, Math.round(entrance.z * 4) + z * 17, seed + 104729 + salt) % 4;

// Slim pieces against a wall block only the part of their tiles they fill,
// as a span out from the wall (0 at the wall, 1 at the far side of the
// tile); everything else blocks its whole tiles (a touch inset).
const SLIM: Partial<Record<FurnitureKind, [number, number]>> = {
  bottleShelf: [0, 0.42],
  counter: [0.26, 0.74],
  shelf: [0, 0.34],
  keg: [0, 0.62],
  hallWall: [0, 0.2], // a wall's thickness, at the tile's edge
  smithCounter: [0.24, 0.84], // (standing free, its span across z) only as deep as it's drawn
  hallDoor: [0, 0.2],
  sink: [0, 0.42], // slim against the wall, like the shelves // on its side, reaching 0.6 of its tile out (tap and all)
};

// Seats pulled up to what they face (a chair to its table, a stool to the
// bar) fill only part of their tile: a span across it and a span toward what
// they face (0 at the back of the tile, 1 at the front), as they're drawn.
const PULLED_UP: Partial<Record<FurnitureKind, { across: [number, number]; forward: [number, number] }>> = {
  chair: { across: [0.24, 0.72], forward: [0.48, 0.96] },
  barStool: { across: [0.28, 0.72], forward: [0.56, 1] },
  nightstand: { across: [0.2, 0.8], forward: [0.04, 0.56] }, // (not a seat: its back to the wall, only as big as it's drawn)
};

// A seat's footprint within its tile, as tile fractions [x0, x1, z0, z1],
// its front turned toward `facing`.
function seatSpan(across: [number, number], forward: [number, number], [dx, dz]: [number, number]): [number, number, number, number] {
  const flip = ([a, b]: [number, number]): [number, number] => [1 - b, 1 - a];
  if (dz === 1) return [...across, ...forward];
  if (dz === -1) return [...flip(across), ...flip(forward)];
  if (dx === 1) return [...forward, ...flip(across)];
  return [...flip(forward), ...across];
}

const LEAF_HINGE = 6; // voxels in from the door's tile, where its leaf hangs (innFurnitureVoxels.ts DOOR_LEAF)
const LEAF_REACH = 0.52; // tiles out from its wall the leaf reaches, swung open
const DOORWAY = 0.36; // half an open door's passable width, from its middle (out to its posts: the walker's a squeeze through the leaf's own)

// Whether a walker of half-width r at (x, z) bumps into solid furniture.
export function bumpsFurniture(items: readonly Furniture[], x: number, z: number, r: number): boolean {
  const inset = 0.08; // pieces don't quite fill their tiles
  return items.some((f) => {
    if (!f.solid) return false;
    let [x0, x1, z0, z1] = [f.x - 0.5 + inset, f.x + f.w - 0.5 - inset, f.z - 0.5 + inset, f.z + f.d - 0.5 - inset];
    const slim = SLIM[f.kind];
    if (slim && f.wall === 'left') [x0, x1] = [f.x - 0.5 + slim[0], f.x - 0.5 + slim[1]];
    if (slim && f.wall !== 'left') [z0, z1] = [f.z - 0.5 + slim[0], f.z - 0.5 + slim[1]]; // back wall (or standing free: across z)
    const seat = PULLED_UP[f.kind];
    if (seat && f.facing) {
      const [a0, a1, b0, b1] = seatSpan(seat.across, seat.forward, f.facing);
      [x0, x1, z0, z1] = [f.x - 0.5 + a0, f.x - 0.5 + a1, f.z - 0.5 + b0, f.z - 0.5 + b1];
    }
    const hit = (a0: number, a1: number, b0: number, b1: number) => x + r > a0 && x - r < a1 && z + r > b0 && z - r < b1;
    if (f.open) {
      // An open door: through its doorway, but not the wall either side of it,
      // nor its leaf, swung out into the room (just clear of the doorway itself).
      const left = f.wall === 'left';
      const start = (left ? f.z : f.x) - 0.5;
      const len = left ? f.d : f.w;
      const mid = start + len / 2;
      const hinge = start + (Math.floor((len * 25 - 25) / 2) + LEAF_HINGE) / 25; // along the wall
      const face = (left ? f.x : f.z) - 0.5 + 0.1; // the wall's middle
      const [a0, a1, c0, c1] = [hinge - 0.15, hinge - 0.02, face + 0.1, face + LEAF_REACH]; // the swung leaf: along, then out
      return left
        ? hit(x0, x1, z0, mid - DOORWAY) || hit(x0, x1, mid + DOORWAY, z1) || hit(c0, c1, a0, a1)
        : hit(x0, mid - DOORWAY, z0, z1) || hit(mid + DOORWAY, x1, z0, z1) || hit(a0, a1, c0, c1);
    }
    return hit(x0, x1, z0, z1);
  });
}

// Where someone sits on a seat: the top of its seat (as drawn), a little
// toward its front, facing the way it faces. A bed is lain on instead: on
// the mattress, head on the pillow (by the headboard, at the low end along
// the wall), (x, z) then where the feet go and `facing` from head to feet.
export interface Seat {
  piece: Furniture;
  x: number;
  z: number;
  y: number; // the seat's top, where the hips rest (or the back, lying down)
  facing: number; // yaw, as the hero's facing (atan2(dx, dz))
  lying: boolean;
}

const MATTRESS = 0.24; // where a sleeper's back lies: a little under the blanket's top (0.32), so they're tucked in, face and chest above it
const HEAD_TO_FEET = 1.12; // from the headboard end of the bed to where the feet lie (the head a little clear of the headboard)

const SEATS: Partial<Record<FurnitureKind, { height: number; forward: number }>> = {
  chair: { height: 0.36, forward: 0.26 }, // forward enough that the head clears the chair's back
  armchair: { height: 0.32, forward: -0.05 }, // back against its backrest
  barStool: { height: 0.56, forward: 0.26 },
};

const OFF_WALL = 0.2; // tiles upstairs beds are drawn out from the wall they stand against (off its thickness)
const DOUBLE_SIDES = [0.7, 1.48]; // a double bed's two sleepers, each under a pillow, in tiles out from its wall's edge

// The seat on a piece of furniture, or null if it's not something to sit on;
// on a double bed, the side nearest `near` (the one standing by it).
export function seatOf(piece: Furniture, near?: { x: number; z: number }): Seat | null {
  if (piece.kind === 'bed' || piece.kind === 'roomBed' || piece.kind === 'doubleBed') {
    const alongZ = piece.wall === 'left';
    const far = piece.kind !== 'bed'; // upstairs, its head at its far end, against the wall there
    const start = (alongZ ? piece.z : piece.x) - 0.5;
    const feet = far ? start + (alongZ ? piece.d : piece.w) - HEAD_TO_FEET : start + HEAD_TO_FEET;
    const edge = (alongZ ? piece.x : piece.z) - 0.5; // its wall's side
    let across = edge + (alongZ ? piece.w : piece.d) / 2 + (piece.kind === 'roomBed' ? OFF_WALL : 0); // down its middle (upstairs, drawn off the wall)
    if (piece.kind === 'doubleBed') {
      const sides = DOUBLE_SIDES.map((s) => edge + s);
      const at = near ? (alongZ ? near.x : near.z) : sides[0];
      across = Math.abs(at - sides[0]) <= Math.abs(at - sides[1]) ? sides[0] : sides[1]; // the nearer side
    }
    return {
      piece,
      x: alongZ ? across : feet,
      z: alongZ ? feet : across,
      y: MATTRESS,
      facing: (alongZ ? 0 : Math.PI / 2) + (far ? Math.PI : 0),
      lying: true,
    };
  }
  const seat = SEATS[piece.kind];
  if (!seat || !piece.facing) return null;
  const [dx, dz] = piece.facing;
  return { piece, x: piece.x + dx * seat.forward, z: piece.z + dz * seat.forward, y: seat.height, facing: Math.atan2(dx, dz), lying: false };
}

// How far (x, z) is from a piece's tiles (0 on them).
export function distanceTo(piece: Furniture, x: number, z: number): number {
  const dx = Math.max(piece.x - 0.5 - x, 0, x - (piece.x + piece.w - 0.5));
  const dz = Math.max(piece.z - 0.5 - z, 0, z - (piece.z + piece.d - 0.5));
  return Math.hypot(dx, dz);
}
