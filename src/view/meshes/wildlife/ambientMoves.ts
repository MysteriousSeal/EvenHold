// How each kind of the small life moves (ambientLife.ts draws them), all by
// cheap sums of the time and its own rolls, so nothing's kept but whether
// it's fled the hero (and where from): each puts where it is now into the
// moment's matrix, and says whether it's to be drawn at all.
// - butterflies wander in loops, bobbing, their wings beating;
// - fireflies drift, glowing up and dimming;
// - songbirds hop and peck on the grass (or sit a fence post, looking
//   about); the hero near, off in a flurry, up and away;
// - rabbits sit and nibble, a few hops on now and then; the hero coming,
//   they freeze, sat up; nearer, they bolt, zigzagging, their white scuts
//   flashing, and are gone into the grass;
// - dragonflies hover over the shallows, darting from spot to spot;
// - frogs squat on the bank, croaking (their throats swelling); the hero
//   near, they leap into the water, a ring of foam where they went in;
// - fish leap now and then out on the water (more at dawn and dusk), a ring
//   of foam where they leave it and another where they're back in;
// - crows sit the sown fields' fences, as the songbirds do the pastures';
// - a heron stands in the shallows, stock-still, turning now and then, a
//   strike at the water; the hero near, it flaps slowly off;
// - and now and then by day a flock goes over in a V, high up.

import * as THREE from 'three';
import type { LifeKind } from '../../../model/scenery/ambientSpots';
import { WATER_Y } from '../../../model/wildlife/ducks';
import { hashUnit } from '../../../util/random';

export interface Creature {
  kind: LifeKind;
  x: number; // its home, where it wanders round
  z: number;
  seed: number; // its own rolls
  tint: number;
  perch?: boolean; // a bird on a fence post
  y?: number; // the ground at its home (those that keep to one height: worked out once)
  face?: number; // a frog: which way the water is
  fled: number | null; // seconds since it fled the hero, or null
  away: { x: number; z: number } | null; // which way it fled
  from: { x: number; z: number } | null; // where it set off from
}

export interface Moment {
  time: number;
  dt: number;
  hour: number;
  hero: { x: number; z: number };
  ground(x: number, z: number): number;
  matrix: THREE.Matrix4; // where it's put
  splash(x: number, z: number, age: number): void; // a ring of foam on the water, `age` seconds old
}

const FLEE = { bird: 3.2, rabbit: 3.5, frog: 2.2, heron: 4 }; // tiles: the hero this near, they're off
const FREEZE = 5.5; // tiles: the hero this near, a rabbit sits up stock-still, watching
const BACK = 18; // tiles away the hero must go before they're back (within the patches still kept round them)
const POST = 0.39; // a fence post's top, over the ground (a bird sat on it: its middle)
const SPLASH_FOR = 0.9; // seconds a ring of foam lasts
const FROG = 1.7; // a frog drawn this much bigger than its voxels (true to size, it'd be lost in the grass)
const BIRD = 1.3; // a songbird, likewise (five voxels across, at the least)
const BUTTERFLY = 1.6;
const RABBIT = 1.5; // (about a third of a tile long)
const RABBIT_UP = 0.17; // its middle over the ground, drawn that big

const [at, turn, size, euler] = [new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3(), new THREE.Euler(0, 0, 0, 'YXZ')];
function pose(m: Moment, x: number, y: number, z: number, pitch: number, yaw: number, sx = 1, sy = 1, sz = 1): true {
  m.matrix.compose(at.set(x, y, z), turn.setFromEuler(euler.set(pitch, yaw, 0)), size.set(sx, sy, sz));
  return true;
}
const homeY = (c: Creature, m: Moment) => (c.y ??= m.ground(c.x, c.z));

// Whether it's (just) fled the hero, and back once they're well away; `start`: where it is now, should it be off;
// `fits`: where it can go, if it keeps to the ground (it turns aside from what it can't cross).
function fleeing(c: Creature, m: Moment, near: number, start: { x: number; z: number }, fits?: (x: number, z: number) => boolean): boolean {
  const toHero = Math.hypot(m.hero.x - c.x, m.hero.z - c.z);
  if (c.fled === null && toHero < near) {
    const straight = Math.atan2(start.x - m.hero.x, start.z - m.hero.z) + (c.seed - 0.5) * 0.8;
    const away = [0, 0.6, -0.6, 1.2, -1.2].map((turn) => straight + turn).find((a) => !fits || fits(start.x + Math.sin(a) * 2.5, start.z + Math.cos(a) * 2.5)) ?? straight;
    [c.fled, c.away, c.from] = [0, { x: Math.sin(away), z: Math.cos(away) }, { ...start }];
  }
  if (c.fled === null) return false;
  c.fled += m.dt;
  if (toHero > BACK) [c.fled, c.away, c.from] = [null, null, null];
  return c.fled !== null;
}

export function butterfly(c: Creature, m: Moment): boolean {
  const t = m.time + c.seed * 100;
  // Wandering in loops round its home, bobbing; its wings beating (squeezed in and out).
  const [x, z] = [c.x + Math.sin(t * 0.43) * 1.2 + Math.sin(t * 1.1) * 0.3, c.z + Math.cos(t * 0.37) * 1.1 + Math.cos(t * 0.9) * 0.3];
  const y = m.ground(x, z) + 0.35 + Math.sin(t * 2.3) * 0.1 + c.seed * 0.25;
  const beat = 0.25 + 0.75 * Math.abs(Math.sin(t * 14));
  return pose(m, x, y, z, 0, Math.atan2(Math.cos(t * 0.43) * 0.52, -Math.sin(t * 0.37) * 0.41), beat * BUTTERFLY, BUTTERFLY, BUTTERFLY);
}

export function firefly(c: Creature, m: Moment, voxel: number): boolean {
  const t = m.time + c.seed * 100;
  // Drifting slowly, glowing up and dimming.
  const [x, z] = [c.x + Math.sin(t * 0.21) * 1.4, c.z + Math.cos(t * 0.17) * 1.4];
  const glow = Math.max(0, Math.sin(t * 1.3 + c.seed * 9));
  if (glow < 0.05) return false;
  const s = (0.035 * glow + 0.015) / voxel;
  return pose(m, x, m.ground(x, z) + 0.25 + c.seed * 0.7 + Math.sin(t * 0.8) * 0.15, z, 0, 0, s, s, s);
}

export function bird(c: Creature, m: Moment): boolean {
  const t = m.time + c.seed * 100;
  const base = c.perch ? homeY(c, m) + POST : m.ground(c.x, c.z);
  // The hero near: off in a flurry, up and away; back once they're gone.
  if (fleeing(c, m, FLEE.bird, c)) {
    const f = c.fled!;
    if (f > 6) return false; // (gone off out of sight)
    const flap = 0.85 + 0.15 * Math.sin(m.time * 30);
    return pose(m, c.x + c.away!.x * f * 3.2, base + Math.min(3, f * f * 1.4 + f * 0.6), c.z + c.away!.z * f * 3.2, -0.3, Math.atan2(c.away!.x, c.away!.z), 1.1 * BIRD, flap * BIRD, BIRD);
  }
  if (c.perch) {
    // Sat on its post, looking about now and then, a little hop round as it does.
    const look = Math.floor(t * 0.4);
    const into = (t * 0.4) % 1;
    return pose(m, c.x, base + (into < 0.1 ? Math.sin((into / 0.1) * Math.PI) * 0.03 : 0), c.z, 0, hashUnit(look, 3, c.seed * 1e4) * Math.PI * 2, BIRD, BIRD, BIRD);
  }
  // On the ground hopping and pecking.
  const hop = Math.floor(t * 0.7);
  const into = (t * 0.7) % 1;
  const [x, z] = [c.x + (hashUnit(hop, 1, c.seed * 1e4) - 0.5) * 0.8, c.z + (hashUnit(hop, 2, c.seed * 1e4) - 0.5) * 0.8];
  const y = m.ground(x, z) + 0.08 + (into < 0.15 ? Math.sin((into / 0.15) * Math.PI) * 0.06 : 0);
  return pose(m, x, y, z, into > 0.5 && into < 0.7 ? 0.4 : 0, hashUnit(hop, 3, c.seed * 1e4) * Math.PI * 2, BIRD, BIRD, BIRD);
}

// A rabbit's k'th sitting place round its home (`fits`: there's ground for it there; else its home).
function seat(c: Creature, k: number, fits: (x: number, z: number) => boolean): { x: number; z: number } {
  const [x, z] = [c.x + (hashUnit(k, 5, c.seed * 1e4) - 0.5) * 1.8, c.z + (hashUnit(k, 6, c.seed * 1e4) - 0.5) * 1.8];
  return fits(x, z) ? { x, z } : { x: c.x, z: c.z };
}

export function rabbit(c: Creature, m: Moment, fits: (x: number, z: number) => boolean): boolean {
  const t = m.time + c.seed * 100;
  const every = 2.6 + c.seed * 1.5; // seconds between one sitting place and the next
  const [k, u] = [Math.floor(t / every), (t / every) % 1];
  const [was, now] = [seat(c, k - 1, fits), seat(c, k, fits)];
  const going = u < 0.22 ? u / 0.22 : 1; // two hops on, then sat
  const here = { x: was.x + (now.x - was.x) * going, z: was.z + (now.z - was.z) * going };
  if (fleeing(c, m, FLEE.rabbit, here, fits)) {
    // Bolting, zigzag, in long bounds; gone into the grass (or the reeds, at the water).
    const f = c.fled!;
    const side = Math.sin(f * 7) * 0.3;
    const [x, z] = [c.from!.x + c.away!.x * f * 3 + c.away!.z * side, c.from!.z + c.away!.z * f * 3 - c.away!.x * side];
    if (f > 1.8) return false;
    if (!fits(x, z)) {
      c.fled = 99; // (gone, and stays gone till the hero's away)
      return false;
    }
    return pose(m, x, m.ground(x, z) + RABBIT_UP + Math.abs(Math.sin(f * Math.PI * 4)) * 0.1, z, -0.15, Math.atan2(c.away!.x, c.away!.z) + Math.cos(f * 7) * 0.4, RABBIT, RABBIT, RABBIT);
  }
  const yaw = Math.atan2(now.x - was.x, now.z - was.z) || c.seed * 6;
  if (Math.hypot(m.hero.x - c.x, m.hero.z - c.z) < FREEZE) return pose(m, now.x, m.ground(now.x, now.z) + RABBIT_UP, now.z, -0.15, yaw, RABBIT, RABBIT, RABBIT); // (frozen, sat up)
  const hopUp = going < 1 ? Math.abs(Math.sin(going * Math.PI * 2)) * 0.08 : 0;
  const nibble = u > 0.4 && u < 0.75 ? 0.25 + Math.sin(t * 9) * 0.05 : 0; // its head down to the grass
  return pose(m, here.x, m.ground(here.x, here.z) + RABBIT_UP + hopUp, here.z, nibble, yaw, RABBIT, RABBIT, RABBIT);
}

export function dragonfly(c: Creature, m: Moment): boolean {
  const t = m.time + c.seed * 100;
  const every = 1.4 + c.seed * 0.6;
  const [k, u] = [Math.floor(t / every), (t / every) % 1];
  const spot = (n: number) => ({ x: c.x + (hashUnit(n, 7, c.seed * 1e4) - 0.5) * 2.4, z: c.z + (hashUnit(n, 8, c.seed * 1e4) - 0.5) * 2.4, y: 0.3 + hashUnit(n, 9, c.seed * 1e4) * 0.3 });
  const [was, now] = [spot(k - 1), spot(k)];
  const dart = u < 0.12 ? (u / 0.12) * (2 - u / 0.12) : 1; // (eased)
  const [x, z, y] = [was.x + (now.x - was.x) * dart, was.z + (now.z - was.z) * dart, was.y + (now.y - was.y) * dart];
  const wings = 0.55 + 0.45 * Math.abs(Math.sin(t * 40));
  return pose(m, x + Math.sin(t * 7) * 0.015, Math.max(homeY(c, m), WATER_Y) + y + Math.sin(t * 5) * 0.02, z, 0, Math.atan2(now.x - was.x, now.z - was.z), wings);
}

export function frog(c: Creature, m: Moment): boolean {
  const t = m.time + c.seed * 100;
  const y = homeY(c, m);
  const face = c.face ?? c.seed * 6;
  if (fleeing(c, m, FLEE.frog, c)) {
    // One leap out over the water, and in.
    const f = c.fled!;
    const leap = 0.45;
    const [wx, wz] = [c.x + Math.sin(face) * 0.9, c.z + Math.cos(face) * 0.9];
    if (f >= leap) {
      if (f < leap + SPLASH_FOR) m.splash(wx, wz, f - leap);
      return false;
    }
    const k = f / leap;
    return pose(m, c.x + (wx - c.x) * k, y + (WATER_Y - y) * k + Math.sin(k * Math.PI) * 0.18, c.z + (wz - c.z) * k, -0.5 + k, face, FROG, FROG, FROG);
  }
  // Sat on the bank facing the water, now and then a little hop round; croaking, its throat swelling.
  const every = 5 + c.seed * 4;
  const into = (t % every) / every;
  const hop = into < 0.06 ? Math.sin((into / 0.06) * Math.PI) * 0.05 : 0;
  const croak = (t * 0.7 + c.seed * 3) % 3 < 0.8 ? Math.max(0, Math.sin(t * 18)) * 0.18 : 0;
  return pose(m, c.x, y + hop + 0.04, c.z, 0, face + (hashUnit(Math.floor(t / every), 4, c.seed * 1e4) - 0.5) * 0.8, FROG * (1 + croak), FROG * (1 + croak * 0.5), FROG);
}

export function fish(c: Creature, m: Moment): boolean {
  const t = m.time + c.seed * 100;
  const dusky = (m.hour > 5 && m.hour < 8) || (m.hour > 18 && m.hour < 21); // (when they rise most)
  const every = (7 + c.seed * 6) * (dusky ? 0.5 : 1);
  const [k, u] = [Math.floor(t / every), t % every];
  const leap = 0.9;
  const yaw = hashUnit(k, 3, c.seed * 1e4) * Math.PI * 2;
  const [x0, z0] = [c.x + (hashUnit(k, 1, c.seed * 1e4) - 0.5) * 1.4, c.z + (hashUnit(k, 2, c.seed * 1e4) - 0.5) * 1.4];
  const along = (f: number) => ({ x: x0 + Math.sin(yaw) * (f - 0.5) * 0.5, z: z0 + Math.cos(yaw) * (f - 0.5) * 0.5 });
  if (u < SPLASH_FOR) {
    const out = along(0);
    m.splash(out.x, out.z, u);
  }
  if (u >= leap && u < leap + SPLASH_FOR) {
    const back = along(1);
    m.splash(back.x, back.z, u - leap);
  }
  if (u >= leap) return false;
  const f = u / leap;
  const p = along(f);
  return pose(m, p.x, WATER_Y - 0.04 + Math.sin(f * Math.PI) * 0.38, p.z, (f - 0.5) * 2.4, yaw);
}

export function heron(c: Creature, m: Moment): boolean {
  const t = m.time + c.seed * 100;
  const stood = WATER_Y - 0.06 + 0.25; // (its middle: its legs a little under the water)
  if (fleeing(c, m, FLEE.heron, c)) {
    // Up and off, slow wingbeats, low over the water.
    const f = c.fled!;
    if (f > 8) return false;
    const flap = 0.7 + 0.3 * Math.sin(m.time * 7);
    return pose(m, c.x + c.away!.x * f * 1.8, stood + Math.min(2.5, f * 0.5), c.z + c.away!.z * f * 1.8, -0.2, Math.atan2(c.away!.x, c.away!.z), 1.6 * flap, 0.8, 1);
  }
  // Stood, turning a little now and then; a strike at the water (its head and neck down and up).
  const turnEvery = 6 + c.seed * 4;
  const yaw = hashUnit(Math.floor(t / turnEvery), 5, c.seed * 1e4) * Math.PI * 2;
  const strike = t % 9 < 0.5 ? Math.sin(((t % 9) / 0.5) * Math.PI) * 0.5 : 0;
  return pose(m, c.x, stood, c.z, strike, yaw);
}

const FLOCK_EVERY = 45; // seconds: at most one flock over in each
const FLOCK_FOR = 16; // seconds it takes to cross
const FLOCK_HIGH = 3.5; // world units over the ground

// The flock going over now, if one is (by day, at most one in FLOCK_EVERY seconds, most often not): each bird of it
// in its V, put where `each` takes it. `seed`: the world's; `out`: the share of the birds that are about (none at
// night or in the rain, fewer in winter), the chance of a flock going over with it.
export function flock(m: Moment, seed: number, out: number, each: () => void): void {
  const k = Math.floor(m.time / FLOCK_EVERY);
  const into = m.time - k * FLOCK_EVERY;
  if (into > FLOCK_FOR || hashUnit(k, 1, seed) > 0.5 * out) return;
  const heading = hashUnit(k, 2, seed) * Math.PI * 2;
  const [dx, dz] = [Math.sin(heading), Math.cos(heading)];
  const along = (into / FLOCK_FOR - 0.5) * 40; // (from well off one side of the hero to well off the other)
  const side = (hashUnit(k, 3, seed) - 0.5) * 8;
  const [lx, lz] = [m.hero.x + dx * along + dz * side, m.hero.z + dz * along - dx * side];
  const y = m.ground(m.hero.x, m.hero.z) + FLOCK_HIGH;
  const count = 5 + Math.floor(hashUnit(k, 4, seed) * 5);
  for (let i = 0; i < count; i++) {
    const [row, wing] = [Math.ceil(i / 2), i % 2 === 0 ? 1 : -1];
    const [bx, bz] = [lx - dx * row * 0.35 + dz * wing * row * 0.3, lz - dz * row * 0.35 - dx * wing * row * 0.3];
    const flap = 0.6 + 0.4 * Math.abs(Math.sin(m.time * 9 + i));
    pose(m, bx, y + Math.sin(m.time * 0.8 + i) * 0.05, bz, 0, heading, 1.4 * flap, 1.2, 1.2);
    each();
  }
}

// A ring of foam `age` seconds old, spreading and sinking away.
export function splash(m: Moment, x: number, z: number, age: number): void {
  const spread = 0.6 + (age / SPLASH_FOR) * 1.6;
  pose(m, x, WATER_Y + 0.01 - (age / SPLASH_FOR) * 0.02, z, 0, 0, spread, 1, spread);
}
