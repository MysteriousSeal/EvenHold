// A flat grass yard off the map, for the dev cheat: every kind of furniture
// (furniture.ts), packed close, and the copies that look different (a bed's
// four blankets, an armour stand's four suits, a door shut and open, a wall
// low and full height). A kind added to FURNITURE_KINDS is placed here on
// its own. The ground is far larger than the pieces, so a new one still fits.

import type { Hero } from '../types';
import type { Inside, Seated } from './indoors';
import { bumpsFurniture, FURNITURE_KINDS, type Furniture, type FurnitureKind } from './furniture';
import { HERO_RADIUS } from '../constants';

export const YARD_SIZE = 256; // tiles on a side; the pieces only use one corner

const GAP = 1; // empty tiles between pieces, enough to walk
const ROW = 16; // wrap here, so the cluster stays a tight block
const MARGIN = 2;

// Tiles a kind occupies. Anything new is one tile; the mesh is padded past that, so a piece that draws a little outside its tile still shows.
function span(kind: FurnitureKind): [number, number] {
  switch (kind) {
    case 'rug':
      return [3, 3];
    case 'bearRug':
    case 'doubleBed':
      return [2, 2];
    case 'bathtub':
      return [1, 2];
    case 'counter':
      return [4, 1];
    case 'hearth':
    case 'bed':
    case 'roomBed':
    case 'forge':
    case 'trough':
    case 'rack':
    case 'sink':
    case 'bottleShelf':
    case 'stairs':
    case 'stairwell':
    case 'hallWall':
    case 'smithCounter':
      return [2, 1];
    default:
      return [1, 1];
  }
}

// Stands in the open, facing the camera (+z). Anything else is drawn as if against the back wall, front toward +z.
function against(kind: FurnitureKind): Furniture['wall'] {
  switch (kind) {
    case 'table':
    case 'chair':
    case 'barrel':
    case 'rug':
    case 'bearRug':
    case 'anvil':
    case 'coal':
    case 'armchair':
    case 'bench':
    case 'grindstone':
    case 'bathtub':
    case 'stairs':
    case 'stairwell':
    case 'tavernTable':
    case 'keg':
      return 'none';
    default:
      return 'back';
  }
}

const WALK_THROUGH = new Set<FurnitureKind>(['rug', 'bearRug', 'framedPicture', 'antlers', 'wallShield', 'noticeBoard', 'wallLantern', 'weaponWall', 'toolBoard']);

// The copies of a kind that look different (every other kind: just the one).
const blankets = [0, 1, 2, 3].map((cloth) => ({ cloth }));
const COPIES: Partial<Record<FurnitureKind, Array<Partial<Furniture>>>> = {
  bed: blankets,
  roomBed: blankets,
  doubleBed: blankets,
  armorStand: [0, 1, 2, 3].map((suit) => ({ suit })),
  hallDoor: [{ open: false }, { open: true }],
  hallWall: [{ tall: false }, { tall: true }],
  framedPicture: [{ tall: true }],
};
const copies = (kind: FurnitureKind): Array<Partial<Furniture>> => COPIES[kind] ?? [{}];

export interface YardPlan {
  furniture: Furniture[];
  spawn: { x: number; z: number; facing: number };
}

function planYard(): YardPlan {
  let x = MARGIN;
  let z = MARGIN;
  let rowD = 0;
  const furniture: Furniture[] = [];
  for (const kind of FURNITURE_KINDS) {
    const [w, d] = span(kind);
    const wall = against(kind);
    const solid = !WALK_THROUGH.has(kind);
    for (const extra of copies(kind)) {
      if (x > MARGIN && x + w > MARGIN + ROW) {
        x = MARGIN;
        z += rowD + GAP;
        rowD = 0;
      }
      furniture.push({ kind, x, z, w, d, wall, solid, ...extra });
      x += w + GAP;
      rowD = Math.max(rowD, d);
    }
  }
  return { furniture, spawn: { x: MARGIN + 1, z: z + rowD + 2, facing: Math.PI } };
}

let cached: YardPlan | null = null;
export const furnitureYard = (): YardPlan => (cached ??= planYard());

export interface YardStay {
  furniture: readonly Furniture[];
  back: { x: number; z: number; facing: number; inside: Inside | null }; // where the hero was, standing
}

export interface YardHost {
  hero: Hero;
  inside: Inside | null;
  outdoors: { seated: Seated };
  yard: YardStay | null;
  teleport(x: number, z: number): void;
}

// Into the yard, or back to where the hero was: sat down, they come back
// standing where they got up from, not in the seat. The caller clears any hop and focus.
export function toggleYard(model: YardHost): string {
  if (model.yard) {
    const { back } = model.yard;
    model.yard = null;
    if (back.inside) {
      model.inside = back.inside;
      model.hero.x = back.x;
      model.hero.z = back.z;
      model.hero.y = 0;
    } else model.teleport(back.x, back.z);
    model.hero.facing = back.facing;
    return 'Back where you were.';
  }
  const yard = furnitureYard();
  const at = model.inside ?? model.outdoors;
  const from = at.seated?.from ?? model.hero;
  model.yard = { furniture: yard.furniture, back: { x: from.x, z: from.z, facing: model.hero.facing, inside: model.inside } };
  at.seated = null;
  model.inside = null;
  model.hero.x = yard.spawn.x;
  model.hero.z = yard.spawn.z;
  model.hero.y = 0;
  model.hero.facing = yard.spawn.facing;
  return 'The furniture yard.';
}

// Walk the flat yard. `dist` is how far this frame, already scaled.
export function stepYard(hero: Hero, furniture: readonly Furniture[], dirX: number, dirZ: number, dist: number): void {
  const len = Math.hypot(dirX, dirZ);
  if (len < 1e-6) return;
  const r = HERO_RADIUS;
  const lo = -0.5 + r;
  const hi = YARD_SIZE - 0.5 - r;
  hero.facing = Math.atan2(dirX, dirZ);
  const nx = Math.min(hi, Math.max(lo, hero.x + (dirX / len) * dist));
  if (!bumpsFurniture(furniture, nx, hero.z, r)) hero.x = nx;
  const nz = Math.min(hi, Math.max(lo, hero.z + (dirZ / len) * dist));
  if (!bumpsFurniture(furniture, hero.x, nz, r)) hero.z = nz;
  hero.y = 0;
}
