// The cathedral town's plan, in tiles from its well (dx, dz): one plan for every world's town (one to a world: townSite.ts),
// only its houses' gaps rolled from the seed. Walled, WALL tiles out each way (a square ring), its gates in the middle of
// three sides (the south's, the east's and the west's: the cathedral's apse stands against the north wall); a street in
// from each gate to the market square (SQUARE tiles out from the well, all cobbled: the stalls round its edge), and a
// ring street RING tiles out. The cathedral on the square's north side, its great door onto the square (the way the
// camera looks from: its tower and front to be seen, its nave running on away up the screen), the pilgrims' inn on the
// west side and the smithy on the east; the townsfolk's houses along the streets, doors onto them, a garden between
// each (as a village's: houses never side by side).

import { hashUnit } from '../../util/random';

export const WALL = 18; // tiles out to the wall ring
export const SQUARE = 6; // tiles out to the market square's edge (13 across)
export const RING = 12; // tiles out to the ring street
export const PLATEAU = WALL + 2; // the hilltop it stands on, out so far (a walk round outside the walls)
// The cathedral: NAVE_HALF tiles either side of the well's column, from the square's north edge back to the wall.
export const NAVE_HALF = 4;
export const CATHEDRAL_FRONT = -(SQUARE + 2); // its front row (a tile of the square before it, the parvis)
export const CATHEDRAL_BACK = -(WALL - 1);
const HOUSES_AT_MOST = 52; // townsfolk's houses (each one villager: the streets lined, the inn busy but never past full: npcRoutine.ts)
const HOUSE_CHANCE = 0.9; // of a free spot along a street having a house

export type WallPiece = 'wall' | 'tower' | 'gate';

export interface WallTile {
  dx: number;
  dz: number;
  piece: WallPiece;
  quarterTurns: number; // a wall's run along x (0) or z (1); a gate's way through likewise; a tower's, 0
}

export type StallKind = 'relics' | 'wine' | 'cloth' | 'potions';

export interface StallSpot {
  dx: number;
  dz: number;
  kind: StallKind;
  front: [number, number]; // the way its counter faces (out onto the square: its keeper stands behind it)
}

export interface TownPlan {
  walls: WallTile[];
  streets: Array<[number, number]>; // cobbled street tiles (path), the square's left out
  houses: Array<{ dx: number; dz: number; door: [number, number] }>; // each door's way out, onto its street
  inn: { tiles: Array<[number, number]>; door: [number, number] };
  smithy: { tiles: Array<[number, number]>; door: [number, number] };
  cathedral: { tiles: Array<[number, number]>; door: [number, number] }; // its front's middle, out onto the square
  stalls: StallSpot[];
}

export const GATES: ReadonlyArray<[number, number]> = [
  [0, WALL],
  [WALL, 0],
  [-WALL, 0],
];

const ring = (dx: number, dz: number) => Math.max(Math.abs(dx), Math.abs(dz));
export const inCathedral = (dx: number, dz: number): boolean => Math.abs(dx) <= NAVE_HALF && dz >= CATHEDRAL_BACK && dz <= CATHEDRAL_FRONT;

// The stalls round the square: the relic-mongers' either side of the way up to the cathedral (pilgrims pass them
// going in), a vintner's and a clothier's on the square's south side, by the gate street, and an apothecary's.
export const STALLS: readonly StallSpot[] = [
  { dx: -3, dz: -SQUARE + 1, kind: 'relics', front: [0, 1] },
  { dx: 3, dz: -SQUARE + 1, kind: 'relics', front: [0, 1] },
  { dx: -4, dz: SQUARE - 1, kind: 'wine', front: [0, -1] },
  { dx: 4, dz: SQUARE - 1, kind: 'cloth', front: [0, -1] },
  { dx: SQUARE - 1, dz: -4, kind: 'potions', front: [-1, 0] },
];

// The town's plan, from the seed (its houses' gaps only).
export function townPlan(seed: number): TownPlan {
  const walls: WallTile[] = [];
  for (let dx = -WALL; dx <= WALL; dx++) {
    for (let dz = -WALL; dz <= WALL; dz++) {
      if (ring(dx, dz) !== WALL) continue;
      const gate = GATES.find(([gx, gz]) => gx === dx && gz === dz);
      const byGate = GATES.some(([gx, gz]) => Math.abs(gx - dx) + Math.abs(gz - dz) === 1);
      const corner = Math.abs(dx) === WALL && Math.abs(dz) === WALL;
      const alongX = Math.abs(dz) === WALL; // (the north and south walls run along x)
      const piece: WallPiece = gate ? 'gate' : byGate || corner || (alongX ? dx : dz) % 6 === 0 ? 'tower' : 'wall';
      walls.push({ dx, dz, piece, quarterTurns: piece === 'tower' ? 0 : alongX ? 0 : 1 });
    }
  }
  const streets: Array<[number, number]> = [];
  const isStreet = new Set<string>();
  const street = (dx: number, dz: number) => {
    if (ring(dx, dz) <= SQUARE || inCathedral(dx, dz) || isStreet.has(`${dx},${dz}`)) return;
    isStreet.add(`${dx},${dz}`);
    streets.push([dx, dz]);
  };
  for (const [gx, gz] of GATES) {
    const [sx, sz] = [Math.sign(gx), Math.sign(gz)];
    for (let i = SQUARE + 1; i <= WALL; i++) street(sx * i, sz * i); // (the gate's own tile too: paved through)
  }
  for (let dx = -RING; dx <= RING; dx++) for (let dz = -RING; dz <= RING; dz++) if (ring(dx, dz) === RING) street(dx, dz);
  street(0, CATHEDRAL_FRONT + 1); // (the parvis: on the square's edge, before the great door)
  const inn = { tiles: [[-SQUARE - 1, -3], [-SQUARE - 1, -2]] as Array<[number, number]>, door: [1, 0] as [number, number] };
  const smithy = { tiles: [[SQUARE + 1, 2], [SQUARE + 1, 3]] as Array<[number, number]>, door: [-1, 0] as [number, number] };
  const cathedral = { tiles: [] as Array<[number, number]>, door: [0, 1] as [number, number] };
  for (let dx = -NAVE_HALF; dx <= NAVE_HALF; dx++) for (let dz = CATHEDRAL_BACK; dz <= CATHEDRAL_FRONT; dz++) cathedral.tiles.push([dx, dz]);

  // The houses: along each street, either side, a free tile a house where none stands beside it (diagonals too).
  const taken = new Set<string>([...inn.tiles, ...smithy.tiles, ...cathedral.tiles].map(([x, z]) => `${x},${z}`));
  const crowded = (dx: number, dz: number) => {
    for (let x = dx - 1; x <= dx + 1; x++) for (let z = dz - 1; z <= dz + 1; z++) if (taken.has(`${x},${z}`)) return true;
    return false;
  };
  const free = (dx: number, dz: number) => ring(dx, dz) < WALL - 1 && ring(dx, dz) > SQUARE && !isStreet.has(`${dx},${dz}`) && !inCathedral(dx, dz) && !crowded(dx, dz);
  const houses: TownPlan['houses'] = [];
  for (const [sx, sz] of streets) {
    for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [hx, hz] = [sx + ox, sz + oz];
      if (houses.length >= HOUSES_AT_MOST || !free(hx, hz) || hashUnit(hx + 64, hz + 64, (seed % 1_000_003) + 4127) >= HOUSE_CHANCE) continue;
      taken.add(`${hx},${hz}`);
      houses.push({ dx: hx, dz: hz, door: [-ox, -oz] });
    }
  }
  return { walls, streets, houses, inn, smithy, cathedral, stalls: [...STALLS] };
}
