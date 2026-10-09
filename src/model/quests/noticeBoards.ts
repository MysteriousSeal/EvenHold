// Where each village's notice board stands: on the square beside its inn,
// facing the well. The first free tile of: the ring tile just past either
// end of the inn, then the tiles just in from those (never before its door,
// which is at the inn's middle). With no inn near, by the well.

import { VILLAGE_OUTER_RADIUS as R } from '../constants';
import type { Building, House, Village } from '../types';
import { solidCells } from '../worldgen/world';
import { nearVillage } from '../villages/nearVillage';
import { PerVillage } from '../villages/perVillage';
import { cellKey } from '../map/grid';

export interface BoardSpot {
  x: number;
  z: number;
  quarterTurns: number; // 0: its faces toward ±z; 1: toward ±x
  front: { dx: number; dz: number }; // the way its face looks out onto the square: read from the tile there
}

export interface BoardWorld {
  villages: readonly Village[];
  houses: readonly House[];
  buildings: readonly Building[];
}

const AROUND = R + 4; // tiles round a village that its board's spot could depend on (its inn, and anything solid)
// Each village's, worked out once from what stands round it (villages/perVillage.ts: and listed once a world).
const boards = new PerVillage<BoardWorld, BoardSpot>((world, village) => {
  const near = nearVillage(world, village, AROUND);
  return boardBy(village, near.buildings, solidCells(near));
});

// Every village's board, by the village's index (worked out once a world).
export const noticeBoards = (world: BoardWorld): BoardSpot[] => boards.all(world);

// Board number `board`'s spot (quests/quests.ts boardVillage: its village's), if its village is known.
export function boardSpot(world: BoardWorld & { villageOf?(board: number): Village | undefined }, board: number): BoardSpot | undefined {
  const village = world.villageOf ? world.villageOf(board) : world.villages[board];
  return village && boardFor(world, village);
}

// A village's board's spot (worked out once, from what stands round it).
export const boardFor = (world: BoardWorld, village: Village): BoardSpot => boards.of(world, village);

function boardBy(village: Village, buildings: readonly Building[], solid: Set<string>): BoardSpot {
  const inn = buildings.find((b) => b.kind === 'inn' && Math.abs(b.x - village.x) <= R + 1 && Math.abs(b.z - village.z) <= R + 1);
  if (inn) {
    const [[ax, az], [bx, bz]] = inn.tiles;
    const [alongX, alongZ] = [bx - ax, bz - az];
    // In from the ring, toward the well (the inn's side of the square).
    const [inX, inZ] = [Math.abs(ax - village.x) === R ? -Math.sign(ax - village.x) : 0, Math.abs(az - village.z) === R ? -Math.sign(az - village.z) : 0];
    const ends: Array<[number, number]> = [
      [ax - alongX, az - alongZ],
      [bx + alongX, bz + alongZ],
    ];
    const quarterTurns = inX !== 0 ? 1 : 0; // its faces toward the well
    for (const [x, z] of [...ends, ...ends.map(([x, z]): [number, number] => [x + inX, z + inZ])]) {
      const corner = Math.abs(x - village.x) === R && Math.abs(z - village.z) === R; // a lantern's
      if (!corner && !solid.has(cellKey(x, z))) return { x, z, quarterTurns, front: facing(village, x, z, quarterTurns) };
    }
  }
  return { x: village.x + 1, z: village.z - 1, quarterTurns: 0, front: facing(village, village.x + 1, village.z - 1, 0) };
}

// Which of a board's two faces looks toward the well (along the axis it faces).
function facing(village: Village, x: number, z: number, quarterTurns: number): { dx: number; dz: number } {
  return quarterTurns === 1 ? { dx: Math.sign(village.x - x) || 1, dz: 0 } : { dx: 0, dz: Math.sign(village.z - z) || 1 };
}
