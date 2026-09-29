// Wildlife: peaceful animals that make the world feel alive. They can't be
// hurt and never block anyone; they just go about their lives and keep away
// from the hero (cats mind them less). Each kind has its own file (ducks.ts,
// deer.ts, cats.ts); this one
// holds what they share and runs them each frame.

import { ENEMY_ACTIVE_RADIUS } from '../constants';
import { spawnDucks, stepDuckPack, type DuckWorld } from './ducks';
import { spawnDeer, stepDeerHerd, type DeerWorld } from './deer';
import { spawnCats, stepCat, type CatPose, type CatWorld } from './cats';
import type { Seat } from '../interiors/furniture';

export type WildlifeKind = 'duck' | 'deer' | 'cat';
export type DuckVariant = 'drake' | 'hen' | 'duckling';
export type DeerVariant = 'stag' | 'doe' | 'fawn';
export type CatVariant = 'ginger' | 'tabby' | 'black' | 'white'; // its coat

export interface Wildlife {
  id: number;
  kind: WildlifeKind;
  variant: DuckVariant | DeerVariant | CatVariant;
  x: number;
  z: number;
  y: number;
  heading: number; // yaw toward where it last moved (atan2(dx, dz))
  homeX: number; // where it wanders around
  homeZ: number;
  pack: Wildlife[]; // everyone in its group, leader first (shared by all of them)
  mother: Wildlife | null; // a fawn's: it keeps by her
  target: { x: number; z: number } | null; // where the leader is heading
  restFor: number; // seconds before the leader picks a new target
  dabble: number | null; // seconds into feeding (a duck dabbling, a deer grazing), or null
  fleeing: boolean; // hurrying away from the hero
  speed: number; // how fast it moved last frame, for the wake
  // Cats (cats.ts): what it's doing when not walking (null walking), the
  // bench seat it's on or heading up to, and how far the hero was last frame.
  pose?: CatPose | null;
  perch?: Seat | null;
  heroWas?: number;
}

export type WildlifeWorld = DuckWorld & DeerWorld & CatWorld;

export function spawnWildlife(world: WildlifeWorld): Wildlife[] {
  const ducks = spawnDucks(world, 0);
  const deer = spawnDeer(world, ducks.length);
  return [...ducks, ...deer, ...spawnCats(world, ducks.length + deer.length)];
}

// Every pack near the hero acts, led by its first member.
export function stepWildlife(wildlife: readonly Wildlife[], world: WildlifeWorld, hero: { x: number; z: number }, dt: number): void {
  for (const animal of wildlife) {
    if (animal.pack[0] !== animal) continue;
    if (Math.abs(animal.x - hero.x) > ENEMY_ACTIVE_RADIUS || Math.abs(animal.z - hero.z) > ENEMY_ACTIVE_RADIUS) continue;
    if (animal.kind === 'duck') stepDuckPack(animal.pack, world, hero, dt);
    else if (animal.kind === 'deer') stepDeerHerd(animal.pack, world, hero, dt);
    else stepCat(animal, world, hero, dt);
  }
}
