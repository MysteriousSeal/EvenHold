// What a crypt holds (cryptLayout.ts its plan), rolled from the same seed:
// sconces along the corridor walls and niches of skulls in the rooms' walls
// (both in the rock, facing the floor, on the walls always in full view), cobwebs in the far corners, the dead (stretched out, slumped against the rock, or scattered bones) and
// scattered stones on the floor; in the side rooms sarcophagi, urns, candles
// and fallen rubble; in the halls on the way candles and the dead; and in the
// great hall at the end a dais with the great sarcophagus on it, rows of
// sarcophagi either side and candles at its corners. Nothing solid is ever
// left where it would shut the way on (checked, and taken out if it does).

import { hashCell, mulberry32 } from '../../util/random';
import { FACINGS, NEIGHBORS_4, cellKey, flood } from '../map/grid';
import { isFloor, inFullView, type CryptPlan, type Rect } from './cryptLayout';
import { oneOf } from '../../util/random';

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
  const wallsBeside = (x: number, z: number) => FACINGS.map(([dx, dz], facing) => ({ x: x - dx, z: z - dz, facing })).filter((w) => !floor(w.x, w.z));
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

  // The great hall first (its dais and tomb before anything else claims its floor), then the rest in order from the stairs.
  const places = [...plan.places.filter((p) => p.kind === 'great'), ...plan.places.filter((p) => p.kind !== 'great')];
  for (const place of places) {
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
      const [cx, cz] = oneOf(tilesOf(place), rng());
      put('candles', cx, cz);
    } else {
      // A hall on the way: candles at two corners, bones about.
      put('candles', place.x0, place.z0);
      put('candles', place.x1, place.z1);
      for (const [x, z] of tilesOf(place)) if (rng() < 0.05) theDead(x, z);
    }
    // In the rooms' walls, niches of skulls every other tile or so; none in the wall behind the great tomb (the way
    // out's, opened there: cryptFoes.ts, exitDoor).
    const tomb = place.kind === 'great' ? props.find((p) => p.kind === 'greatSarcophagus') : undefined;
    const behindTomb = (x: number, z: number) => !!tomb && z === place.z0 - 1 && x >= tomb.x - 1 && x <= tomb.x + tomb.w;
    for (const [x, z] of byWall(place)) for (const wall of farWallsBeside(x, z)) if (rng() < 0.3 && !behindTomb(wall.x, wall.z) && !props.some((p) => p.x === wall.x && p.z === wall.z)) onWall('niche', wall.x, wall.z, wall.facing);
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
  // The dais as big as the hall allows (4 x 5 at most, a tile clear all round), the great sarcophagus in its middle.
  const [w, d] = [hall.x1 - hall.x0 + 1, hall.z1 - hall.z0 + 1];
  const [dw, dd] = [Math.min(4, w - 2), Math.min(5, d - 2)];
  const [dx0, dz0] = [hall.x0 + Math.floor((w - dw) / 2), hall.z0 + 1];
  put('dais', dx0, dz0, dw, dd);
  put('greatSarcophagus', dx0 + Math.floor((dw - 2) / 2), dz0 + Math.floor((dd - 3) / 2), 2, 3);
  for (const [x, z] of [[dx0, dz0], [dx0 + dw - 1, dz0], [dx0, dz0 + dd - 1], [dx0 + dw - 1, dz0 + dd - 1]]) put('candles', x, z);
  // Rows of sarcophagi down either side, where the hall's wide enough for them past the dais.
  if (w < dw + 6) return;
  for (let z = hall.z0 + 1; z + 1 <= hall.z1 - 2; z += 3) {
    if (rng() < 0.85) put('sarcophagus', hall.x0 + 1, z, 1, 2, 1);
    if (rng() < 0.85) put('sarcophagus', hall.x1 - 1, z, 1, 2, 3);
  }
}

// Solid props that would cut the floor in two (the way on, or a room off from it), or wall off the rock
// (no open floor left by a stretch of it, diagonally even: a row of urns along a wall), left out.
function keepTheWayOpen(plan: CryptPlan, props: CryptProp[]): CryptProp[] {
  const solid = new Set<string>();
  let open = plan.floor.reduce((a, b) => a + b, 0); // floor tiles nothing solid stands on
  const stillOpen = (p: CryptProp) => {
    const seen = flood([[plan.door, plan.depth - 1]], (x, z) => isFloor(plan, x, z) && !solid.has(cellKey(x, z)));
    if (seen.size !== open) return false;
    // The rock round it, where it meets the floor, still has open floor right by it.
    for (let x = p.x - 2; x < p.x + p.w + 2; x++) for (let z = p.z - 2; z < p.z + p.d + 2; z++) {
      if (isFloor(plan, x, z) || !NEIGHBORS_4.some(([dx, dz]) => isFloor(plan, x + dx, z + dz))) continue;
      if (![-1, 0, 1].some((dx) => [-1, 0, 1].some((dz) => seen.has(cellKey(x + dx, z + dz))))) return false;
    }
    return true;
  };
  // Each solid one kept only if everything's still reached with it there.
  const kept: CryptProp[] = [];
  for (const p of props) {
    if (!p.solid) {
      kept.push(p);
      continue;
    }
    const tiles = footprint(p);
    for (const k of tiles) solid.add(k);
    open -= tiles.length;
    if (stillOpen(p)) kept.push(p);
    else {
      for (const k of tiles) solid.delete(k);
      open += tiles.length;
    }
  }
  return kept;
}

// The floor tiles a prop stands on.
function footprint(p: CryptProp): string[] {
  const tiles: string[] = [];
  for (let x = p.x; x < p.x + p.w; x++) for (let z = p.z; z < p.z + p.d; z++) tiles.push(cellKey(x, z));
  return tiles;
}

// The floor tiles something solid stands on (and those of whatever else `also` says).
export function solidTiles(props: readonly CryptProp[], also: (p: CryptProp) => boolean = () => false): Set<string> {
  return new Set(props.filter((p) => p.solid || also(p)).flatMap(footprint));
}

// Where a crypt's way out stands (its door, in the rock): in its great hall's back wall (low z) right behind the
// great tomb, centred on it (between its tiles, it being two wide); else in a back corner; the floor before it
// open (its step), either way; else none. Opened when its lord's slain (cryptFoes.ts); no niches round it (above).
export function exitDoor({ plan, props }: { plan: CryptPlan; props: readonly CryptProp[] }): { x: number; z: number } | null {
  const great = plan.places.find((p) => p.kind === 'great');
  if (!great) return null;
  const solid = solidTiles(props, (p) => p.kind === 'dais');
  const fits = (x: number) => !isFloor(plan, x, great.z0 - 1) && isFloor(plan, x, great.z0) && !solid.has(cellKey(x, great.z0));
  const tomb = props.find((p) => p.kind === 'greatSarcophagus');
  if (tomb && [tomb.x, tomb.x + tomb.w - 1].every(fits)) return { x: tomb.x + (tomb.w - 1) / 2, z: great.z0 - 1 };
  const corner = [great.x0 + 1, great.x1 - 1, great.x0, great.x1].find(fits);
  return corner === undefined ? null : { x: corner, z: great.z0 - 1 };
}

// How high the floor stands at (x, z) (room tiles): the great hall's dais raised over the rest, its top a step
// up from its edge (as the view draws it: cryptVoxels.ts, three of its voxels, the step one); else 0.
export const DAIS_TOP = 0.12;
const DAIS_EDGE = 0.04;
const DAIS_STEP_IN = 0.12; // how far in from its edge its top begins
export function floorHeight(props: readonly CryptProp[], x: number, z: number): number {
  const dais = props.find((p) => p.kind === 'dais');
  if (!dais) return 0;
  const [x0, z0, x1, z1] = [dais.x - 0.5, dais.z - 0.5, dais.x + dais.w - 0.5, dais.z + dais.d - 0.5];
  if (x < x0 || z < z0 || x > x1 || z > z1) return 0;
  return x < x0 + DAIS_STEP_IN || z < z0 + DAIS_STEP_IN || x > x1 - DAIS_STEP_IN || z > z1 - DAIS_STEP_IN ? DAIS_EDGE : DAIS_TOP;
}
