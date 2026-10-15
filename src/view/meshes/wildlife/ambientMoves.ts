// How each kind of the small life moves (ambientLife.ts draws them), all by
// cheap sums of the time and its own rolls, so nothing's kept but whether
// it's fled the hero (and where from): each puts where it is now into the
// moment's matrix, and says whether it's to be drawn at all.
// - butterflies wander in loops, bobbing, their wings beating;
// - fireflies drift, glowing up and dimming;
// - songbirds hop and peck on the grass (or sit a fence post, looking
//   about); the hero near, off in a flurry, up and away;
// - rabbits sit and nibble, a few hops on now and then; the hero near,
//   they bolt, zigzagging, and are gone into the grass;
// - dragonflies hover over the shallows, darting from spot to spot;
// - frogs squat on the bank, croaking (their throats swelling); the hero
//   near, they leap into the water, a ring of foam where they went in;
// - fish leap now and then out on the water (more at dawn and dusk), a ring
//   of foam where they leave it and another where they're back in.

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

const FLEE = { bird: 3.2, rabbit: 3.5, frog: 2.2 }; // tiles: the hero this near, they're off
const BACK = 18; // tiles away the hero must go before they're back (within the patches still kept round them)
const POST = 0.39; // a fence post's top, over the ground (a bird sat on it: its middle)
const SPLASH_FOR = 0.9; // seconds a ring of foam lasts
const FROG = 1.7; // a frog drawn this much bigger than its voxels (true to size, it'd be lost in the grass)

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
  return pose(m, x, y, z, 0, Math.atan2(Math.cos(t * 0.43) * 0.52, -Math.sin(t * 0.37) * 0.41), beat);
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
    return pose(m, c.x + c.away!.x * f * 3.2, base + Math.min(3, f * f * 1.4 + f * 0.6), c.z + c.away!.z * f * 3.2, -0.3, Math.atan2(c.away!.x, c.away!.z), 1.1, flap);
  }
  if (c.perch) {
    // Sat on its post, looking about now and then, a little hop round as it does.
    const look = Math.floor(t * 0.4);
    const into = (t * 0.4) % 1;
    return pose(m, c.x, base + (into < 0.1 ? Math.sin((into / 0.1) * Math.PI) * 0.03 : 0), c.z, 0, hashUnit(look, 3, c.seed * 1e4) * Math.PI * 2);
  }
  // On the ground hopping and pecking.
  const hop = Math.floor(t * 0.7);
  const into = (t * 0.7) % 1;
  const [x, z] = [c.x + (hashUnit(hop, 1, c.seed * 1e4) - 0.5) * 0.8, c.z + (hashUnit(hop, 2, c.seed * 1e4) - 0.5) * 0.8];
  const y = m.ground(x, z) + 0.06 + (into < 0.15 ? Math.sin((into / 0.15) * Math.PI) * 0.06 : 0);
  return pose(m, x, y, z, into > 0.5 && into < 0.7 ? 0.4 : 0, hashUnit(hop, 3, c.seed * 1e4) * Math.PI * 2);
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
    return pose(m, x, m.ground(x, z) + Math.abs(Math.sin(f * Math.PI * 4)) * 0.1, z, -0.15, Math.atan2(c.away!.x, c.away!.z) + Math.cos(f * 7) * 0.4);
  }
  const yaw = Math.atan2(now.x - was.x, now.z - was.z) || c.seed * 6;
  const hopUp = going < 1 ? Math.abs(Math.sin(going * Math.PI * 2)) * 0.08 : 0;
  const nibble = u > 0.4 && u < 0.75 ? 0.25 + Math.sin(t * 9) * 0.05 : 0; // its head down to the grass
  return pose(m, here.x, m.ground(here.x, here.z) + hopUp, here.z, nibble, yaw);
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

// A ring of foam `age` seconds old, spreading and sinking away.
export function splash(m: Moment, x: number, z: number, age: number): void {
  const spread = 0.6 + (age / SPLASH_FOR) * 1.6;
  pose(m, x, WATER_Y + 0.01 - (age / SPLASH_FOR) * 0.02, z, 0, 0, spread, 1, spread);
}
