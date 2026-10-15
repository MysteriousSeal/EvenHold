// Livestock: a village's beasts out in its fields, grazing among the crops
// inside the fence (never out of it, the gate being only the hero's way in):
// a flock of sheep, a few cows, pigs rooting, or hens scratching about; most
// fields have some, of one kind. Each goes about on its own: a few steps
// somewhere else in the field, then stood a while, its head down to graze
// (or to peck). They mind the hero only when they're right by them: then
// they shy off a little way (still inside), and settle again.
//
// Only to be seen, like the small life (scenery/ambientSpots.ts): which
// field has what comes from the seed and the field, drawn round the hero
// (view/meshes/wildlife/livestockViews.ts), made as it comes near and let go
// as it's left; nothing to save. Their choices come from hashes of where
// they are, so tests are repeatable.

import { hashUnit, oneOf } from '../../util/random';
import type { Field } from '../types';

export type LivestockKind = 'sheep' | 'cow' | 'pig' | 'hen';

export interface Beast {
  kind: LivestockKind;
  coat: number; // which of its kind's coats (view/meshes/turned/*Voxels.ts)
  x: number;
  z: number;
  heading: number; // yaw toward where it last went (atan2(dx, dz))
  target: { x: number; z: number } | null; // where it's walking, or null stood
  restFor: number; // seconds stood before it goes somewhere else
  speed: number; // how fast it went last frame
  n: number; // its place in the herd, for its rolls
}

// Each kind: how many to a field (at least, plus up to), its coats, its pace and how far it keeps from the fence.
const KINDS: Record<LivestockKind, { herd: [number, number]; coats: number; walk: number; shy: number; margin: number; rest: [number, number] }> = {
  sheep: { herd: [3, 4], coats: 2, walk: 0.35, shy: 1.4, margin: 0.3, rest: [4, 8] },
  cow: { herd: [1, 2], coats: 3, walk: 0.25, shy: 1.0, margin: 0.4, rest: [6, 10] },
  pig: { herd: [2, 2], coats: 3, walk: 0.3, shy: 1.2, margin: 0.3, rest: [4, 7] },
  hen: { herd: [3, 4], coats: 1, walk: 0.45, shy: 1.6, margin: 0.15, rest: [1.5, 3] },
};
const STOCKED = 0.65; // of the fields that have any
const MIX: LivestockKind[] = ['sheep', 'sheep', 'cow', 'pig', 'hen', 'hen'];
const SHY_PACE = 1.6; // its pace shied off, times its walk
const SHY_BY = 1.1; // tiles: the hero this near sends it off

const fieldRoll = (field: Field, seed: number, salt: number) => hashUnit(field.x0 * 31 + field.z0, field.width * 7 + field.depth, seed + salt);

// What kind keeps in a field, if any.
export function stockOf(field: Field, seed: number): LivestockKind | null {
  return fieldRoll(field, seed, 1) < STOCKED ? oneOf(MIX, fieldRoll(field, seed, 2)) : null;
}

// Whether (x, z) is inside the field, far enough off its fence (`margin`), and off its hay corner.
export function inPasture(field: Field, x: number, z: number, margin = 0.3): boolean {
  const [x0, z0, x1, z1] = [field.x0 - 0.5 + margin, field.z0 - 0.5 + margin, field.x0 + field.width - 0.5 - margin, field.z0 + field.depth - 0.5 - margin];
  if (x < x0 || z < z0 || x > x1 || z > z1) return false;
  return Math.round(x) !== field.corner[0] || Math.round(z) !== field.corner[1];
}

// The field's beasts (none, most often for a few), each somewhere in it.
export function herdIn(field: Field, seed: number): Beast[] {
  const kind = stockOf(field, seed);
  if (!kind) return [];
  const ways = KINDS[kind];
  const count = ways.herd[0] + Math.floor(fieldRoll(field, seed, 3) * (ways.herd[1] + 1));
  const coat = Math.floor(fieldRoll(field, seed, 4) * ways.coats);
  const beasts: Beast[] = [];
  for (let n = 0; n < count; n++) {
    const roll = (salt: number) => fieldRoll(field, seed, 10 + n * 8 + salt);
    for (let t = 0; t < 6; t++) {
      const x = field.x0 - 0.5 + roll(t) * field.width;
      const z = field.z0 - 0.5 + hashUnit(n, t, seed + field.x0 + field.z0 * 7) * field.depth;
      if (!inPasture(field, x, z, ways.margin)) continue;
      // (Mostly one coat to a flock, now and then another among them.)
      beasts.push({ kind, coat: roll(6) < 0.8 ? coat : Math.floor(roll(7) * ways.coats), x, z, heading: roll(5) * Math.PI * 2, target: null, restFor: roll(4) * ways.rest[1], speed: 0, n });
      break;
    }
  }
  return beasts;
}

const rollAt = (beast: Beast, salt: number) => hashUnit(Math.round(beast.x * 100), Math.round(beast.z * 100), salt + beast.n * 13);

// One frame for a beast in its field.
export function stepBeast(beast: Beast, field: Field, hero: { x: number; z: number }, dt: number): void {
  const ways = KINDS[beast.kind];
  const fits = (x: number, z: number) => inPasture(field, x, z, ways.margin);
  let pace = ways.walk;
  const toHero = Math.hypot(hero.x - beast.x, hero.z - beast.z);
  if (toHero < SHY_BY) {
    // Shied off: away from the hero, a way along the field (turning if the fence is that way).
    const away = Math.atan2(beast.x - hero.x, beast.z - hero.z);
    for (const turn of [0, 0.7, -0.7, 1.4, -1.4, 2.2, -2.2]) {
      const [x, z] = [beast.x + Math.sin(away + turn) * ways.shy, beast.z + Math.cos(away + turn) * ways.shy];
      if (fits(x, z)) {
        beast.target = { x, z };
        break;
      }
    }
    pace = ways.walk * SHY_PACE;
  }
  let moved = 0;
  if (beast.target) {
    const [dx, dz] = [beast.target.x - beast.x, beast.target.z - beast.z];
    const d = Math.hypot(dx, dz);
    const step = Math.min(pace * dt, d);
    const [x, z] = [beast.x + (dx / (d || 1)) * step, beast.z + (dz / (d || 1)) * step];
    if (d > 1e-4 && fits(x, z)) {
      [beast.x, beast.z, moved] = [x, z, step];
      beast.heading = Math.atan2(dx, dz);
    }
    if (moved === 0 || d - step < 0.02) {
      beast.target = null;
      beast.restFor = ways.rest[0] + rollAt(beast, 1) * (ways.rest[1] - ways.rest[0]);
    }
  } else {
    beast.restFor -= dt;
    if (beast.restFor <= 0) {
      // Somewhere else in the field, not far: a few steps' grazing on.
      const [a, reach] = [rollAt(beast, 2) * Math.PI * 2, 0.4 + rollAt(beast, 3) * 1.6];
      const [x, z] = [beast.x + Math.sin(a) * reach, beast.z + Math.cos(a) * reach];
      if (fits(x, z)) beast.target = { x, z };
      else beast.restFor = 0.4; // (try another way shortly)
    }
  }
  beast.speed = moved / dt;
}
