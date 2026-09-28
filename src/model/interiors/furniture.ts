// What stands in a room, rolled from the same seed as the room itself, so
// it's always the same for everyone on that seed. Each kind of building is
// furnished its own way: a home has a hearth, a bed, a table with stools, a
// chest, a shelf, barrels and a rug; the inn long tables and benches, a
// counter, kegs and a big hearth; the smithy a forge, an anvil, a trough, a
// weapon rack and a heap of coal. Big pieces stand against the back (-Z) or
// left (-X) wall; nothing blocks the door or the way in from it.

import { hashCell, mulberry32 } from '../../util/random';
import type { Entrance, Room } from './interiors';

export type FurnitureKind =
  | 'hearth'
  | 'bed'
  | 'table'
  | 'stool'
  | 'chest'
  | 'shelf'
  | 'barrel'
  | 'rug'
  | 'longTable'
  | 'bench'
  | 'counter'
  | 'keg'
  | 'forge'
  | 'anvil'
  | 'trough'
  | 'rack'
  | 'coal';

export interface Furniture {
  kind: FurnitureKind;
  x: number; // its first floor tile
  z: number;
  w: number; // tiles it covers along x
  d: number; // along z
  wall: 'back' | 'left' | 'none'; // which wall it stands against (and faces away from)
  solid: boolean; // blocks walking (rugs don't)
}

const RUGS: FurnitureKind[] = ['rug'];

export function furnish(seed: number, entrance: Entrance, room: Room): Furniture[] {
  const rng = mulberry32(hashCell(Math.round(entrance.x * 4), Math.round(entrance.z * 4), seed + 7919));
  const taken = new Set<string>();
  const key = (x: number, z: number) => `${x},${z}`;
  // Kept clear: the door's column (the way in) and the tiles either side of the doorway.
  const clear = (x: number, z: number) => x === room.door || (z >= room.depth - 1 && Math.abs(x - room.door) <= 1);
  const fits = (x: number, z: number, w: number, d: number, onRug = false) => {
    if (x < 0 || z < 0 || x + w > room.width || z + d > room.depth) return false;
    for (let i = x; i < x + w; i++) for (let k = z; k < z + d; k++) if (clear(i, k) || (!onRug && taken.has(key(i, k)))) return false;
    return true;
  };
  const items: Furniture[] = [];
  // Places a piece at the first free spot among `spots` (shuffled), marking its tiles taken.
  const place = (kind: FurnitureKind, w: number, d: number, wall: Furniture['wall'], spots: Array<[number, number]>): Furniture | null => {
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    const rug = RUGS.includes(kind);
    for (const [x, z] of spots) {
      if (!fits(x, z, w, d, rug)) continue;
      const item: Furniture = { kind, x, z, w, d, wall, solid: !rug };
      if (!rug) for (let a = x; a < x + w; a++) for (let b = z; b < z + d; b++) taken.add(key(a, b));
      items.push(item);
      return item;
    }
    return null;
  };
  const along = (z: number) => Array.from({ length: room.width }, (_, x): [number, number] => [x, z]); // spots along a row
  const down = (x: number) => Array.from({ length: room.depth }, (_, z): [number, number] => [x, z]); // along a column
  const inside = () => {
    const spots: Array<[number, number]> = [];
    for (let x = 1; x < room.width - 1; x++) for (let z = 1; z < room.depth - 1; z++) spots.push([x, z]);
    return spots;
  };
  // Seats around a table: free tiles beside it.
  const seats = (table: Furniture, kind: FurnitureKind, chance: number) => {
    for (const [x, z] of [[table.x - 1, table.z], [table.x + table.w, table.z], [table.x, table.z - 1], [table.x, table.z + table.d]]) {
      if (rng() < chance) place(kind, 1, 1, 'none', [[x, z]]);
    }
  };

  if (entrance.type === 'house') {
    place('hearth', 2, 1, 'back', along(0));
    place('bed', 1, 2, 'left', down(0));
    const table = place('table', 1, 1, 'none', inside());
    if (table) {
      seats(table, 'stool', 0.6);
      if (rng() < 0.7) place('rug', 3, 3, 'none', [[table.x - 1, table.z - 1]]);
    }
    place('chest', 1, 1, 'back', along(0));
    if (rng() < 0.7) place('shelf', 1, 1, 'back', along(0));
    for (let n = 1 + Math.floor(rng() * 2); n > 0; n--) place('barrel', 1, 1, 'none', [[room.width - 1, 0], [0, room.depth - 1], [room.width - 1, room.depth - 1], ...along(0)]);
  } else if (entrance.type === 'inn') {
    place('hearth', 2, 1, 'back', along(0));
    place('counter', 1, 3, 'left', down(0));
    for (let n = 2 + Math.floor(rng() * 2); n > 0; n--) place('keg', 1, 1, 'back', along(0));
    for (let n = 2 + Math.floor(rng() * 2); n > 0; n--) {
      const table = place('longTable', 2, 1, 'none', inside());
      if (!table) break;
      place('bench', 2, 1, 'none', [[table.x, table.z - 1]]);
      place('bench', 2, 1, 'none', [[table.x, table.z + 1]]);
    }
  } else {
    const forge = place('forge', 2, 1, 'back', along(0));
    if (forge) place('anvil', 1, 1, 'none', [[forge.x, 1], [forge.x + 1, 1], ...inside()]);
    place('trough', 2, 1, 'none', inside());
    place('rack', 1, 2, 'left', down(0));
    place('coal', 1, 1, 'none', [[room.width - 1, 0], ...along(0)]);
    place('barrel', 1, 1, 'none', [[room.width - 1, room.depth - 1], [0, room.depth - 1]]);
  }
  return items;
}

// Whether a walker of half-width r at (x, z) bumps into solid furniture.
export function bumpsFurniture(items: readonly Furniture[], x: number, z: number, r: number): boolean {
  const inset = 0.08; // pieces don't quite fill their tiles
  return items.some(
    (f) => f.solid && x + r > f.x - 0.5 + inset && x - r < f.x + f.w - 0.5 - inset && z + r > f.z - 0.5 + inset && z - r < f.z + f.d - 0.5 - inset,
  );
}
