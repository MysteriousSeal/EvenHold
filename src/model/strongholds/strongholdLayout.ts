// A bandit stronghold's floor plan, laid out from the seed and where its gate
// stands (the same for everyone on that seed): one great floor, built square
// (an old fort's, not a burrow). From the way in, a gatehouse, then a passage
// to the entry hall, the hub of it all. Off the hall's two sides, four wings
// (two a side, one over the other), each a string of rooms running straight
// out, now and then a small room off one of them (a dead end), and at its far
// end its boss's room: the kennels, the stores and powder, the gaol, the
// barracks and drill yard, each in one of the four places, by the seed. On
// past the hall, a short way with a gate across it (shut till the four wings'
// bosses are slain: strongholdFoes.ts), and behind it the great hall, the
// king's. Not a labyrinth: every room has one way into it, so the wings may
// be taken in any order, and the gate alone shuts the great hall off.
//
// In room tiles, as any room (dungeons/floorPlan.ts): the way up in the +Z
// wall at `door` and `door + 1`. Its places: every room and way, in order.

import { hashCell, mulberry32, shuffle } from '../../util/random';
import type { FloorPlan } from '../dungeons/floorPlan';

export interface Rect {
  x0: number; // first tile, inclusive
  z0: number;
  x1: number; // last tile, inclusive
  z1: number;
}

export type Wing = 'kennels' | 'stores' | 'gaol' | 'barracks';
export const WINGS: readonly Wing[] = ['kennels', 'stores', 'gaol', 'barracks'];
// What a place is: the gatehouse at the way in, the entry hall (the hub), a way between two rooms, a wing's room, a
// small room off one (a dead end), a wing's boss's room, the great hall.
export type StrongholdPlace = 'gatehouse' | 'hub' | 'passage' | 'room' | 'side' | 'boss' | 'great';

export interface StrongholdRoom extends Rect {
  kind: StrongholdPlace;
  wing: Wing | null; // whose wing it's in (null: the gatehouse, the entry hall, the great hall, and the ways between them)
  from: number; // the side it's come into by, from the way in (quarter turns, map/grid.ts FACINGS: 0 +z, 1 +x, 2 -z, 3 -x)
}

export interface StrongholdPlan extends FloorPlan {
  rooms: StrongholdRoom[]; // from the way in: the gatehouse, the way to the hall, the hall, the way to the great hall, the great hall; then each wing's, from the hall out
  gate: Array<{ x: number; z: number }>; // the great hall's gate: the tiles across the way into it
}

const CANVAS: [number, number] = [150, 64]; // tiles across and deep it's laid out on, before cropping
const WIDE = 2; // every way's width (as the way up's)
const GATEHOUSE = { w: 6, d: [4, 5] as [number, number] };
const ENTRY: [number, number] = [6, 7]; // tiles from the gatehouse to the entry hall
const HUB = { half: [7, 8] as [number, number], d: [14, 16] as [number, number] }; // (half its width: the way in at its middle)
const GREAT_WAY = 5; // tiles from the entry hall to the great hall, the gate across its middle
const GREAT = { half: [8, 9] as [number, number], d: [12, 14] as [number, number] };
const BAND = 10; // rows a wing's rooms keep within (its boss's room all of them)
const BAND_OUT = 5; // of them, those past the entry hall's end (the upper wings' past its far end, the lower past its near)
const EXIT_IN = 2; // rows in from the hall's end a wing's way leaves it by
const LINK = 3; // tiles of way between a wing's rooms
const ROOMS: [number, number] = [2, 3]; // a wing's, before its boss's
const ROOM = { w: [7, 10] as [number, number], d: [6, 9] as [number, number] };
const BOSS_W: [number, number] = [11, 13];
const SIDE = { chance: 0.6, w: [5, 6] as [number, number], d: [4, 5] as [number, number], link: 2 };

export function planStronghold(seed: number, gate: { x: number; z: number }): StrongholdPlan {
  const rng = mulberry32(hashCell(gate.x * 37 + 11, gate.z * 43 + 6, seed + 5231));
  const roll = ([lo, hi]: [number, number]) => lo + Math.floor(rng() * (hi - lo + 1));
  const [across, deep] = CANVAS;
  const owner = new Int16Array(across * deep).fill(-1); // which place each tile is
  const rooms: StrongholdRoom[] = [];
  const startZ = deep - 3;
  const cx = Math.floor(across / 2); // the way in's first column (and the middle of the whole)
  const carve = (r: Rect, kind: StrongholdPlace, wing: Wing | null, from: number): StrongholdRoom => {
    for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) owner[x * deep + z] = rooms.length;
    rooms.push({ ...r, kind, wing, from });
    return rooms[rooms.length - 1];
  };
  // Whether `r` (and `margin` tiles round it) is on the canvas, not past the way in's row, and nothing's carved there.
  const free = (r: Rect, margin: number) => {
    if (r.x0 < 2 || r.z0 < 2 || r.x1 > across - 3 || r.z1 > startZ) return false;
    for (let x = r.x0 - margin; x <= r.x1 + margin; x++) for (let z = r.z0 - margin; z <= r.z1 + margin; z++) if (owner[x * deep + z] >= 0) return false;
    return true;
  };

  // The spine: the gatehouse at the way in, the way to the entry hall, the hall, the gated way, the great hall.
  const gatehouse = carve({ x0: cx - GATEHOUSE.w / 2 + 1, x1: cx + GATEHOUSE.w / 2, z0: startZ - roll(GATEHOUSE.d) + 1, z1: startZ }, 'gatehouse', null, 0);
  const entry = carve({ x0: cx, x1: cx + WIDE - 1, z0: gatehouse.z0 - roll(ENTRY), z1: gatehouse.z0 - 1 }, 'passage', null, 0);
  const [hubHalf, hubDeep] = [roll(HUB.half), roll(HUB.d)];
  const hub = carve({ x0: cx - hubHalf + 1, x1: cx + hubHalf, z0: entry.z0 - hubDeep, z1: entry.z0 - 1 }, 'hub', null, 0);
  const way = carve({ x0: cx, x1: cx + WIDE - 1, z0: hub.z0 - GREAT_WAY, z1: hub.z0 - 1 }, 'passage', null, 0);
  const gateZ = way.z0 + Math.floor(GREAT_WAY / 2);
  const [greatHalf, greatDeep] = [roll(GREAT.half), roll(GREAT.d)];
  carve({ x0: cx - greatHalf + 1, x1: cx + greatHalf, z0: way.z0 - greatDeep, z1: way.z0 - 1 }, 'great', null, 0);

  // A small room off `room`, on its outer side (an upper wing's: beyond it, toward -z; a lower's: toward +z), if there's room for it.
  const sideRoom = (room: Rect, wing: Wing, upper: boolean) => {
    const [w, d] = [roll(SIDE.w), roll(SIDE.d)];
    const px = room.x0 + 1 + Math.floor(rng() * (room.x1 - room.x0 - 2));
    const passage = upper ? { x0: px, x1: px + WIDE - 1, z0: room.z0 - SIDE.link, z1: room.z0 - 1 } : { x0: px, x1: px + WIDE - 1, z0: room.z1 + 1, z1: room.z1 + SIDE.link };
    const x0 = px - Math.floor(w / 2) + 1;
    const side = upper ? { x0, x1: x0 + w - 1, z0: passage.z0 - d, z1: passage.z0 - 1 } : { x0, x1: x0 + w - 1, z0: passage.z1 + 1, z1: passage.z1 + d };
    if (!free(side, 1) || !free({ ...passage, x0: passage.x0 - 1, x1: passage.x1 + 1 }, 0)) return; // (both clear before either's carved: no stub left)
    carve(passage, 'passage', wing, upper ? 0 : 2);
    carve(side, 'side', wing, upper ? 0 : 2);
  };

  // The four wings, each in one of the four places off the hall's sides (west and east, upper and lower), by the seed:
  // a way out of the hall, then room after room straight out, each within its band of rows, its boss's room the last.
  const wings = [...WINGS];
  shuffle(wings, rng);
  const places = [{ side: -1, upper: true }, { side: 1, upper: true }, { side: -1, upper: false }, { side: 1, upper: false }];
  places.forEach(({ side, upper }, i) => {
    const wing = wings[i];
    const row = upper ? hub.z0 + EXIT_IN : hub.z1 - EXIT_IN - WIDE + 1; // its way's first row (two wide)
    const [b0, b1] = upper ? [hub.z0 - BAND_OUT, hub.z0 - BAND_OUT + BAND - 1] : [hub.z1 + BAND_OUT - BAND + 1, hub.z1 + BAND_OUT];
    const from = side < 0 ? 1 : 3;
    let edge = side < 0 ? hub.x0 : hub.x1; // the last column carved, going out
    // The next `long` tiles on out from the edge, rows z0..z1, carved; the edge moved on to its far side.
    const out = (long: number, z0: number, z1: number, kind: StrongholdPlace): StrongholdRoom => {
      const made = carve(side < 0 ? { x0: edge - long, x1: edge - 1, z0, z1 } : { x0: edge + 1, x1: edge + long, z0, z1 }, kind, wing, from);
      edge = side < 0 ? made.x0 : made.x1;
      return made;
    };
    const count = roll(ROOMS);
    const withSide = rng() < SIDE.chance ? Math.floor(rng() * count) : -1; // which of them has a small room off it
    for (let n = 0; n < count; n++) {
      out(LINK, row, row + WIDE - 1, 'passage');
      const [w, d] = [roll(ROOM.w), roll(ROOM.d)];
      const z0 = roll([Math.max(b0, row + WIDE + 1 - d), Math.min(row - 1, b1 - d + 1)]); // (its way in off its corners: a row of floor either side of it)
      const room = out(w, z0, z0 + d - 1, 'room');
      if (n === withSide) sideRoom(room, wing, upper);
    }
    out(LINK, row, row + WIDE - 1, 'passage');
    out(roll(BOSS_W), b0, b1, 'boss');
  });

  // Cropped to what was carved, a tile of rock round it but on the way in's side.
  let [x0, z0, x1] = [across, deep, 0];
  for (const r of rooms) [x0, z0, x1] = [Math.min(x0, r.x0), Math.min(z0, r.z0), Math.max(x1, r.x1)];
  [x0, z0, x1] = [x0 - 1, z0 - 1, x1 + 1];
  const [width, depth] = [x1 - x0 + 1, startZ - z0 + 1];
  const floor = new Uint8Array(width * depth);
  for (let x = 0; x < width; x++) for (let z = 0; z < depth; z++) if (owner[(x + x0) * deep + (z + z0)] >= 0) floor[x * depth + z] = 1;
  return {
    width,
    depth,
    door: cx - x0,
    floor,
    rooms: rooms.map((r) => ({ ...r, x0: r.x0 - x0, z0: r.z0 - z0, x1: r.x1 - x0, z1: r.z1 - z0 })),
    gate: Array.from({ length: WIDE }, (_, k) => ({ x: cx + k - x0, z: gateZ - z0 })),
  };
}

// Which of its places (x, z) is in (room tiles: the tile it's on), or null (in the rock).
export function roomAt(plan: StrongholdPlan, x: number, z: number): StrongholdRoom | null {
  const [tx, tz] = [Math.round(x), Math.round(z)];
  return plan.rooms.find((r) => tx >= r.x0 && tx <= r.x1 && tz >= r.z0 && tz <= r.z1) ?? null;
}

// A wing's boss's room, and the great hall.
export const bossRoom = (plan: StrongholdPlan, wing: Wing): StrongholdRoom => plan.rooms.find((r) => r.kind === 'boss' && r.wing === wing)!;
export const greatHall = (plan: StrongholdPlan): StrongholdRoom => plan.rooms.find((r) => r.kind === 'great')!;
// The middle of a place.
export const middleOf = (r: Rect): { x: number; z: number } => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 });
