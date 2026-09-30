// Wooden benches on the village squares: a few along each square's edge,
// in the gaps between the houses, looking in toward the well, two seats
// to a bench (a tile is about two of the hero tall: a bench fits in one).
// Not where a lane comes in, a door opens, the notice board or a lamp post
// stands, nor right beside another bench. Anyone can sit on a free seat:
// the hero (E), or villagers on their stroll round the square.

import { ROAD_SURFACE_HEIGHT, TILE_HEIGHT, VILLAGE_OUTER_RADIUS as R } from '../constants';
import { NEIGHBORS_4, cellKey } from '../map/grid';
import type { Seat } from '../interiors/furniture';
import { entrancesOf } from '../interiors/interiors';
import { noticeBoards, type BoardWorld } from '../quests/noticeBoards';
import type { Surface, Village } from '../types';
import { hashUnit } from '../../util/random';
import { solidCells } from './world';

const PER_SQUARE = 3; // benches on a square, at most
const SEAT_HEIGHT = 0.2; // where the hips rest, above the paving (a chair indoors, at the outdoor scale)
const SEAT_APART = 0.19; // each seat's middle from the bench's, along it
const BENCH_REACH = 0.8; // how close the hero must be to a free seat to sit on it

export interface Bench {
  village: number; // its village's index
  x: number; // its tile, on the square's edge
  z: number;
  y: number; // the paving it stands on
  front: [number, number]; // the way it faces, in toward the well
  quarterTurns: number; // its model turned to face that way (0: facing +z)
  seats: Seat[]; // its two, left and right
}

export interface BenchWorld extends BoardWorld {
  seed: number;
  surfaceMap: Surface[][];
}

const made = new WeakMap<readonly Village[], Bench[]>();

// Every square's benches (worked out once a world).
export function squareBenches(world: BenchWorld): Bench[] {
  let benches = made.get(world.villages);
  if (!benches) {
    const solid = solidCells({ villages: [...world.villages], houses: [...world.houses], buildings: [...world.buildings] });
    const doors = entrancesOf(world.houses, world.buildings);
    const boards = noticeBoards(world);
    benches = world.villages.flatMap((village, i) => benchesOn(world, village, i, solid, doors, boards[i]));
    made.set(world.villages, benches);
  }
  return benches;
}

function benchesOn(world: BenchWorld, village: Village, index: number, solid: Set<string>, allDoors: ReadonlyArray<{ x: number; z: number }>, board: { x: number; z: number }): Bench[] {
  const path = (x: number, z: number) => world.surfaceMap[x]?.[z] === 'path';
  // Only this square's doors can be before a spot on its edge (not the world's thousands).
  const doors = allDoors.filter((d) => Math.abs(d.x - village.x) <= R + 1 && Math.abs(d.z - village.z) <= R + 1);
  const spots: Array<{ x: number; z: number; front: [number, number]; order: number }> = [];
  for (const [dx, dz] of NEIGHBORS_4) {
    for (let t = -(R - 1); t <= R - 1; t++) {
      // Along this side of the square's edge (never its corners, the lamp posts').
      const x = village.x + dx * R + Math.abs(dz) * t;
      const z = village.z + dz * R + Math.abs(dx) * t;
      if (solid.has(cellKey(x, z)) || path(x, z) || NEIGHBORS_4.some(([nx, nz]) => path(x + nx, z + nz))) continue; // built on, or where a lane comes in
      if (Math.abs(x - board.x) <= 1 && Math.abs(z - board.z) <= 1) continue; // room round the notice board
      if (doors.some((d) => Math.abs(d.x - x) < 1 && Math.abs(d.z - z) < 1)) continue; // before a door
      spots.push({ x, z, front: [-dx, -dz], order: hashUnit(x, z, (world.seed % 1_000_003) + 301) });
    }
  }
  const chosen: typeof spots = [];
  for (const spot of spots.sort((a, b) => a.order - b.order)) {
    if (chosen.length >= PER_SQUARE) break;
    if (chosen.some((c) => Math.max(Math.abs(c.x - spot.x), Math.abs(c.z - spot.z)) <= 1)) continue; // not right beside another
    chosen.push(spot);
  }
  const y = village.groundTier * TILE_HEIGHT + ROAD_SURFACE_HEIGHT;
  return chosen.map(({ x, z, front }) => {
    const [fx, fz] = front;
    const [ax, az] = [fz, -fx]; // along it: its left, as one sits
    const bench: Bench = { village: index, x, z, y, front, quarterTurns: quarterTurnsOf(front), seats: [] };
    bench.seats = [-1, 1].map((side) => {
      const at = { x: x + ax * side * SEAT_APART, z: z + az * side * SEAT_APART };
      // Each seat its own piece, so the two are taken apart from each other.
      const piece = { kind: 'bench' as const, x: at.x, z: at.z, w: 1, d: 1, wall: 'none' as const, solid: true, facing: front };
      return { piece, x: at.x, z: at.z, y: y + SEAT_HEIGHT, facing: Math.atan2(fx, fz), lying: false };
    });
    return bench;
  });
}

// Quarter turns (about y) that face +z toward `front`.
function quarterTurnsOf([fx, fz]: [number, number]): number {
  return fz === 1 ? 0 : fx === 1 ? 1 : fz === -1 ? 2 : 3;
}

// The free bench seat nearest the hero, within reach; else null. `taken`: whether a seat's piece is someone's.
export function benchSeatInReach(benches: readonly Bench[], hero: { x: number; z: number }, taken: (seat: Seat) => boolean): Seat | null {
  let best: Seat | null = null;
  let bestDistance = BENCH_REACH;
  for (const bench of benches) {
    if (Math.abs(bench.x - hero.x) > 2 || Math.abs(bench.z - hero.z) > 2) continue;
    for (const seat of bench.seats) {
      const d = Math.hypot(seat.x - hero.x, seat.z - hero.z);
      if (d <= bestDistance && !taken(seat)) [best, bestDistance] = [seat, d];
    }
  }
  return best;
}
