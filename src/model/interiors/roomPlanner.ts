// Placing a room's furniture (furnish.ts, by the kind of building): each
// piece at the first free spot among those it's offered, its tiles taken;
// tiles kept free (the door's way in, room to stand before a piece); spots
// along a row or column, or inside; chairs round a table; and a check for
// floor walled in. Rolled from the seed and where the building stands, so
// the same for everyone.

import { hashCell, mulberry32, shuffle } from '../../util/random';
import type { Entrance, Room } from './interiors';
import { cellKey, flood } from '../map/grid';
import type { Furniture, FurnitureKind } from './furniture';

const RUGS: FurnitureKind[] = ['rug', 'bearRug'];
// Hung on a wall, above everything on the floor: they take no floor tiles.
const WALL_HUNG: FurnitureKind[] = ['antlers', 'wallShield', 'noticeBoard', 'wallLantern', 'weaponWall', 'toolBoard'];

export type Planner = ReturnType<typeof roomPlanner>;

export function roomPlanner(seed: number, entrance: Entrance, room: Room) {
  const rng = mulberry32(hashCell(Math.round(entrance.x * 4), Math.round(entrance.z * 4), seed + 7919));
  const taken = new Set<string>();
  const kept = new Set<string>(); // left free around a piece (a bed's side), for nothing to crowd it
  const key = cellKey;
  // Kept clear: the door's column (the way in) and the tiles either side of the doorway.
  const clear = (x: number, z: number) => x === room.door || (z >= room.depth - 1 && Math.abs(x - room.door) <= 1);
  // `backWall`: the door's column may be taken where it meets the back wall (nothing's in the way there).
  const fits = (x: number, z: number, w: number, d: number, onRug = false, backWall = false) => {
    if (x < 0 || z < 0 || x + w > room.width || z + d > room.depth) return false;
    for (let i = x; i < x + w; i++) for (let k = z; k < z + d; k++) if ((clear(i, k) && !(backWall && k === 0)) || kept.has(key(i, k)) || (!onRug && taken.has(key(i, k)))) return false;
    return true;
  };
  const items: Furniture[] = [];
  // Places a piece at the first free spot among `spots` (shuffled), marking its tiles taken.
  const place = (kind: FurnitureKind, w: number, d: number, wall: Furniture['wall'], spots: Array<[number, number]>, shuffled = true, backWall = false): Furniture | null => {
    if (shuffled) shuffle(spots, rng);
    const rug = RUGS.includes(kind) || WALL_HUNG.includes(kind);
    for (const [x, z] of spots) {
      if (!fits(x, z, w, d, rug, backWall)) continue;
      const item: Furniture = { kind, x, z, w, d, wall, solid: !rug };
      if (WALL_HUNG.includes(kind)) {
        // Hung pieces only need their spot on the wall free of other hung pieces.
        if (items.some((o) => WALL_HUNG.includes(o.kind) && o.wall === wall && o.x === x && o.z === z)) continue;
      }
      if (!rug) for (let a = x; a < x + w; a++) for (let b = z; b < z + d; b++) taken.add(key(a, b));
      items.push(item);
      return item;
    }
    return null;
  };
  const along = (z: number) => Array.from({ length: room.width }, (_, x): [number, number] => [x, z]); // spots along a row
  const down = (x: number) => Array.from({ length: room.depth }, (_, z): [number, number] => [x, z]); // along a column
  // A free floor tile no one could walk to from the door, if any (furniture all round it).
  // The free floor reached from (x, z), tile to tile, round what's taken.
  const floorFrom = (x0: number, z0: number): Set<string> => flood([[x0, z0]], (x, z) => x >= 0 && z >= 0 && x < room.width && z < room.depth && !taken.has(key(x, z)));
  const walledIn = (): [number, number] | null => {
    const seen = floorFrom(room.door, room.depth - 1);
    for (let x = 0; x < room.width; x++) for (let z = 0; z < room.depth; z++) if (!taken.has(key(x, z)) && !seen.has(key(x, z))) return [x, z];
    return null;
  };
  const inside = () => {
    const spots: Array<[number, number]> = [];
    for (let x = 1; x < room.width - 1; x++) for (let z = 1; z < room.depth - 1; z++) spots.push([x, z]);
    return spots;
  };
  // Two to four chairs round a table, on its free sides (in a rolled order),
  // each facing it.
  const chairs = (table: Furniture, kind: FurnitureKind = 'chair') => {
    const sides: Array<[number, number, number, number]> = [
      [table.x - 1, table.z, 1, 0],
      [table.x + table.w, table.z, -1, 0],
      [table.x, table.z - 1, 0, 1],
      [table.x, table.z + table.d, 0, -1],
    ];
    shuffle(sides, rng);
    let wanted = 2 + Math.floor(rng() * 3);
    for (const [x, z, dx, dz] of sides) {
      if (wanted === 0) break;
      const chair = place(kind, 1, 1, 'none', [[x, z]]);
      if (!chair) continue;
      chair.facing = [dx, dz];
      wanted--;
    }
  };
  // A barrel on a free tile walled off from the door (a corner, boxed in):
  // clutter where no one could go anyway. fillWalledIn: on every such tile.
  const fillPocket = (x: number, z: number) => {
    items.push({ kind: 'barrel', x, z, w: 1, d: 1, wall: 'none', solid: true });
    taken.add(key(x, z));
  };
  const fillWalledIn = () => {
    for (let pocket = walledIn(); pocket; pocket = walledIn()) fillPocket(...pocket);
  };
  // Floor walled off by `kind` pieces (chairs round tables, closing off a corner) opened up:
  // one at the pocket's edge taken away at a time, till there's none (or none such walls it).
  const openWalledIn = (kind: FurnitureKind) => {
    for (let pocket = walledIn(); pocket; pocket = walledIn()) {
      const region = floorFrom(...pocket);
      const edge = items.findIndex((o) => o.kind === kind && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => region.has(key(o.x + dx, o.z + dz))));
      if (edge < 0) return;
      const [piece] = items.splice(edge, 1);
      taken.delete(key(piece.x, piece.z));
    }
  };
  return { rng, taken, kept, key, fits, items, place, along, down, walledIn, fillPocket, fillWalledIn, openWalledIn, inside, chairs };
}
