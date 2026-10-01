// A crypt's floor plan, rolled from the seed and its ruin (the same for
// everyone on that seed): a long corridor winding away from the stairs
// (onward and to either side, never back), two tiles wide, now and then
// opening into a hall on the way; side rooms off it every segment or two,
// each through a short passage; and at the far end the great burial hall.
// Not a labyrinth: one way on, the side rooms dead ends.
//
// In room tiles, as any room (interiors.ts): floor tiles 0..width-1 along x,
// 0..depth-1 along z; the way in (the stairs up) in the +Z wall at `door`,
// the hero arriving on the floor just inside it.

import { hashCell, mulberry32 } from '../../util/random';

export interface Rect {
  x0: number; // first tile, inclusive
  z0: number;
  x1: number; // last tile, inclusive
  z1: number;
}

export type CryptPlace = 'corridor' | 'hall' | 'side' | 'great';

export interface CryptPlan {
  width: number;
  depth: number;
  door: number; // the column of the stairs up, in the +Z wall
  floor: Uint8Array; // x * depth + z: 1 floor, 0 rock
  places: Array<Rect & { kind: CryptPlace }>; // what was carved, in order from the stairs
}

const CANVAS = 300; // tiles a side it's laid out on, before cropping
const WIDE = 2; // the corridor's width
const SEGMENTS: [number, number] = [14, 18]; // corridor stretches
const STRETCH: [number, number] = [6, 11]; // tiles, each
const HALL: [number, number] = [6, 8]; // a hall on the way: tiles a side
const SIDE_W: [number, number] = [5, 8]; // a side room
const SIDE_D: [number, number] = [5, 7];
const GREAT = { w: [12, 14] as [number, number], d: [10, 12] as [number, number] };
const NORTH = [0, -1] as const;

export function planCrypt(seed: number, ruin: { x: number; z: number }): CryptPlan {
  const rng = mulberry32(hashCell(ruin.x * 31 + 7, ruin.z * 17 + 3, seed + 4241));
  const roll = ([lo, hi]: [number, number]) => lo + Math.floor(rng() * (hi - lo + 1));
  const owner = new Int16Array(CANVAS * CANVAS).fill(-1); // which carved piece each tile is
  const places: CryptPlan['places'] = [];
  const startZ = CANVAS - 4;
  const startX = Math.floor(CANVAS / 2);

  // Whether `r` (and the tile round it) is clear of everything carved before piece `since`, inside the canvas and not past the stairs' row.
  const clear = (r: Rect, since: number) => {
    if (r.x0 < 2 || r.z0 < 2 || r.x1 > CANVAS - 3 || r.z1 > startZ) return false;
    for (let x = r.x0 - 1; x <= r.x1 + 1; x++) for (let z = r.z0 - 1; z <= r.z1 + 1; z++) if (owner[x * CANVAS + z] >= 0 && owner[x * CANVAS + z] < since) return false;
    return true;
  };
  const carve = (r: Rect, kind: CryptPlace) => {
    const id = places.length;
    for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) if (owner[x * CANVAS + z] < 0) owner[x * CANVAS + z] = id;
    places.push({ ...r, kind });
    return id;
  };
  // The rect `length` tiles on from the head (its WIDE x WIDE square at hx, hz) going (dx, dz).
  const ahead = (hx: number, hz: number, [dx, dz]: readonly [number, number], length: number): Rect => {
    const [ex, ez] = [hx + dx * length, hz + dz * length];
    return { x0: Math.min(hx, ex), z0: Math.min(hz, ez), x1: Math.max(hx, ex) + WIDE - 1, z1: Math.max(hz, ez) + WIDE - 1 };
  };

  let [hx, hz] = [startX, startZ - WIDE + 1]; // the head: the corridor's last WIDE x WIDE square
  let dir: readonly [number, number] = NORTH;
  let head = carve({ x0: hx, z0: hz, x1: hx + WIDE - 1, z1: startZ }, 'corridor'); // the landing at the foot of the stairs (the piece the corridor goes on from)
  const segments = roll(SEGMENTS);
  let sinceSide = 0;
  const marks: Array<{ hx: number; hz: number; dir: readonly [number, number]; head: number; carved: number }> = []; // where each stretch began (to go back to)
  // Back to where the last stretch began, all carved since undone.
  const backUp = () => {
    const back = marks.pop()!;
    for (let i = 0; i < owner.length; i++) if (owner[i] >= back.carved) owner[i] = -1;
    places.length = back.carved;
    ({ hx, hz, dir, head } = back);
  };
  let retries = 20; // stretches undone and tried another way, when the corridor runs into a dead end
  for (let s = 0; s < segments; s++) {
    marks.push({ hx, hz, dir, head, carved: places.length });
    // Onward or to a side (never back), the first that fits, a straight run favoured.
    const sides: Array<readonly [number, number]> = dir[0] === 0 ? [[1, 0], [-1, 0]] : [NORTH];
    const turns = rng() < 0.45 ? [dir, ...sides] : [...sides, dir];
    if (rng() < 0.5) turns.reverse();
    const length = roll(STRETCH);
    const turn = turns.find((d) => clear(ahead(hx, hz, d, length), head));
    if (!turn) {
      marks.pop(); // (this one: nothing carved)
      if (retries-- <= 0 || marks.length < 2) break;
      backUp();
      s -= 2; // (that stretch to be laid again, another way)
      continue;
    }
    dir = turn;
    const run = ahead(hx, hz, dir, length);
    const id = (head = carve(run, 'corridor'));
    [hx, hz] = [hx + dir[0] * length, hz + dir[1] * length];
    // Now and then a hall on the way: a wider stretch the corridor goes on from.
    if (rng() < 0.25) {
      const size = roll(HALL);
      const hall = roomAhead(hx, hz, dir, size, size);
      if (clear(hall, id)) {
        head = carve(hall, 'hall');
        [hx, hz] = [hx + dir[0] * size, hz + dir[1] * size]; // on out of its far side
      }
    }
    // A side room off this stretch, every segment or two: a short passage, then the room.
    if (++sinceSide >= 2 || rng() < 0.4) {
      const room = sideRoom(run, dir, rng, roll);
      if (room && clear(room.passage, id) && clear(room.room, id)) {
        carve(room.passage, 'corridor');
        carve(room.room, 'side');
        sinceSide = 0;
      }
    }
  }
  // At the far end, the great burial hall, centred on the corridor: straight on, else to either side, smaller
  // if need be; if there's no room for it at all (the corridor's run into a corner), back a stretch and try again.
  const [gw, gd] = [roll(GREAT.w), roll(GREAT.d)];
  const greatHall = () => {
    const onward: Array<readonly [number, number]> = [dir, ...(dir[0] === 0 ? ([[1, 0], [-1, 0]] as const) : [NORTH])];
    for (const [w, d] of [[gw, gd], [gw - 3, gd - 3], [8, 7], [6, 6]]) {
      for (const way of onward) {
        const great = roomAhead(hx, hz, way, w, d);
        if (clear(great, head)) return void carve(great, 'great');
      }
    }
    return false;
  };
  while (greatHall() === false && marks.length > 1) backUp();
  return crop(owner, places, startX);
}

// A room `w` across and `d` deep (as seen going `dir`) opening off the head (its WIDE x WIDE square at hx, hz), centred on it.
function roomAhead(hx: number, hz: number, [dx, dz]: readonly [number, number], w: number, d: number): Rect {
  if (dx === 0) {
    const x0 = hx - Math.floor(w / 2) + 1;
    return dz < 0 ? { x0, z0: hz - d, x1: x0 + w - 1, z1: hz - 1 } : { x0, z0: hz + WIDE, x1: x0 + w - 1, z1: hz + WIDE + d - 1 };
  }
  const z0 = hz - Math.floor(w / 2) + 1;
  return dx > 0 ? { x0: hx + WIDE, z0, x1: hx + WIDE + d - 1, z1: z0 + w - 1 } : { x0: hx - d, z0, x1: hx - 1, z1: z0 + w - 1 };
}

// A side room beside `run` (a stretch going `dir`): a passage out of its side, then the room, both sideways off it.
function sideRoom(run: Rect, dir: readonly [number, number], rng: () => number, roll: (r: [number, number]) => number): { passage: Rect; room: Rect } | null {
  const [w, d] = [roll(SIDE_W), roll(SIDE_D)];
  const left = rng() < 0.5;
  const reach = 1 + Math.floor(rng() * 2); // the passage's length
  if (dir[0] === 0) {
    // Going north: a room to the east or west.
    if (run.z1 - run.z0 < 3) return null;
    const z = run.z0 + 1 + Math.floor(rng() * (run.z1 - run.z0 - 2));
    const passage = left ? { x0: run.x0 - reach, z0: z, x1: run.x0 - 1, z1: z + 1 } : { x0: run.x1 + 1, z0: z, x1: run.x1 + reach, z1: z + 1 };
    const z0 = z - Math.floor(d / 2) + 1;
    const room = left ? { x0: passage.x0 - w, z0, x1: passage.x0 - 1, z1: z0 + d - 1 } : { x0: passage.x1 + 1, z0, x1: passage.x1 + w, z1: z0 + d - 1 };
    return { passage, room };
  }
  // Going east or west: a room to the north (or south).
  if (run.x1 - run.x0 < 3) return null;
  const x = run.x0 + 1 + Math.floor(rng() * (run.x1 - run.x0 - 2));
  const passage = left ? { x0: x, z0: run.z0 - reach, x1: x + 1, z1: run.z0 - 1 } : { x0: x, z0: run.z1 + 1, x1: x + 1, z1: run.z1 + reach };
  const x0 = x - Math.floor(w / 2) + 1;
  const room = left ? { x0, z0: passage.z0 - d, x1: x0 + w - 1, z1: passage.z0 - 1 } : { x0, z0: passage.z1 + 1, x1: x0 + w - 1, z1: passage.z1 + d };
  return { passage, room };
}

// The carved tiles, cropped to them with a tile of rock all round but on the stairs' side.
function crop(owner: Int16Array, places: CryptPlan['places'], startX: number): CryptPlan {
  let [x0, z0, x1, z1] = [CANVAS, CANVAS, 0, 0];
  for (const p of places) [x0, z0, x1, z1] = [Math.min(x0, p.x0), Math.min(z0, p.z0), Math.max(x1, p.x1), Math.max(z1, p.z1)];
  [x0, z0, x1] = [x0 - 1, z0 - 1, x1 + 1];
  const [width, depth] = [x1 - x0 + 1, z1 - z0 + 1];
  const floor = new Uint8Array(width * depth);
  for (let x = 0; x < width; x++) for (let z = 0; z < depth; z++) if (owner[(x + x0) * CANVAS + (z + z0)] >= 0) floor[x * depth + z] = 1;
  openIslands(floor, width, depth);
  return {
    width,
    depth,
    door: startX - x0,
    floor,
    places: places.map((p) => ({ ...p, x0: p.x0 - x0, z0: p.z0 - z0, x1: p.x1 - x0, z1: p.z1 - z0 })),
  };
}

// Rock not joined to the rock round the crypt (an island of it, left standing where the corridor and a
// hall met round it) made floor: no block of rock stands alone in the middle of a room.
function openIslands(floor: Uint8Array, width: number, depth: number): void {
  const seen = new Uint8Array(width * depth);
  const todo: number[] = [];
  for (let x = 0; x < width; x++) for (let z = 0; z < depth; z++) {
    const edge = x === 0 || z === 0 || x === width - 1 || z === depth - 1;
    if (!edge || floor[x * depth + z]) continue;
    seen[x * depth + z] = 1;
    todo.push(x * depth + z);
  }
  while (todo.length > 0) {
    const cell = todo.pop()!;
    const [x, z] = [Math.floor(cell / depth), cell % depth];
    for (const [nx, nz] of [[x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]]) {
      if (nx < 0 || nz < 0 || nx >= width || nz >= depth) continue;
      const next = nx * depth + nz;
      if (floor[next] || seen[next]) continue;
      seen[next] = 1;
      todo.push(next);
    }
  }
  for (let i = 0; i < floor.length; i++) if (!floor[i] && !seen[i]) floor[i] = 1;
}

// Whether (x, z) (a tile) is floor.
export const isFloor = (plan: CryptPlan, x: number, z: number): boolean => x >= 0 && z >= 0 && x < plan.width && z < plan.depth && plan.floor[x * plan.depth + z] === 1;

// Whether the rock at (x, z) is always in full view: no floor behind it (toward -x or -z, the way
// the camera looks), so it never stands between the camera and anyone. The rest fades when the hero's
// behind it (the view's). What hangs on the rock (sconces, niches, cobwebs) goes only where it's in full view.
export const inFullView = (plan: CryptPlan, x: number, z: number): boolean =>
  !isFloor(plan, x, z) && !isFloor(plan, x - 1, z) && !isFloor(plan, x, z - 1) && !isFloor(plan, x - 1, z - 1);
