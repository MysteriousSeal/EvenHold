// A cave's floor plan, dug from the seed and where it opens (the same for
// everyone on that seed): not built but gnawed, no straight wall in it. From
// the mouth a burrow winds down (a short straight throat first, two wide, the
// way up), through a string of chambers, each a lump of overlapping round
// hollows; off some of them, a short side burrow to a den, a dead end; at the
// far end the nest, the great cavern. Burrows wander as they go (bending
// along a slow wave, widening and narrowing), two to three tiles across.
//
// In room tiles, as any room (dungeons/floorPlan.ts): the way up in the +Z
// wall at `door` and `door + 1`. Its places: each chamber, den and the nest
// (their middles and how far round they reach), and the burrows between.

import { hashCell, mulberry32 } from '../../util/random';
import { isFloor, type FloorPlan } from '../dungeons/floorPlan';
import { cellKey, flood } from '../map/grid';

export type CavePlace = 'chamber' | 'den' | 'nest';

export interface Hollow {
  kind: CavePlace;
  x: number; // its middle (room tiles)
  z: number;
  r: number; // how far round it reaches, about
}

export interface CavePlan extends FloorPlan {
  hollows: Hollow[]; // from the mouth on: the chambers in order, the dens, the nest last
  burrows: Array<Array<[number, number]>>; // the ways dug between them, each a line of tile middles (room tiles)
  nestWay: number; // which of them leads into the nest (from the last chamber)
}

const CANVAS = 220; // tiles a side it's dug in, before cropping
const MARGIN = 3; // rock kept round the edge
const THROAT = 5; // tiles of straight way in, two wide, from the mouth
const CHAMBERS: [number, number] = [5, 7]; // on the way to the nest
const CHAMBER_R: [number, number] = [4, 6.5];
const STEP: [number, number] = [13, 19]; // tiles from one hollow's middle to the next
const DENS: [number, number] = [2, 4];
const DEN_R: [number, number] = [2.6, 3.6];
const DEN_STEP: [number, number] = [8, 11];
const NEST_R: [number, number] = [7.5, 9];
const NEST_STEP: [number, number] = [17, 21];
const APART = 4; // tiles of rock kept between hollows, at least
const SWING = 1.25; // radians either side of straight on (away from the mouth) the way may turn

export function planCave(seed: number, mouth: { x: number; z: number }): CavePlan {
  const rng = mulberry32(hashCell(mouth.x * 23 + 9, mouth.z * 29 + 4, seed + 7717));
  const between = ([lo, hi]: [number, number]) => lo + rng() * (hi - lo);
  const canvas = new Uint8Array(CANVAS * CANVAS);
  const dig = (x: number, z: number) => {
    const [tx, tz] = [Math.round(x), Math.round(z)];
    if (tx >= MARGIN && tz >= MARGIN && tx < CANVAS - MARGIN && tz < CANVAS - MARGIN) canvas[tx * CANVAS + tz] = 1;
  };
  // A round hollow of radius r at (x, z), its edge a little ragged.
  const disc = (x: number, z: number, r: number) => {
    for (let dx = -Math.ceil(r) - 1; dx <= Math.ceil(r) + 1; dx++) {
      for (let dz = -Math.ceil(r) - 1; dz <= Math.ceil(r) + 1; dz++) {
        const ragged = r * (0.9 + 0.2 * hashUnit01(Math.round(x + dx), Math.round(z + dz), seed));
        if (dx * dx + dz * dz <= ragged * ragged) dig(x + dx, z + dz);
      }
    }
  };
  // A chamber: a lump of three to six round hollows about (x, z), r across or so.
  const lump = (x: number, z: number, r: number) => {
    disc(x, z, r * 0.8);
    const lobes = 3 + Math.floor(rng() * 4);
    for (let i = 0; i < lobes; i++) {
      const a = rng() * Math.PI * 2;
      const off = r * (0.25 + rng() * 0.35);
      disc(x + Math.cos(a) * off, z + Math.sin(a) * off, r * (0.5 + rng() * 0.35));
    }
  };
  // A burrow from (ax, az) to (bx, bz): wandering along a slow wave, two to three across; its line kept.
  const burrows: CavePlan['burrows'] = [];
  const burrow = (ax: number, az: number, bx: number, bz: number) => {
    const length = Math.hypot(bx - ax, bz - az);
    const [ux, uz] = [(bx - ax) / length, (bz - az) / length];
    const [wave, phase, sway] = [0.25 + rng() * 0.35, rng() * Math.PI * 2, 1 + rng() * 1.6];
    const line: Array<[number, number]> = [];
    for (let s = 0; s <= length; s += 0.5) {
      const off = Math.sin(s * wave + phase) * sway * Math.sin((Math.PI * s) / length); // (straight at either end)
      const [x, z] = [ax + ux * s - uz * off, az + uz * s + ux * off];
      disc(x, z, 1.05 + 0.35 * Math.sin(s * 0.7 + phase * 2) ** 2);
      line.push([Math.round(x), Math.round(z)]);
    }
    burrows.push(line);
  };

  // The way in: the mouth at the canvas's +Z edge, a straight throat two wide.
  const doorX = Math.floor(CANVAS / 2);
  const startZ = CANVAS - MARGIN - 1;
  for (let z = startZ - THROAT; z <= startZ; z++) [dig(doorX, z), dig(doorX + 1, z)];
  const hollows: Hollow[] = [];
  const fits = (x: number, z: number, r: number) =>
    x - r > MARGIN + 2 && z - r > MARGIN + 2 && x + r < CANVAS - MARGIN - 2 && z + r < startZ - THROAT - 2 && hollows.every((h) => Math.hypot(h.x - x, h.z - z) > h.r + r + APART);
  // The next hollow on from (x, z), heading about `toward` (radians, -z is straight on), `step` away, or null if none fits.
  const next = (x: number, z: number, toward: number, step: [number, number], r: number, swing = SWING) => {
    for (let tries = 0; tries < 24; tries++) {
      const a = toward + (rng() * 2 - 1) * swing;
      const d = between(step);
      const [nx, nz] = [x + Math.sin(a) * d, z - Math.cos(a) * d];
      if (fits(nx, nz, r)) return { x: nx, z: nz };
    }
    return null;
  };

  // Down from the throat, chamber after chamber, bending as it goes but never back toward the mouth.
  let [hx, hz, heading] = [doorX + 0.5, startZ - THROAT, 0];
  const count = Math.round(between(CHAMBERS));
  for (let i = 0; i < count; i++) {
    const r = between(CHAMBER_R);
    const at = next(hx, hz, heading, i === 0 ? [9, 12] : STEP, r, i === 0 ? 0.5 : SWING);
    if (!at) break;
    burrow(hx, hz, at.x, at.z);
    lump(at.x, at.z, r);
    hollows.push({ kind: 'chamber', x: at.x, z: at.z, r });
    heading = Math.max(-1.3, Math.min(1.3, Math.atan2(at.x - hx, -(at.z - hz)))); // (on the way it came)
    [hx, hz] = [at.x, at.z];
  }
  // The nest, the great cavern, on past the last.
  const nestR = between(NEST_R);
  const nest = next(hx, hz, heading, NEST_STEP, nestR) ?? next(hx, hz, heading, NEST_STEP, nestR, Math.PI * 0.75) ?? { x: hx, z: hz - nestR - 6 };
  burrow(hx, hz, nest.x, nest.z);
  const nestWay = burrows.length - 1;
  lump(nest.x, nest.z, nestR);
  disc(nest.x, nest.z, nestR * 0.85); // (its floor open: room to fight)
  // Dens off some of the chambers (not the first), dead ends.
  const dens = Math.round(between(DENS));
  const chambers = hollows.slice(1);
  for (let i = 0; i < dens && chambers.length > 0; i++) {
    const from = chambers.splice(Math.floor(rng() * chambers.length), 1)[0];
    const r = between(DEN_R);
    const side = rng() < 0.5 ? -1 : 1;
    const at = next(from.x, from.z, side * (Math.PI / 2), [from.r + DEN_STEP[0], from.r + DEN_STEP[1]], r, 0.7);
    if (!at) continue;
    burrow(from.x, from.z, at.x, at.z);
    lump(at.x, at.z, r);
    hollows.push({ kind: 'den', x: at.x, z: at.z, r });
  }
  hollows.push({ kind: 'nest', x: nest.x, z: nest.z, r: nestR });

  // Cropped to what was dug, a tile of rock round it; the throat at the +Z edge.
  let [x0, z0, x1] = [CANVAS, CANVAS, 0];
  for (let x = 0; x < CANVAS; x++) {
    for (let z = 0; z < CANVAS; z++) {
      if (!canvas[x * CANVAS + z]) continue;
      [x0, z0, x1] = [Math.min(x0, x), Math.min(z0, z), Math.max(x1, x)];
    }
  }
  [x0, z0, x1] = [x0 - 1, z0 - 1, x1 + 1];
  const [width, depth] = [x1 - x0 + 1, startZ - z0 + 1];
  const floor = new Uint8Array(width * depth);
  for (let x = 0; x < width; x++) for (let z = 0; z < depth; z++) floor[x * depth + z] = canvas[(x + x0) * CANVAS + (z + z0)];
  const plan: CavePlan = {
    width,
    depth,
    door: doorX - x0,
    floor,
    hollows: hollows.map((h) => ({ ...h, x: h.x - x0, z: h.z - z0 })),
    burrows: burrows.map((line) => line.map(([x, z]) => [x - x0, z - z0] as [number, number])),
    nestWay,
  };
  keepReachable(plan);
  return plan;
}

// Only what's reached from the way in stays floor (a ragged edge may leave a pocket cut off).
function keepReachable(plan: CavePlan): void {
  const reached = flood([[plan.door, plan.depth - 1]], (x, z) => isFloor(plan, x, z));
  for (let x = 0; x < plan.width; x++) for (let z = 0; z < plan.depth; z++) if (!reached.has(cellKey(x, z))) plan.floor[x * plan.depth + z] = 0;
}

// A ragged edge's roll at a tile (0..1), the same every time.
function hashUnit01(x: number, z: number, seed: number): number {
  return (hashCell(x, z, seed + 7723) % 1000) / 1000;
}
