// What's in a cave (its plan: caveLayout.ts), from the seed, the same every
// time: stalagmites rising in its chambers (solid, never on the way dug
// through, so no way's ever cut); glowing caps of fungus along its walls (its
// light: more of it the deeper in); a still pool now and then; roots hanging
// near the mouth; bones in the dens and the nest; old webs in the nooks
// (thicker deeper in); a crystal here and there far in (solid, glowing); in
// the nest, its silk mat at the heart and egg sacs round its edge (solid: the
// brood mother calls her young from them); and in the nest's far wall, the
// crack that opens to the daylight once she's slain (its way out).

import { hashCell, mulberry32 } from '../../util/random';
import { cellKey } from '../map/grid';
import { isFloor } from '../dungeons/floorPlan';
import type { CavePlan, Hollow } from './caveLayout';

export type CavePropKind = 'stalagmite' | 'glowcap' | 'pool' | 'roots' | 'bones' | 'web' | 'crystal' | 'eggSac' | 'silk';

export interface CaveProp {
  kind: CavePropKind;
  x: number; // its tile (room tiles)
  z: number;
  variant: number; // 0..3: its look
  solid: boolean;
}

export const CAVE_LIGHTS: ReadonlySet<CavePropKind> = new Set(['glowcap', 'crystal']); // what gives light
const SOLID: ReadonlySet<CavePropKind> = new Set(['stalagmite', 'crystal', 'eggSac']);

export function furnishCave(seed: number, mouth: { x: number; z: number }, plan: CavePlan): CaveProp[] {
  const rng = mulberry32(hashCell(mouth.x * 41 + 3, mouth.z * 19 + 8, seed + 8831));
  const props: CaveProp[] = [];
  const taken = new Set<string>();
  const onWay = new Set<string>(); // the dug ways' middles and a tile round them: kept clear
  for (const line of plan.burrows) for (const [x, z] of line) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) onWay.add(cellKey(x + dx, z + dz));
  for (let x = plan.door - 2; x <= plan.door + 3; x++) for (let z = plan.depth - 8; z < plan.depth; z++) onWay.add(cellKey(x, z)); // (the way up)
  const nest = plan.hollows.find((h) => h.kind === 'nest')!;
  const deep = (z: number) => 1 - z / Math.max(1, plan.depth - 1); // 0 at the mouth, 1 at the far end
  const walls = (x: number, z: number) => [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]].filter(([dx, dz]) => !isFloor(plan, x + dx, z + dz)).length;
  const free = (x: number, z: number) => isFloor(plan, x, z) && !taken.has(cellKey(x, z));
  const put = (kind: CavePropKind, x: number, z: number) => {
    taken.add(cellKey(x, z));
    props.push({ kind, x, z, variant: Math.floor(rng() * 4), solid: SOLID.has(kind) });
  };
  const tilesOf = (h: Hollow) => {
    const out: Array<[number, number]> = [];
    for (let x = Math.floor(h.x - h.r - 1); x <= Math.ceil(h.x + h.r + 1); x++) for (let z = Math.floor(h.z - h.r - 1); z <= Math.ceil(h.z + h.r + 1); z++) if (isFloor(plan, x, z)) out.push([x, z]);
    return out;
  };
  const shuffled = <T>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  // The nest: its silk mat at the heart, egg sacs round its edge (by the rock), bones strewn.
  const [nx, nz] = [Math.round(nest.x), Math.round(nest.z)];
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (free(nx + dx, nz + dz)) put('silk', nx + dx, nz + dz);
  const edge = shuffled(tilesOf(nest).filter(([x, z]) => walls(x, z) >= 2 && !onWay.has(cellKey(x, z))));
  for (const [x, z] of edge.slice(0, 5 + Math.floor(rng() * 3))) if (free(x, z)) put('eggSac', x, z);
  for (const [x, z] of shuffled(tilesOf(nest)).slice(0, 6)) if (free(x, z) && Math.hypot(x - nx, z - nz) > 2) put('bones', x, z);

  // The chambers and dens: stalagmites (clear of the ways), a pool now and then, bones in the dens.
  for (const h of plan.hollows) {
    if (h.kind === 'nest') continue;
    const tiles = shuffled(tilesOf(h));
    const open = (x: number, z: number) => free(x, z) && walls(x, z) === 0 && !onWay.has(cellKey(x, z)) && Math.hypot(x - h.x, z - h.z) > 1.5;
    let rising = h.kind === 'den' ? 1 : 1 + Math.floor(rng() * 3);
    for (const [x, z] of tiles) if (rising > 0 && open(x, z)) [put('stalagmite', x, z), rising--];
    if (h.kind === 'chamber' && rng() < 0.45) {
      const spot = tiles.find(([x, z]) => open(x, z));
      if (spot) put('pool', spot[0], spot[1]);
    }
    if (h.kind === 'den') for (const [x, z] of tiles.slice(0, 3)) if (free(x, z)) put('bones', x, z);
    if (deep(h.z) > 0.55 && rng() < 0.35) {
      const nook = tiles.find(([x, z]) => free(x, z) && walls(x, z) >= 3 && !onWay.has(cellKey(x, z)));
      if (nook) put('crystal', nook[0], nook[1]);
    }
  }

  // Along the walls: glowcaps (more of them deeper in), roots near the mouth, webs in the nooks (more deeper in).
  for (let x = 0; x < plan.width; x++) {
    for (let z = 0; z < plan.depth; z++) {
      if (!free(x, z) || walls(x, z) === 0) continue;
      const roll = hashCell(x, z, seed + 8837) % 1000 / 1000;
      const d = deep(z);
      if (roll < 0.035 + 0.05 * d) put('glowcap', x, z);
      else if (roll > 0.94 && d < 0.35) put('roots', x, z);
      else if (roll > 0.9 - 0.12 * d && walls(x, z) >= 4) put('web', x, z);
    }
  }
  return unsealed(plan, props);
}

// The props with none left sealing open floor off from the way in (an egg sac or a crystal across a nook's mouth):
// any solid one beside floor that can't be reached, taken away, till all of it can.
function unsealed(plan: CavePlan, props: CaveProp[]): CaveProp[] {
  for (;;) {
    const solid = solidTiles(props);
    const reached = new Set<string>();
    const stack: Array<[number, number]> = [[plan.door, plan.depth - 1]];
    while (stack.length) {
      const [x, z] = stack.pop()!;
      const key = cellKey(x, z);
      if (reached.has(key) || !isFloor(plan, x, z) || solid.has(key)) continue;
      reached.add(key);
      stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }
    const sealing = props.filter((p) => p.solid && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isFloor(plan, p.x + dx, p.z + dz) && !solid.has(cellKey(p.x + dx, p.z + dz)) && !reached.has(cellKey(p.x + dx, p.z + dz))));
    if (sealing.length === 0) return props;
    props = props.filter((p) => !sealing.includes(p));
  }
}

// Where the nest's crack to the daylight is (its way out, opened once the brood mother's slain): the rock tile at
// the nest's far side (toward -z, away from the mouth), and the floor before it, where the hero stands for it.
export function caveExit(plan: CavePlan): { rock: { x: number; z: number }; spot: { x: number; z: number } } {
  const nest = plan.hollows.find((h) => h.kind === 'nest')!;
  let best: { x: number; z: number } | null = null;
  for (let x = Math.floor(nest.x - nest.r - 1); x <= Math.ceil(nest.x + nest.r + 1); x++) {
    for (let z = Math.floor(nest.z - nest.r - 1); z <= Math.ceil(nest.z + nest.r + 1); z++) {
      if (!isFloor(plan, x, z) || isFloor(plan, x, z - 1)) continue; // (floor with rock just behind it)
      if (!best || z < best.z || (z === best.z && Math.abs(x - nest.x) < Math.abs(best.x - nest.x))) best = { x, z };
    }
  }
  const spot = best ?? { x: Math.round(nest.x), z: Math.round(nest.z) };
  return { rock: { x: spot.x, z: spot.z - 1 }, spot };
}

// The silk walling the nest off (till most of the cave's cleared: caveFoes.ts): a cut across the burrow into it,
// tiles across its way at some point along it, such that with them shut the nest can't be reached from the way in.
// Tried from the burrow's middle outward (as far from the nest's lobes as from the last chamber's), a straight one first
// (a row or column of floor, rock to rock); if none will do
// (another way into the nest), a ring round it; null if not even that (then it's never walled).
export function nestSeal(plan: CavePlan): Array<{ x: number; z: number }> | null {
  const line = plan.burrows[plan.nestWay];
  const nest = plan.hollows.find((h) => h.kind === 'nest')!;
  const middle = Math.floor(line.length / 2);
  const order = Array.from({ length: line.length }, (_, k) => middle + (k % 2 ? 1 : -1) * Math.ceil(k / 2)).filter((i) => i > 2 && i < line.length - 3);
  // First a straight one: a row (or column) of floor right across the burrow, rock to rock (a web strung straight across
  // it, its ends in the rock), the shorter of the two at each point along it.
  for (const i of order) {
    const [px, pz] = line[i];
    const straight = [[1, 0], [0, 1]].map(([sx, sz]) => {
      const cut: Array<{ x: number; z: number }> = [];
      for (const dir of [1, -1]) for (let k = dir === 1 ? 0 : 1; k < 12 && isFloor(plan, px + sx * k * dir, pz + sz * k * dir); k++) cut.push({ x: px + sx * k * dir, z: pz + sz * k * dir });
      return cut;
    }).filter((cut) => cut.length > 0 && cut.length <= 9).sort((a, b) => a.length - b.length);
    for (const cut of straight) if (!reaches(plan, new Set(cut.map((t) => cellKey(t.x, t.z))), Math.round(nest.x), Math.round(nest.z))) return cut;
  }
  // Else one across its way, however it runs.
  for (const i of order) {
    const [[ax, az], [bx, bz]] = [line[i - 2], line[i + 2]];
    const long = Math.hypot(bx - ax, bz - az) || 1;
    const [dx, dz] = [(bx - ax) / long, (bz - az) / long];
    const cut = new Map<string, { x: number; z: number }>();
    for (let across = -5; across <= 5; across += 0.5) for (const along of [0, 0.5]) {
      const [x, z] = [Math.round(line[i][0] - dz * across + dx * along), Math.round(line[i][1] + dx * across + dz * along)];
      if (isFloor(plan, x, z)) cut.set(cellKey(x, z), { x, z });
    }
    if (cut.size === 0 || cut.size > 20) continue;
    if (!reaches(plan, new Set(cut.keys()), Math.round(nest.x), Math.round(nest.z))) return [...cut.values()];
  }
  // Another way in too (a den's burrow run into it): a ring round the nest instead, across every way into it.
  for (let r = nest.r * 1.6; r >= nest.r; r -= 0.5) {
    const ring = new Map<string, { x: number; z: number }>();
    for (let x = Math.floor(nest.x - r - 2); x <= nest.x + r + 2; x++) for (let z = Math.floor(nest.z - r - 2); z <= nest.z + r + 2; z++) {
      const d = Math.hypot(x - nest.x, z - nest.z);
      if (d >= r && d < r + 1.5 && isFloor(plan, x, z)) ring.set(cellKey(x, z), { x, z });
    }
    if (ring.size <= 40 && !reaches(plan, new Set(ring.keys()), Math.round(nest.x), Math.round(nest.z))) return [...ring.values()];
  }
  return null;
}

// Whether (tx, tz) is reached from the way in, round the `shut` tiles.
export function reaches(plan: CavePlan, shut: ReadonlySet<string>, tx: number, tz: number): boolean {
  return reachedFrom(plan, shut).has(cellKey(tx, tz));
}

// The floor reached from the way in, round the `shut` tiles.
export function reachedFrom(plan: CavePlan, shut: ReadonlySet<string>): Set<string> {
  const seen = new Set<string>();
  const stack: Array<[number, number]> = [[plan.door, plan.depth - 1]];
  while (stack.length) {
    const [x, z] = stack.pop()!;
    const key = cellKey(x, z);
    if (seen.has(key) || !isFloor(plan, x, z) || shut.has(key)) continue;
    seen.add(key);
    stack.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return seen;
}

// The tiles something solid stands on, as "x,z".
export const solidTiles = (props: readonly CaveProp[]): Set<string> => new Set(props.filter((p) => p.solid).map((p) => cellKey(p.x, p.z)));
