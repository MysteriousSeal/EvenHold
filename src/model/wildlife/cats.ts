// Cats: one or two to a village, roaming it and its edges (never out into
// the wilds). Each goes about its own business, one thing at a time: a
// stroll somewhere nearby, then sitting a while, grooming, or curled up
// asleep; now and then up onto a free bench seat to loaf (off again the
// moment someone comes to sit there), or, curious, over to sit near the
// hero. They mind the hero only when rushed at: then they bolt, and
// settle once left alone. Like all wildlife, they block no one.
//
// Placed from hashes, like the ducks and deer; their choices come from
// hashes of where they are, so tests are repeatable.

import { hashUnit } from '../../util/random';
import type { Seat } from '../interiors/furniture';
import type { Seated } from '../interiors/indoors';
import type { MapSize } from '../grid';
import type { Village } from '../types';
import { squareBenches, type BenchWorld } from '../worldgen/benches';
import type { CatVariant, Wildlife } from './wildlife';

export type CatPose = 'sit' | 'groom' | 'nap' | 'loaf';

export interface CatWorld extends BenchWorld {
  seed: number;
  size: MapSize;
  villages: Village[];
  isBlocked(x: number, z: number, r: number): boolean;
  getGroundY(x: number, z: number): number;
  npcs?: ReadonlyArray<{ seat: Seat | null }>; // who sits where (villagers)
  seated?: Seated; // and the hero
}

const RADIUS = 0.08; // a cat's footprint
const WALK_SPEED = 0.45;
const BOLT_SPEED = 2.4;
const ROAM = 8; // tiles from the well, at most
const RUSHED = 1.2; // the hero this close, closing fast, sends a cat off
const RUSH_SPEED = 1.6; // closing speed (tiles a second) that counts as rushing
const CALM = 4; // and this far lets it settle
const CURIOUS_RANGE = 6; // the hero this near may draw a cat over
const BY_HERO = 0.55; // where a curious cat sits, from the hero
const COATS: CatVariant[] = ['ginger', 'tabby', 'black', 'white'];
const HOW_LONG: Record<CatPose, [number, number]> = { sit: [3, 7], groom: [3, 6], nap: [12, 25], loaf: [10, 20] };

function makeCat(id: number, variant: CatVariant, village: Village, x: number, z: number, world: CatWorld): Wildlife {
  return { id, kind: 'cat', variant, x, z, y: world.getGroundY(x, z), heading: hashUnit(x, z, 71) * Math.PI * 2, homeX: village.x, homeZ: village.z, pack: [], mother: null, target: null, restFor: 1 + hashUnit(x, z, 72) * 3, dabble: null, fleeing: false, speed: 0, pose: 'sit', perch: null };
}

// Room for a cat at (x, z): on the map, nothing in the way.
function walkable(world: CatWorld, x: number, z: number): boolean {
  return x > 0.5 && z > 0.5 && x < world.size.width - 1.5 && z < world.size.depth - 1.5 && !world.isBlocked(x, z, RADIUS);
}

export function spawnCats(world: CatWorld, firstId: number): Wildlife[] {
  const cats: Wildlife[] = [];
  const salt = world.seed % 1000;
  world.villages.forEach((village, v) => {
    const count = hashUnit(v, salt, 73) < 0.5 ? 1 : 2;
    for (let i = 0; i < count; i++) {
      const roll = (n: number) => hashUnit(v * 7 + i, salt, n);
      // Somewhere free round the square, trying a few spots.
      for (let t = 0; t < 12; t++) {
        const x = village.x + Math.round((roll(74 + t) - 0.5) * 6);
        const z = village.z + Math.round((roll(90 + t) - 0.5) * 6);
        if (!walkable(world, x, z)) continue;
        const cat = makeCat(firstId + cats.length, COATS[Math.floor(roll(110) * COATS.length)], village, x, z, world);
        cat.pack = [cat]; // each its own
        cats.push(cat);
        break;
      }
    }
  });
  return cats;
}

// A roll from where a cat is now, so choices vary as it moves but repeat exactly.
const rollAt = (cat: Wildlife, salt: number) => hashUnit(Math.round(cat.x * 100), Math.round(cat.z * 100), salt + cat.id);
const lasting = (cat: Wildlife, pose: CatPose) => HOW_LONG[pose][0] + rollAt(cat, 80) * (HOW_LONG[pose][1] - HOW_LONG[pose][0]);

// Moves a cat toward (tx, tz) at `speed`, sliding along what's in the way; returns how far it went.
function walkToward(cat: Wildlife, world: CatWorld, tx: number, tz: number, speed: number, dt: number): number {
  const dx = tx - cat.x;
  const dz = tz - cat.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-4) return 0;
  const step = Math.min(speed * dt, d);
  const [x0, z0] = [cat.x, cat.z];
  if (walkable(world, cat.x + (dx / d) * step, cat.z)) cat.x += (dx / d) * step;
  if (walkable(world, cat.x, cat.z + (dz / d) * step)) cat.z += (dz / d) * step;
  const moved = Math.hypot(cat.x - x0, cat.z - z0);
  if (moved > 1e-6) {
    cat.heading = Math.atan2(cat.x - x0, cat.z - z0);
    cat.y = world.getGroundY(cat.x, cat.z);
  }
  return moved;
}

// Whether someone (a villager, or the hero) sits on a seat.
function sat(world: CatWorld, seat: Seat): boolean {
  return world.seated?.seat.piece === seat.piece || !!world.npcs?.some((n) => n.seat?.piece === seat.piece);
}

// Down off its bench seat, onto the ground just in front of it.
function hopDown(cat: Wildlife, world: CatWorld): void {
  const seat = cat.perch!;
  const [fx, fz] = seat.piece.facing ?? [0, 0];
  cat.x = seat.x + fx * 0.5;
  cat.z = seat.z + fz * 0.5;
  cat.y = world.getGroundY(cat.x, cat.z);
  cat.perch = null;
}

// What next, once it's done with what it was doing: a stroll (often), over
// to the hero if they're about (sometimes), up onto a free bench (now and
// then), else stay and sit, groom or nap right there.
function nextThing(cat: Wildlife, world: CatWorld, hero: { x: number; z: number }): void {
  const r = rollAt(cat, 81);
  const heroNear = Math.hypot(hero.x - cat.homeX, hero.z - cat.homeZ) < ROAM && Math.hypot(hero.x - cat.x, hero.z - cat.z) < CURIOUS_RANGE;
  if (r < 0.15 && heroNear) {
    const a = rollAt(cat, 82) * Math.PI * 2;
    cat.target = { x: hero.x + Math.sin(a) * BY_HERO, z: hero.z + Math.cos(a) * BY_HERO };
    return;
  }
  if (r < 0.3) {
    const free = squareBenches(world)
      .filter((b) => Math.hypot(b.x - cat.homeX, b.z - cat.homeZ) < ROAM)
      .flatMap((b) => b.seats)
      .filter((s) => !sat(world, s));
    const seat = free[Math.floor(rollAt(cat, 83) * free.length)];
    if (seat) {
      const [fx, fz] = seat.piece.facing ?? [0, 0];
      cat.target = { x: seat.x + fx * 0.5, z: seat.z + fz * 0.5 };
      cat.perch = seat; // on its way up: taken once there
      return;
    }
  }
  if (r < 0.75) {
    for (let t = 0; t < 6; t++) {
      const [angle, reach] = [rollAt(cat, 84 + t) * Math.PI * 2, Math.sqrt(rollAt(cat, 94 + t)) * ROAM]; // anywhere within ROAM of the well
      const x = cat.homeX + Math.sin(angle) * reach;
      const z = cat.homeZ + Math.cos(angle) * reach;
      if (walkable(world, x, z)) {
        cat.target = { x, z };
        return;
      }
    }
  }
  settle(cat, rollAt(cat, 85) < 0.35 ? 'nap' : rollAt(cat, 86) < 0.5 ? 'groom' : 'sit');
}

function settle(cat: Wildlife, pose: CatPose): void {
  cat.pose = pose;
  cat.target = null;
  cat.restFor = lasting(cat, pose);
}

// One frame for a cat.
export function stepCat(cat: Wildlife, world: CatWorld, hero: { x: number; z: number }, dt: number): void {
  const toHero = Math.hypot(hero.x - cat.x, hero.z - cat.z);
  const closing = cat.heroWas === undefined ? 0 : (cat.heroWas - toHero) / dt;
  cat.heroWas = toHero;
  let moved = 0;
  // Rushed at: off it goes (down from a bench first), until left alone.
  if (!cat.fleeing && toHero < RUSHED && closing > RUSH_SPEED) {
    if (cat.pose === 'loaf' && cat.perch) hopDown(cat, world);
    cat.fleeing = true;
    cat.pose = null;
    cat.perch = null;
    const away = Math.atan2(cat.x - hero.x, cat.z - hero.z);
    cat.target = { x: cat.x + Math.sin(away) * CALM * 1.2, z: cat.z + Math.cos(away) * CALM * 1.2 };
  }
  if (cat.fleeing) {
    moved = cat.target ? walkToward(cat, world, cat.target.x, cat.target.z, BOLT_SPEED, dt) : 0;
    if (moved === 0 || toHero > CALM) {
      cat.fleeing = false;
      settle(cat, 'sit');
    }
  } else if (cat.pose === 'loaf' && cat.perch) {
    // Loafing on a bench: off it as someone comes to sit, else when rested.
    cat.restFor -= dt;
    if (sat(world, cat.perch) || cat.restFor <= 0) {
      hopDown(cat, world);
      settle(cat, 'sit');
    }
  } else if (cat.target) {
    cat.pose = null;
    moved = walkToward(cat, world, cat.target.x, cat.target.z, WALK_SPEED, dt);
    const there = Math.hypot(cat.target.x - cat.x, cat.target.z - cat.z) < 0.05;
    if (there || moved === 0) {
      const seat = cat.perch;
      if (seat && there && !sat(world, seat)) {
        // Up onto the bench, facing out as a sitter would.
        Object.assign(cat, { x: seat.x, z: seat.z, y: seat.y, heading: seat.facing });
        settle(cat, 'loaf');
      } else {
        cat.perch = null;
        if (Math.hypot(hero.x - cat.x, hero.z - cat.z) < BY_HERO * 2) cat.heading = Math.atan2(hero.x - cat.x, hero.z - cat.z); // by the hero: looking up at them
        settle(cat, rollAt(cat, 87) < 0.6 ? 'sit' : 'groom');
      }
    }
  } else {
    cat.restFor -= dt;
    if (cat.restFor <= 0) nextThing(cat, world, hero);
  }
  cat.speed = moved / dt;
}
