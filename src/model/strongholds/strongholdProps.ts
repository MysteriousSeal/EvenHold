// What's in a bandit stronghold (its plan: strongholdLayout.ts), from the
// seed, the same every time, each place furnished for what it is:
// - the gatehouse: a rack, a barrel or two by its walls;
// - the entry hall: a brazier in each corner, banners either side of the
//   gated way, barricades thrown up facing the way in, tables and benches;
// - the kennels: kennels and cages along the walls, cages out on the floor;
// - the stores: crates, barrels and kegs (the powder) stacked by the walls
//   and out on the floor, a barricade of them;
// - the gaol: cages along the walls, stocks out on the floor;
// - the barracks: racks and bedrolls by the walls, tents and tables; its
//   boss's room the drill yard, dummies set up in it;
// - the great hall: the throne at its far end, banners behind it, braziers,
//   long tables and benches down either side of the way up to it;
// - across the way into the great hall, its gate (shut or open: its run's
//   to say, strongholdFoes.ts; strongholds.ts blocks the way while it's shut).
// The ways between the rooms, the floor before them and the middle of each
// boss's room are kept clear; nothing solid is ever left sealing floor off
// (checked, and taken out if it does). The king's chest isn't one of them:
// it's his run's, once he's slain, set down at chestSpot.

import { hashCell, mulberry32, oneOf, shuffle } from '../../util/random';
import { cellKey, flood } from '../map/grid';
import { isFloor } from '../dungeons/floorPlan';
import { greatHall, type Rect, type StrongholdPlan, type StrongholdRoom, type Wing } from './strongholdLayout';

export type StrongholdPropKind = 'barricade' | 'tent' | 'bedroll' | 'rack' | 'crate' | 'barrel' | 'keg' | 'cage' | 'kennel' | 'brazier' | 'banner' | 'table' | 'bench' | 'throne' | 'dummy' | 'stocks' | 'gate' | 'chest';

export interface StrongholdProp {
  kind: StrongholdPropKind;
  x: number; // its first tile (room tiles)
  z: number;
  w: number; // tiles across x, as it's turned
  d: number; // along z
  facing: number; // quarter turns: which way it faces (0 +z, 1 +x, 2 -z, 3 -x); one by a wall, the floor it looks out on
  solid: boolean;
  variant: number; // 0..3: its look (a gate's, a chest's: 0 shut, 1 open: the view's to say which)
}

// How many tiles each takes, across and deep, facing +z (turned a quarter, the other way about).
export const PROP_SIZE: Record<StrongholdPropKind, readonly [number, number]> = {
  barricade: [2, 1], tent: [2, 2], bedroll: [1, 1], rack: [1, 1], crate: [1, 1], barrel: [1, 1], keg: [1, 1], cage: [1, 1], kennel: [1, 1], brazier: [1, 1],
  banner: [1, 1], table: [2, 1], bench: [2, 1], throne: [2, 2], dummy: [1, 1], stocks: [1, 1], gate: [2, 1], chest: [1, 1],
};
export const STRONGHOLD_LIGHTS: ReadonlySet<StrongholdPropKind> = new Set(['brazier']); // what gives light
// What can't be walked through (a bedroll's stepped over, a banner hangs by the wall; the gate is its run's to shut).
const SOLID: ReadonlySet<StrongholdPropKind> = new Set(['barricade', 'tent', 'rack', 'crate', 'barrel', 'keg', 'cage', 'kennel', 'brazier', 'table', 'bench', 'throne', 'dummy', 'stocks']);

// What stands by a wing's rooms' walls, out on their floors, and out on its boss's room's floor.
const BY_WALL: Record<Wing, StrongholdPropKind[]> = {
  kennels: ['kennel', 'kennel', 'kennel', 'cage', 'barrel'],
  stores: ['crate', 'crate', 'barrel', 'barrel', 'keg', 'rack'],
  gaol: ['cage', 'cage', 'cage', 'bench', 'rack'],
  barracks: ['rack', 'bedroll', 'bedroll', 'crate', 'bench'],
};
const ON_FLOOR: Record<Wing, StrongholdPropKind[]> = {
  kennels: ['cage', 'brazier', 'crate'],
  stores: ['crate', 'keg', 'barricade', 'barrel'],
  gaol: ['stocks', 'stocks', 'brazier'],
  barracks: ['tent', 'table', 'bedroll', 'bedroll'],
};
const BOSS_FLOOR: Record<Wing, StrongholdPropKind[]> = {
  kennels: ['cage', 'cage', 'brazier', 'brazier'],
  stores: ['keg', 'keg', 'crate', 'table', 'brazier'],
  gaol: ['stocks', 'stocks', 'cage', 'brazier', 'brazier'],
  barracks: ['dummy', 'dummy', 'dummy', 'dummy', 'brazier', 'brazier'],
};

// Where the king stands before his throne, and where his chest is set down once he's slain (between him and it).
export const kingSpot = (plan: StrongholdPlan): { x: number; z: number } => ({ x: plan.door + 0.5, z: greatHall(plan).z0 + 4 });
export const chestSpot = (plan: StrongholdPlan): { x: number; z: number } => ({ x: plan.door + 0.5, z: greatHall(plan).z0 + 2.5 });

// The postern in the great hall's far wall (its way out, opened once the king's slain): the rock tile it's in, and
// the floor before it, where the hero stands for it.
export function strongholdExit(plan: StrongholdPlan): { rock: { x: number; z: number }; spot: { x: number; z: number } } {
  const great = greatHall(plan);
  return { rock: { x: great.x1 - 2, z: great.z0 - 1 }, spot: { x: great.x1 - 2, z: great.z0 } };
}

export function furnishStronghold(seed: number, gate: { x: number; z: number }, plan: StrongholdPlan): StrongholdProp[] {
  const rng = mulberry32(hashCell(gate.x * 47 + 2, gate.z * 53 + 9, seed + 5417));
  const roll = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
  const props: StrongholdProp[] = [];
  const taken = new Set<string>(); // floor tiles something stands on
  const clear = new Set<string>(); // floor kept clear of what's solid: the ways, the floor before them, where a boss stands
  const keep = (r: Rect, grown = 0) => {
    for (let x = r.x0 - grown; x <= r.x1 + grown; x++) for (let z = r.z0 - grown; z <= r.z1 + grown; z++) clear.add(cellKey(x, z));
  };
  const great = greatHall(plan);
  const mid = plan.door; // the way in's first column: the middle of the gatehouse, the entry hall and the great hall
  for (const r of plan.rooms) {
    if (r.kind === 'passage') keep(r, 2);
    if (r.kind === 'gatehouse' || r.kind === 'hub' || r.kind === 'great') keep({ x0: mid - 1, x1: mid + 2, z0: r.z0, z1: r.z1 }); // (the way straight up the middle)
    if (r.kind === 'boss') keep({ x0: Math.floor((r.x0 + r.x1) / 2) - 1, x1: Math.floor((r.x0 + r.x1) / 2) + 2, z0: Math.floor((r.z0 + r.z1) / 2) - 1, z1: Math.floor((r.z0 + r.z1) / 2) + 2 });
  }
  const exit = strongholdExit(plan).spot;
  keep({ x0: exit.x, x1: exit.x, z0: exit.z, z1: exit.z }, 1);

  // `kind` set down with its first tile at (x, z), turned to `facing`, if all it'd stand on is free floor (and, solid,
  // not floor kept clear; `anywhere`: even so: the throne); whether it was.
  const put = (kind: StrongholdPropKind, x: number, z: number, facing = 0, anywhere = false) => {
    const [w, d] = facing % 2 ? [PROP_SIZE[kind][1], PROP_SIZE[kind][0]] : PROP_SIZE[kind];
    const solid = SOLID.has(kind);
    for (let a = x; a < x + w; a++) for (let b = z; b < z + d; b++) if (!isFloor(plan, a, b) || taken.has(cellKey(a, b)) || (solid && !anywhere && clear.has(cellKey(a, b)))) return false;
    for (let a = x; a < x + w; a++) for (let b = z; b < z + d; b++) taken.add(cellKey(a, b));
    props.push({ kind, x, z, w, d, facing, solid, variant: Math.floor(rng() * 4) });
    return true;
  };
  // A room's tiles by its walls, each with the way something there faces (out over the floor); and those out on its
  // floor (two tiles in from every wall), in an order from the seed.
  const byWall = (r: Rect) => {
    const tiles: Array<{ x: number; z: number; facing: number }> = [];
    for (let x = r.x0; x <= r.x1; x++) tiles.push({ x, z: r.z0, facing: 0 }, { x, z: r.z1, facing: 2 });
    for (let z = r.z0 + 1; z < r.z1; z++) tiles.push({ x: r.x0, z, facing: 1 }, { x: r.x1, z, facing: 3 });
    shuffle(tiles, rng);
    return tiles;
  };
  const onFloor = (r: Rect) => {
    const tiles: Array<{ x: number; z: number; facing: number }> = [];
    for (let x = r.x0 + 2; x <= r.x1 - 2; x++) for (let z = r.z0 + 2; z <= r.z1 - 2; z++) tiles.push({ x, z, facing: Math.floor(rng() * 4) });
    shuffle(tiles, rng);
    return tiles;
  };
  // Each of `kinds` set down on the first of `tiles` that'll take it; out on the floor, never right beside another thing.
  const alone = (x: number, z: number, kind: StrongholdPropKind, facing: number) => {
    const [w, d] = facing % 2 ? [PROP_SIZE[kind][1], PROP_SIZE[kind][0]] : PROP_SIZE[kind];
    for (let a = x - 1; a <= x + w; a++) for (let b = z - 1; b <= z + d; b++) if (taken.has(cellKey(a, b))) return false;
    return true;
  };
  const strew = (kinds: readonly StrongholdPropKind[], tiles: Array<{ x: number; z: number; facing: number }>, apart: boolean) => {
    for (const kind of kinds) {
      const at = tiles.findIndex((t) => (!apart || alone(t.x, t.z, kind, t.facing)) && put(kind, t.x, t.z, t.facing));
      if (at >= 0) tiles.splice(at, 1);
    }
  };
  const some = (from: readonly StrongholdPropKind[], count: number) => Array.from({ length: count }, () => oneOf(from, rng()));
  const corners = (r: Rect, inset: number): Array<[number, number]> => [[r.x0 + inset, r.z0 + inset], [r.x1 - inset, r.z0 + inset], [r.x0 + inset, r.z1 - inset], [r.x1 - inset, r.z1 - inset]];

  // The great hall first (its throne before anything else claims its floor), then the rest in order from the way in.
  put('throne', mid, great.z0, 0, true);
  for (const x of [mid - 2, mid + 3, mid - 4, mid + 5]) put('banner', x, great.z0, 0);
  for (const [x, z] of corners(great, 2)) put('brazier', x, z);
  for (const x of [mid - 4, mid + 5]) {
    for (let z = great.z0 + 5; z + 1 <= great.z1 - 2; z += 3) if (put('table', x, z, 1)) [put('bench', x - 1, z, 1), put('bench', x + 1, z, 3)];
  }
  strew(['keg', 'keg', 'barrel', 'rack'], byWall(great), false);

  for (const r of plan.rooms) {
    if (r.kind === 'gatehouse') strew(['rack', 'barrel', ...some(['crate', 'barrel'], roll(0, 1))], byWall(r), false);
    else if (r.kind === 'hub') furnishHub(r);
    else if (r.kind === 'room') {
      strew(some(BY_WALL[r.wing!], roll(4, 7)), byWall(r), false);
      strew(some(ON_FLOOR[r.wing!], roll(1, 3)), onFloor(r), true);
    } else if (r.kind === 'side') strew(some(BY_WALL[r.wing!], roll(3, 4)), byWall(r), false);
    else if (r.kind === 'boss') {
      const far = r.from === 1 ? r.x0 : r.x1; // its far wall, from its way in
      for (const z of [r.z0 + 2, r.z1 - 2]) put('banner', far, z, r.from);
      strew(some(BY_WALL[r.wing!], roll(6, 8)), byWall(r), false);
      strew(BOSS_FLOOR[r.wing!], onFloor(r), true);
    }
  }

  // The entry hall: a brazier in each corner, banners either side of the gated way, barricades facing the way in,
  // a table and its benches either side, and what's been left by the walls.
  function furnishHub(hub: StrongholdRoom): void {
    for (const [x, z] of corners(hub, 1)) put('brazier', x, z);
    for (const x of [mid - 2, mid + 3]) put('banner', x, hub.z0, 0);
    for (const x of [mid - 4, mid + 4]) put('barricade', x, hub.z1 - 4, 2);
    for (const x of [mid - 5, mid + 5]) if (put('table', x, hub.z0 + 5, 0)) [put('bench', x, hub.z0 + 4, 0), put('bench', x, hub.z0 + 6, 2)];
    strew(some(['crate', 'barrel', 'rack', 'keg'], roll(3, 5)), byWall(hub), false);
  }

  const [g0] = plan.gate;
  return [...unsealed(plan, props), { kind: 'gate', x: g0.x, z: g0.z, w: plan.gate.length, d: 1, facing: 0, solid: false, variant: 0 }];
}

// The props with none left sealing open floor off from the way in: any solid one beside floor that can't be
// reached, taken away, till all of it can.
function unsealed(plan: StrongholdPlan, props: StrongholdProp[]): StrongholdProp[] {
  for (;;) {
    const solid = solidTiles(props);
    const reached = reachedFrom(plan, solid);
    const cut = (x: number, z: number) => isFloor(plan, x, z) && !solid.has(cellKey(x, z)) && !reached.has(cellKey(x, z));
    const sealing = props.filter((p) => p.solid && tilesOf(p).some(([x, z]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => cut(x + dx, z + dz))));
    if (sealing.length === 0) return props;
    props = props.filter((p) => !sealing.includes(p));
  }
}

// The tiles a prop stands on.
export function tilesOf(p: Pick<StrongholdProp, 'x' | 'z' | 'w' | 'd'>): Array<[number, number]> {
  const tiles: Array<[number, number]> = [];
  for (let x = p.x; x < p.x + p.w; x++) for (let z = p.z; z < p.z + p.d; z++) tiles.push([x, z]);
  return tiles;
}

// The tiles something solid stands on, as "x,z".
export const solidTiles = (props: readonly StrongholdProp[]): Set<string> => new Set(props.filter((p) => p.solid).flatMap((p) => tilesOf(p).map(([x, z]) => cellKey(x, z))));

// The floor reached from the way in, round the `shut` tiles.
export function reachedFrom(plan: StrongholdPlan, shut: ReadonlySet<string>): Set<string> {
  return flood([[plan.door, plan.depth - 1]], (x, z) => isFloor(plan, x, z) && !shut.has(cellKey(x, z)));
}
