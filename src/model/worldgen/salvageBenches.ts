// A salvage bench on every village's square (skills/salvage.ts: gear broken down into what it's made of): a heavy
// workbench with a vice, a step or two in from the well on the paving, facing it, where nothing else stands (the
// benches round the edge, the lanterns at the corners, the notice board by the inn: worldgen/benches.ts,
// quests/noticeBoards.ts), off the lanes that come in to the well. Worked out once a village, as the board is.
import type { Village } from '../types';
import { NEIGHBORS_4, cellKey } from '../map/grid';
import { solidCells } from './world';
import { boardFor } from '../quests/noticeBoards';
import { entrancesOf } from '../interiors/interiors';
import { squareLanterns } from './villages';
import type { BenchWorld } from './benches';
import { nearVillage } from '../villages/nearVillage';

export interface SalvageBench {
  x: number;
  z: number;
  village: Village;
  quarterTurns: number; // its vice end toward the well
  front: { dx: number; dz: number }; // the way to the well: where the hero stands to work at it
}

export const BENCH_REACH = 1.3; // tiles from its middle the hero can work at it

const AROUND = 6; // tiles round the well its spot could depend on
const SPOTS: ReadonlyArray<[number, number]> = [[2, 2], [-2, 2], [2, -2], [-2, -2], [3, 0], [-3, 0], [0, 3], [0, -3]]; // from the well, the likeliest first
const RING: ReadonlyArray<[number, number]> = Array.from({ length: 49 }, (_, i): [number, number] => [(i % 7) - 3, Math.floor(i / 7) - 3]).filter(([dx, dz]) => Math.max(Math.abs(dx), Math.abs(dz)) >= 2); // and any two or three steps off it
const benchOf = new WeakMap<Village, SalvageBench>();
const listed = new WeakMap<readonly Village[], SalvageBench[]>();

// Every village's bench, by the village's index (worked out once a world; again as a streamed world's villages grow).
export function salvageBenches(world: BenchWorld): SalvageBench[] {
  let benches = listed.get(world.villages);
  if (!benches || benches.length !== world.villages.length) {
    benches = world.villages.map((v) => benchFor(world, v));
    listed.set(world.villages, benches);
  }
  return benches;
}

export function benchFor(world: BenchWorld, village: Village): SalvageBench {
  let bench = benchOf.get(village);
  if (!bench) {
    const near = nearVillage(world, village, AROUND);
    const solid = solidCells(near);
    const board = boardFor(world, village);
    // (Not built on, not on a lane nor beside one (the ways in to the well), not the board's spot.)
    const path = (x: number, z: number) => world.tiles.surface(x, z) === 'path';
    const doors = entrancesOf(near.houses, near.buildings);
    const lanterns = squareLanterns(village); // (the square's lamp posts: not on one, nor against one)
    const free = (x: number, z: number) => !solid.has(cellKey(x, z)) && !path(x, z) && !NEIGHBORS_4.some(([nx, nz]) => path(x + nx, z + nz)) && !(board.x === x && board.z === z) && !lanterns.some(([lx, lz]) => Math.abs(lx - x) <= 1 && Math.abs(lz - z) <= 1);
    // Of the spots that will do (the nearest the well first, then any two or three steps off it), the one farthest
    // from a door (two tiles and more are all one: before a door, or the tile past its step, is never had).
    const gap = (x: number, z: number) => Math.min(3, ...doors.map((d) => Math.max(Math.abs(d.x - x), Math.abs(d.z - z))));
    const spots = [...SPOTS, ...RING.filter(([rx, rz]) => !SPOTS.some(([sx, sz]) => sx === rx && sz === rz))].filter(([dx, dz]) => free(village.x + dx, village.z + dz));
    const [dx, dz] = spots.sort((a, b) => gap(village.x + b[0], village.z + b[1]) - gap(village.x + a[0], village.z + a[1]))[0] ?? SPOTS[0];
    const [x, z] = [village.x + dx, village.z + dz];
    const quarterTurns = Math.abs(dx) >= Math.abs(dz) ? 1 : 0;
    bench = { x, z, village, quarterTurns, front: { dx: -Math.sign(dx), dz: -Math.sign(dz) } };
    benchOf.set(village, bench);
  }
  return bench;
}

// The bench the hero's within reach of (its village's index), if any.
export function salvageBenchInReach(benches: readonly SalvageBench[], hero: { x: number; z: number }): number | null {
  const i = benches.findIndex((b) => Math.hypot(b.x - hero.x, b.z - hero.z) <= BENCH_REACH);
  return i < 0 ? null : i;
}
