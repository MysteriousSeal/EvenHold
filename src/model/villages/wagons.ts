// The wagons between villages: from any village's notice board, a seat on the carrier's wagon to any village the
// hero's been to before (villages/villageWelcome.ts keeps them as they come into each: its name, its level, and
// where its wagon sets down, on the square before its board), for a fare and some hours on the road by how far it is.
// Paid, the hours pass, and they're set down there. Kept in the save.

import type { BoardSpot } from '../quests/noticeBoards';

export interface Stop {
  name: string;
  level: number;
  x: number; // where the wagon sets down
  z: number;
}

const FARE_BASE = 12; // copper, the least fare
const FARE_PER_TILE = 0.3; // copper, a tile of the way
const TILES_AN_HOUR = 50; // the wagon's pace
const NEAR = 30; // tiles: a stop this near is the village they're at (no ride to it)

export const stopKey = (village: { x: number; z: number }): string => `${village.x},${village.z}`;

// Where a village's wagon sets down: on its square, before its notice board.
export const stopBy = (board: BoardSpot): { x: number; z: number } => ({ x: board.x + board.front.dx, z: board.z + board.front.dz });

export const fareFor = (tiles: number): number => Math.ceil(FARE_BASE + tiles * FARE_PER_TILE);
export const hoursFor = (tiles: number): number => Math.max(1, Math.round(tiles / TILES_AN_HOUR));

export interface Ride extends Stop {
  key: string;
  fare: number;
  hours: number;
}

// The rides to be had from `here` (a village's board): every village been to but this one, the nearest first.
export function ridesFrom(stops: ReadonlyMap<string, Stop>, here: { x: number; z: number }): Ride[] {
  return [...stops.entries()]
    .map(([key, stop]) => ({ key, stop, tiles: Math.hypot(stop.x - here.x, stop.z - here.z) }))
    .filter(({ tiles }) => tiles > NEAR)
    .sort((a, b) => a.tiles - b.tiles)
    .map(({ key, stop, tiles }) => ({ ...stop, key, fare: fareFor(tiles), hours: hoursFor(tiles) }));
}

export interface Rider {
  hero: { money: number };
  minutes: number;
  teleport(x: number, z: number): void;
}

// A ride taken from `here` to the stop `key`: paid, the hours gone by on the road, set down there. Or why not.
export function takeRide(model: Rider, stops: ReadonlyMap<string, Stop>, here: { x: number; z: number }, key: string): 'ridden' | 'too poor' | 'no such ride' {
  const ride = ridesFrom(stops, here).find((r) => r.key === key);
  if (!ride) return 'no such ride';
  if (model.hero.money < ride.fare) return 'too poor';
  model.hero.money -= ride.fare;
  model.minutes += ride.hours * 60;
  model.teleport(ride.x, ride.z);
  return 'ridden';
}

// The stops been to, read back from a save (anything unsound left out).
export function readStops(saved: unknown): Map<string, Stop> {
  const stops = new Map<string, Stop>();
  if (!Array.isArray(saved)) return stops;
  for (const s of saved) {
    if (!s || typeof s !== 'object') continue;
    const { key, name, level, x, z } = s as Record<string, unknown>;
    if (typeof key === 'string' && typeof name === 'string' && [level, x, z].every((n) => typeof n === 'number' && Number.isFinite(n))) stops.set(key, { name: name.slice(0, 60), level: level as number, x: x as number, z: z as number });
  }
  return stops;
}

export const savedStops = (stops: ReadonlyMap<string, Stop>): Array<Stop & { key: string }> => [...stops.entries()].map(([key, s]) => ({ key, ...s }));
