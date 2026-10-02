// Going indoors. Every house in a village, the inn and the smithy has a door
// (its local -Z side) with a spot just outside it; standing there, the hero
// can step into the building's room, a place of its own away from the map.
//
// A room is rolled from the world's seed and where its door is, so a given
// building's room is the same for everyone playing that seed: its size
// (from what kind of building it is), its floor and its walls. Rooms use
// their own tile coordinates: floor tiles 0..width-1 along x and
// 0..depth-1 along z, the door in the +Z wall, facing the camera.

import { isHerbalistHome } from '../herbalist/herbalistHomes';
import { hashCell, mulberry32 } from '../../util/random';
import type { Building, House } from '../types';

export type BuildingType = 'house' | 'inn' | 'smithy';
export type EntranceType = BuildingType | 'crypt'; // (a crypt's way in: stairs down in a ruin, crypts/crypts.ts)

export interface Entrance {
  type: EntranceType;
  x: number; // just outside the door, where the hero stands to go in
  z: number;
  outX: number; // the way out of the door (a unit vector)
  outZ: number;
}

export type FloorStyle = 'planks' | 'boards' | 'flagstones' | 'tavern' | 'earth'; // (earth: a herbalist's, strewn with rushes)
export type WallStyle = 'plaster' | 'timber' | 'stone' | 'daub'; // (daub: a herbalist's, over fieldstone, as their hut outside)

export interface Room {
  width: number; // floor tiles along x
  depth: number; // along z
  door: number; // the floor column the door opens onto, in the +Z wall
  floor: FloorStyle;
  wall: WallStyle;
}

const DOOR_REACH = 0.62; // from a building's middle to just outside its door
export const ENTER_RANGE = 0.5; // how close to the door spot the hero must be

// The way out of a door on a building turned by `rotationY` (its local -Z).
function outward(rotationY: number): [number, number] {
  return [-Math.sin(rotationY), -Math.cos(rotationY)];
}

export function entrancesOf(houses: readonly House[], buildings: readonly Building[]): Entrance[] {
  const at = (type: BuildingType, x: number, z: number, rotationY: number): Entrance => {
    const [outX, outZ] = outward(rotationY);
    return { type, x: x + outX * DOOR_REACH, z: z + outZ * DOOR_REACH, outX, outZ };
  };
  return [
    ...houses.map((h) => at('house', h.x, h.z, h.rotationY)),
    ...buildings.map((b) => at(b.kind, b.x, b.z, (b.quarterTurns * Math.PI) / 2)),
  ];
}

// Sizes by kind of building: [min, max] tiles across and deep.
const SIZES: Record<BuildingType, { width: [number, number]; depth: [number, number] }> = {
  house: { width: [5, 8], depth: [4, 6] },
  inn: { width: [11, 13], depth: [8, 10] }, // roomy: a bar, a hearth corner and the tables
  smithy: { width: [7, 9], depth: [6, 7] },
};
// A herbalist's house (herbalist/herbalistHomes.ts): shop, workroom and home, just big enough for all their pieces,
// each reachable (herbalistLayout.ts; tests/herbalistInside.test.ts tries every door): no emptier.
const HERBALIST_SIZE = { width: [7, 7] as [number, number], depth: [6, 6] as [number, number] };
const FLOORS: Record<BuildingType, FloorStyle[]> = { house: ['planks', 'boards', 'flagstones'], inn: ['tavern'], smithy: ['flagstones'] };
const WALLS: Record<BuildingType, WallStyle[]> = { house: ['plaster', 'timber', 'stone'], inn: ['timber', 'plaster'], smithy: ['stone'] };

// The room behind a building's door: the same for a given seed and door, always.
// (Never a crypt's: those are their own, crypts/crypts.ts.)
export function roomFor(seed: number, entrance: Entrance): Room {
  const rng = mulberry32(hashCell(Math.round(entrance.x * 4), Math.round(entrance.z * 4), seed));
  const roll = ([lo, hi]: [number, number]) => lo + Math.floor(rng() * (hi - lo + 1));
  const pick = <T>(options: T[]) => options[Math.floor(rng() * options.length)];
  const type = entrance.type as BuildingType;
  const size = type === 'house' && isHerbalistHome(entrance) ? HERBALIST_SIZE : SIZES[type]; // (a herbalist's: room for their shop and workroom)
  const width = roll(size.width);
  const depth = roll(size.depth);
  const middle = Math.floor(width / 2);
  const door = width >= 7 ? middle + (rng() < 0.5 ? -1 : 1) * Math.floor(rng() * 2) : middle;
  const herbalist = size === HERBALIST_SIZE;
  return { width, depth, door, floor: herbalist ? 'earth' : pick(FLOORS[type]), wall: herbalist ? 'daub' : pick(WALLS[type]) }; // (a herbalist's as rustic inside as out)
}
