// The stocks on every village square (arrest.ts: a day in them, the witch-finders' sentence): on the square's edge
// where a bench could stand (worldgen/benches.ts edgeSpots), the first such spot not beside a bench, facing in toward
// the well, so the one held in them faces the whole square. A low bench to sit on, a board in front with holes for
// the ankles. Solid (map/blockers.ts), as a bench is. The hero's held sat in them while the day passes (roads.ts).
import { VILLAGE_OUTER_RADIUS as R } from '../constants';
import { edgeSpots, quarterTurnsOf, squareY, villageBenches, type BenchWorld } from '../worldgen/benches';
import { entrancesOf } from '../interiors/interiors';
import type { Seat } from '../interiors/furniture';
import { boardFor } from '../quests/noticeBoards';
import { nearVillage } from '../villages/nearVillage';
import { solidCells } from '../worldgen/world';
import type { Village } from '../types';

const SEAT_HEIGHT = 0.16; // where the hips rest: lower than a bench, the legs out through the board
const SEAT_BACK = 0.14; // the seat behind the tile's middle (the board before it)

export interface Stocks {
  village: Village;
  x: number; // its tile
  z: number;
  y: number; // the paving it stands on
  front: [number, number]; // the way it faces, in toward the well
  quarterTurns: number; // its model turned to face that way (0: facing +z)
  seat: Seat; // where the one held in them sits
}

const stocksOf = new WeakMap<Village, Stocks | null>();
const listed = new WeakMap<readonly Village[], { count: number; stocks: Stocks[] }>();
const AROUND = R + 6;

// A square's stocks (none, if its edge has no room left beside its benches).
export function villageStocks(world: BenchWorld, village: Village): Stocks | null {
  if (stocksOf.has(village)) return stocksOf.get(village)!;
  const near = nearVillage(world, village, AROUND);
  const benches = villageBenches(world, village);
  const spot = edgeSpots(world, village, solidCells(near), entrancesOf(near.houses, near.buildings), boardFor(world, village)).find((s) => !benches.some((b) => Math.max(Math.abs(b.x - s.x), Math.abs(b.z - s.z)) <= 1));
  const stocks = spot ? made(village, spot) : null;
  stocksOf.set(village, stocks);
  return stocks;
}

// Every square's stocks.
export function squareStocks(world: BenchWorld): Stocks[] {
  const known = listed.get(world.villages);
  if (known && known.count === world.villages.length) return known.stocks;
  const stocks = world.villages.flatMap((v) => villageStocks(world, v) ?? []);
  listed.set(world.villages, { count: world.villages.length, stocks });
  return stocks;
}

function made(village: Village, { x, z, front }: { x: number; z: number; front: [number, number] }): Stocks {
  const [fx, fz] = front;
  const y = squareY(village);
  const at = { x: x - fx * SEAT_BACK, z: z - fz * SEAT_BACK };
  const piece = { kind: 'bench' as const, x: at.x, z: at.z, w: 1, d: 1, wall: 'none' as const, solid: true, facing: front };
  return { village, x, z, y, front, quarterTurns: quarterTurnsOf(front), seat: { piece, x: at.x, z: at.z, y: y + SEAT_HEIGHT, facing: Math.atan2(fx, fz), lying: false } };
}
