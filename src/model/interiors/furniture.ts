// What stands in a room, rolled from the same seed as the room itself, so
// it's always the same for everyone on that seed. Each kind of building is
// furnished its own way: a home has a hearth, a bed, a table with chairs, a
// chest, a shelf, barrels and a rug; the inn a bar (bottle shelves, a
// counter, stools, kegs), a hearth corner with a bear rug and armchairs,
// tavern tables with chairs, and things hung on its walls; the smithy a
// forge, an anvil, a trough, a weapon rack and a heap of coal. Big pieces stand against the back (-Z) or
// left (-X) wall; nothing blocks the door or the way in from it.

import { hashCell, mulberry32, shuffle } from '../../util/random';
import type { Entrance, Room } from './interiors';

export type FurnitureKind =
  | 'hearth'
  | 'bed'
  | 'table'
  | 'chair'
  | 'chest'
  | 'shelf'
  | 'barrel'
  | 'rug'
  | 'counter'
  | 'keg'
  | 'forge'
  | 'anvil'
  | 'trough'
  | 'rack'
  | 'coal'
  // The inn's own
  | 'armchair'
  | 'bearRug'
  | 'barStool'
  | 'bottleShelf'
  | 'tavernTable'
  | 'antlers'
  | 'wallShield'
  | 'noticeBoard'
  | 'wallLantern';

export interface Furniture {
  kind: FurnitureKind;
  x: number; // its first floor tile
  z: number;
  w: number; // tiles it covers along x
  d: number; // along z
  wall: 'back' | 'left' | 'none'; // which wall it stands against (and faces away from)
  solid: boolean; // blocks walking (rugs don't)
  facing?: [number, number]; // a chair: the way its seat faces (toward its table), as (dx, dz)
}

const RUGS: FurnitureKind[] = ['rug', 'bearRug'];
// Hung on a wall, above everything on the floor: they take no floor tiles.
const WALL_HUNG: FurnitureKind[] = ['antlers', 'wallShield', 'noticeBoard', 'wallLantern'];

export function furnish(seed: number, entrance: Entrance, room: Room): Furniture[] {
  const rng = mulberry32(hashCell(Math.round(entrance.x * 4), Math.round(entrance.z * 4), seed + 7919));
  const taken = new Set<string>();
  const kept = new Set<string>(); // left free around a piece (a bed's side), for nothing to crowd it
  const key = (x: number, z: number) => `${x},${z}`;
  // Kept clear: the door's column (the way in) and the tiles either side of the doorway.
  const clear = (x: number, z: number) => x === room.door || (z >= room.depth - 1 && Math.abs(x - room.door) <= 1);
  const fits = (x: number, z: number, w: number, d: number, onRug = false) => {
    if (x < 0 || z < 0 || x + w > room.width || z + d > room.depth) return false;
    for (let i = x; i < x + w; i++) for (let k = z; k < z + d; k++) if (clear(i, k) || kept.has(key(i, k)) || (!onRug && taken.has(key(i, k)))) return false;
    return true;
  };
  const items: Furniture[] = [];
  // Places a piece at the first free spot among `spots` (shuffled), marking its tiles taken.
  const place = (kind: FurnitureKind, w: number, d: number, wall: Furniture['wall'], spots: Array<[number, number]>, shuffled = true): Furniture | null => {
    if (shuffled) shuffle(spots, rng);
    const rug = RUGS.includes(kind) || WALL_HUNG.includes(kind);
    for (const [x, z] of spots) {
      if (!fits(x, z, w, d, rug)) continue;
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

  if (entrance.type === 'house') {
    // The bed first, into the back corner if it can, else along the left
    // wall; then the tiles along its open side and at its ends are kept free.
    const bedSpots = down(0).filter(([, z]) => z > 0);
    const bed = place('bed', 1, 2, 'left', [[0, 0]], false) ?? place('bed', 1, 2, 'left', bedSpots);
    if (bed) {
      for (let z = bed.z - 1; z <= bed.z + bed.d; z++) kept.add(key(1, z));
      kept.add(key(0, bed.z - 1));
      kept.add(key(0, bed.z + bed.d));
    }
    place('hearth', 2, 1, 'back', along(0));
    const table = place('table', 1, 1, 'none', inside());
    if (table) {
      chairs(table);
      if (rng() < 0.7) place('rug', 3, 3, 'none', [[table.x - 1, table.z - 1]]);
    }
    place('chest', 1, 1, 'back', along(0));
    if (rng() < 0.7) place('shelf', 1, 1, 'back', along(0));
    for (let n = 1 + Math.floor(rng() * 2); n > 0; n--) place('barrel', 1, 1, 'none', [[room.width - 1, 0], [0, room.depth - 1], [room.width - 1, room.depth - 1], ...along(0)]);
  } else if (entrance.type === 'inn') {
    // The bar, along the left wall: shelves of bottles against it, the
    // counter just in front of them, and stools facing it.
    const barEnd = Math.min(room.depth - 3, 5);
    for (let z = 1; z + 1 <= barEnd; z += 2) place('bottleShelf', 1, 2, 'left', [[0, z]]);
    const counter = place('counter', 1, barEnd + 1, 'left', [[1, 0]]); // from the back wall
    for (let z = counter ? counter.z : barEnd + 1; counter && z < counter.z + counter.d; z++) {
      if (rng() >= 0.75) continue;
      const stool = place('barStool', 1, 1, 'none', [[2, z]]);
      if (stool) stool.facing = [-1, 0]; // toward the bar
    }
    place('keg', 1, 1, 'left', [[0, 0]]); // behind the bar, its tap facing the counter
    place('keg', 1, 1, 'back', [[2, 0]]); // and one beside it
    // The hearth corner: the fire on the back wall, a bear rug before it, two armchairs facing it.
    const hearth = place('hearth', 2, 1, 'back', along(0).filter(([x]) => x >= 5 && x <= room.width - 3));
    if (hearth) {
      // The rug before the fire, and the two armchairs side by side on it,
      // a tile back from the hearth, facing the fire.
      place('bearRug', 2, 2, 'none', [[hearth.x, 1]]);
      for (const x of [hearth.x, hearth.x + 1]) {
        const chair = place('armchair', 1, 1, 'none', [[x, 2]]);
        if (chair) chair.facing = [0, -1];
      }
    }
    // Tavern tables, laid for a meal, with chairs round them, filling the
    // floor (out to the right-hand wall): each three tiles from the next
    // table, two from anything else. Others' chairs don't count: chairs pull
    // up to their own table, so two back to back between tables still leave
    // a walkway.
    const gapTo = (o: Furniture, x: number, z: number) => Math.max(o.x - x, x - (o.x + o.w - 1), o.z - z, z - (o.z + o.d - 1));
    const clearOf = (x: number, z: number, gap: number, pastChairs = false) =>
      items.every((o) => !o.solid || (pastChairs && o.kind === 'chair') || gapTo(o, x, z) >= (o.kind === 'tavernTable' ? gap : Math.min(gap, 2)));
    const floor: Array<[number, number]> = [];
    for (let x = 1; x < room.width; x++) for (let z = 1; z < room.depth - 1; z++) floor.push([x, z]);
    // As many as fit, up to ten; and at least three: if the room's too
    // small, closer (two apart), a little further toward the bar and the hearth.
    const MAX_TABLES = 10;
    let tables = 0;
    for (const pass of [{ gap: 3, x: 4, z: 2, pastChairs: true }, { gap: 2, x: 5, z: 3 }, { gap: 2, x: 4, z: 2, pastChairs: true }]) {
      while (tables < MAX_TABLES && (pass.gap === 3 || tables < 3)) {
        const spots = floor.filter(([x, z]) => x >= pass.x && z >= pass.z && clearOf(x, z, pass.gap, pass.pastChairs));
        const table = place('tavernTable', 1, 1, 'none', spots);
        if (!table) break;
        chairs(table);
        tables++;
      }
    }
    // On the walls: antlers and a shield over the room, lanterns, a notice board by the door.
    place('antlers', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
    place('wallShield', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
    for (let n = 3; n > 0; n--) place('wallLantern', 1, 1, 'back', along(0).filter(([x]) => x >= 3));
    place('wallLantern', 1, 1, 'left', down(0).filter(([, z]) => z > barEnd));
    place('noticeBoard', 1, 1, 'left', [[0, room.depth - 2]]);
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

// Slim pieces against a wall block only the part of their tiles they fill,
// as a span out from the wall (0 at the wall, 1 at the far side of the
// tile); everything else blocks its whole tiles (a touch inset).
const SLIM: Partial<Record<FurnitureKind, [number, number]>> = {
  bottleShelf: [0, 0.42],
  counter: [0.26, 0.74],
  shelf: [0, 0.34],
};

// Seats pulled up to what they face (a chair to its table, a stool to the
// bar) fill only part of their tile: a span across it and a span toward what
// they face (0 at the back of the tile, 1 at the front), as they're drawn.
const PULLED_UP: Partial<Record<FurnitureKind, { across: [number, number]; forward: [number, number] }>> = {
  chair: { across: [0.24, 0.72], forward: [0.48, 0.96] },
  barStool: { across: [0.28, 0.72], forward: [0.56, 1] },
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

// Whether a walker of half-width r at (x, z) bumps into solid furniture.
export function bumpsFurniture(items: readonly Furniture[], x: number, z: number, r: number): boolean {
  const inset = 0.08; // pieces don't quite fill their tiles
  return items.some((f) => {
    if (!f.solid) return false;
    let [x0, x1, z0, z1] = [f.x - 0.5 + inset, f.x + f.w - 0.5 - inset, f.z - 0.5 + inset, f.z + f.d - 0.5 - inset];
    const slim = SLIM[f.kind];
    if (slim && f.wall === 'left') [x0, x1] = [f.x - 0.5 + slim[0], f.x - 0.5 + slim[1]];
    if (slim && f.wall === 'back') [z0, z1] = [f.z - 0.5 + slim[0], f.z - 0.5 + slim[1]];
    const seat = PULLED_UP[f.kind];
    if (seat && f.facing) {
      const [a0, a1, b0, b1] = seatSpan(seat.across, seat.forward, f.facing);
      [x0, x1, z0, z1] = [f.x - 0.5 + a0, f.x - 0.5 + a1, f.z - 0.5 + b0, f.z - 0.5 + b1];
    }
    return x + r > x0 && x - r < x1 && z + r > z0 && z - r < z1;
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

// The seat on a piece of furniture, or null if it's not something to sit on.
export function seatOf(piece: Furniture): Seat | null {
  if (piece.kind === 'bed') {
    const alongZ = piece.wall === 'left';
    const head = (alongZ ? piece.z : piece.x) - 0.5;
    return {
      piece,
      x: alongZ ? piece.x : head + HEAD_TO_FEET,
      z: alongZ ? head + HEAD_TO_FEET : piece.z,
      y: MATTRESS,
      facing: alongZ ? 0 : Math.PI / 2,
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
