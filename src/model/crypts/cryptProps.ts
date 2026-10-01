// What a crypt holds (cryptLayout.ts its plan), rolled from the same seed:
// sconces along the corridor walls and niches of skulls in the rooms' walls
// (both in the rock, facing the floor, on the walls always in full view), cobwebs in the far corners, the dead (stretched out, slumped against the rock, or scattered bones) and
// scattered stones on the floor; in the side rooms sarcophagi, urns, candles
// and fallen rubble; in the halls on the way candles and the dead; and in the
// great hall at the end a dais with the great sarcophagus on it, rows of
// sarcophagi either side and candles at its corners. Nothing solid is ever
// left where it would shut the way on (checked, and taken out if it does).

import { hashCell, mulberry32 } from '../../util/random';
import { isFloor, inFullView, type CryptPlan, type Rect } from './cryptLayout';

export type CryptPropKind = 'sconce' | 'niche' | 'cobweb' | 'skeleton' | 'slumped' | 'bones' | 'stones' | 'sarcophagus' | 'urns' | 'candles' | 'rubble' | 'dais' | 'greatSarcophagus';

export interface CryptProp {
  kind: CryptPropKind;
  x: number; // its first tile
  z: number;
  w: number; // tiles across x
  d: number; // along z
  facing: number; // quarter turns: which way it faces (0 +z, 1 +x, 2 -z, 3 -x): a wall piece's, the floor it looks out on
  solid: boolean;
  variant: number; // 0..3 (the dead's: 0..11, its look by variant % 4, and its gear, if any, by variant >> 2: REMAINS)
}

// The dead's variants: four looks, each with nothing, or a rusty sword, or a helmet and shield beside it.
export const REMAINS = 12;

const SIDES: Array<[number, number]> = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // by facing
const SCONCE_EVERY = 6; // corridor tiles between sconces
const SOLID: ReadonlySet<CryptPropKind> = new Set(['sarcophagus', 'urns', 'rubble', 'greatSarcophagus']);

export function furnishCrypt(seed: number, ruin: { x: number; z: number }, plan: CryptPlan): CryptProp[] {
  const rng = mulberry32(hashCell(ruin.x * 13 + 5, ruin.z * 29 + 1, seed + 6151));
  const props: CryptProp[] = [];
  const taken = new Set<string>(); // floor tiles something stands on
  const key = (x: number, z: number) => `${x},${z}`;
  const floor = (x: number, z: number) => isFloor(plan, x, z);
  const put = (kind: CryptPropKind, x: number, z: number, w = 1, d = 1, facing = 0) => {
    for (let a = x; a < x + w; a++) for (let b = z; b < z + d; b++) if (!floor(a, b) || taken.has(key(a, b))) return false;
    const solid = SOLID.has(kind);
    if (kind !== 'dais') for (let a = x; a < x + w; a++) for (let b = z; b < z + d; b++) taken.add(key(a, b));
    props.push({ kind, x, z, w, d, facing, solid, variant: Math.floor(rng() * 4) });
    return true;
  };
  // A wall piece: in the rock beside a floor tile, facing it.
  const onWall = (kind: CryptPropKind, x: number, z: number, facing: number) => props.push({ kind, x, z, w: 1, d: 1, facing, solid: false, variant: Math.floor(rng() * 4) });
  const wallsBeside = (x: number, z: number) => SIDES.map(([dx, dz], facing) => ({ x: x - dx, z: z - dz, facing })).filter((w) => !floor(w.x, w.z));
  // The walls beside it that face the viewer and are always in full view (the rest fade when the hero's behind them: inFullView).
  const farWallsBeside = (x: number, z: number) => wallsBeside(x, z).filter((w) => w.facing <= 1 && inFullView(plan, w.x, w.z));
  const tilesOf = (r: Rect) => {
    const tiles: Array<[number, number]> = [];
    for (let x = r.x0; x <= r.x1; x++) for (let z = r.z0; z <= r.z1; z++) tiles.push([x, z]);
    return tiles;
  };
  const byWall = (r: Rect) => tilesOf(r).filter(([x, z]) => wallsBeside(x, z).length > 0);
  // Someone who died down here: slumped against the rock (where there's rock in full view beside them),
  // else lying stretched out, else bones scattered; turned any way; now and then their rusted gear by them.
  const theDead = (x: number, z: number) => {
    const wall = farWallsBeside(x, z)[0];
    const r = rng();
    const kind: CryptPropKind = wall && r < 0.3 ? 'slumped' : r < 0.65 ? 'skeleton' : 'bones';
    const facing = kind === 'slumped' ? wall.facing : Math.floor(rng() * 4);
    if (!put(kind, x, z, 1, 1, facing)) return;
    props[props.length - 1].variant = Math.floor(rng() * REMAINS);
  };

  for (const place of plan.places) {
    if (place.kind === 'corridor') {
      // A sconce every so many tiles, on alternate sides; bones and stones here and there.
      tilesOf(place).forEach(([x, z], i) => {
        if (i % SCONCE_EVERY === 0) {
          const walls = farWallsBeside(x, z);
          const wall = walls[i % Math.max(1, walls.length)];
          if (wall && !props.some((p) => p.x === wall.x && p.z === wall.z)) onWall('sconce', wall.x, wall.z, wall.facing);
        }
        const r = rng();
        if (r < 0.04) theDead(x, z);
        else if (r < 0.08) put('stones', x, z);
      });
      continue;
    }
    if (place.kind === 'great') {
      greatHall(place, put, rng);
    } else if (place.kind === 'side') {
      // Sarcophagi laid out a tile apart down the room, urns and rubble against the walls, a candle cluster.
      const long = place.x1 - place.x0 >= place.z1 - place.z0;
      for (let k = 0; k < 3; k++) {
        const x = place.x0 + 1 + Math.floor(rng() * Math.max(1, place.x1 - place.x0 - 2));
        const z = place.z0 + 1 + Math.floor(rng() * Math.max(1, place.z1 - place.z0 - 2));
        put('sarcophagus', x, z, long ? 1 : 2, long ? 2 : 1, long ? 0 : 1);
      }
      for (const [x, z] of byWall(place)) {
        const r = rng();
        if (r < 0.12) put('urns', x, z);
        else if (r < 0.18) put('rubble', x, z);
      }
      const [cx, cz] = tilesOf(place)[Math.floor(rng() * tilesOf(place).length)];
      put('candles', cx, cz);
    } else {
      // A hall on the way: candles at two corners, bones about.
      put('candles', place.x0, place.z0);
      put('candles', place.x1, place.z1);
      for (const [x, z] of tilesOf(place)) if (rng() < 0.05) theDead(x, z);
    }
    // In the rooms' walls, niches of skulls every other tile or so.
    for (const [x, z] of byWall(place)) for (const wall of farWallsBeside(x, z)) if (rng() < 0.3 && !props.some((p) => p.x === wall.x && p.z === wall.z)) onWall('niche', wall.x, wall.z, wall.facing);
  }
  // Cobwebs in the far inner corners (floor with rock on its -x and -z sides: those seen).
  for (let x = 0; x < plan.width; x++) {
    for (let z = 0; z < plan.depth; z++) {
      if (!floor(x, z)) continue; // (high up: over whatever stands there)
      if (inFullView(plan, x - 1, z) && inFullView(plan, x, z - 1) && rng() < 0.4) props.push({ kind: 'cobweb', x, z, w: 1, d: 1, facing: 0, solid: false, variant: Math.floor(rng() * 4) });
    }
  }
  return keepTheWayOpen(plan, props);
}

// The great hall: a dais at its far end (away from where the corridor comes in), the great sarcophagus on it,
// candles at the dais's corners, and a row of sarcophagi down either side.
function greatHall(hall: Rect, put: (kind: CryptPropKind, x: number, z: number, w?: number, d?: number, facing?: number) => boolean, rng: () => number): void {
  const cx = Math.floor((hall.x0 + hall.x1) / 2);
  const daisW = 4;
  const dx0 = cx - 1;
  put('dais', dx0, hall.z0 + 1, daisW, 5);
  put('greatSarcophagus', dx0 + 1, hall.z0 + 2, 2, 3);
  for (const [x, z] of [[dx0, hall.z0 + 1], [dx0 + daisW - 1, hall.z0 + 1], [dx0, hall.z0 + 5], [dx0 + daisW - 1, hall.z0 + 5]]) put('candles', x, z);
  for (let z = hall.z0 + 1; z + 1 <= hall.z1 - 2; z += 3) {
    if (rng() < 0.85) put('sarcophagus', hall.x0 + 1, z, 1, 2, 1);
    if (rng() < 0.85) put('sarcophagus', hall.x1 - 1, z, 1, 2, 3);
  }
}

// Solid props that would cut the floor in two (the way on, or a room off from it) left out.
function keepTheWayOpen(plan: CryptPlan, props: CryptProp[]): CryptProp[] {
  const blocked = (kept: readonly CryptProp[]) => {
    const solid = new Set<string>();
    for (const p of kept) if (p.solid) for (let x = p.x; x < p.x + p.w; x++) for (let z = p.z; z < p.z + p.d; z++) solid.add(`${x},${z}`);
    return solid;
  };
  const allReached = (kept: readonly CryptProp[]) => {
    const solid = blocked(kept);
    const seen = new Set<string>();
    const todo: Array<[number, number]> = [[plan.door, plan.depth - 1]];
    while (todo.length > 0) {
      const [x, z] = todo.pop()!;
      const k = `${x},${z}`;
      if (!isFloor(plan, x, z) || solid.has(k) || seen.has(k)) continue;
      seen.add(k);
      todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
    }
    let open = 0;
    for (let x = 0; x < plan.width; x++) for (let z = 0; z < plan.depth; z++) if (isFloor(plan, x, z) && !solid.has(`${x},${z}`)) open++;
    return seen.size === open;
  };
  // Each solid one kept only if everything's still reached with it there.
  const kept: CryptProp[] = [];
  for (const p of props) {
    kept.push(p);
    if (p.solid && !allReached(kept)) kept.pop();
  }
  return kept;
}
