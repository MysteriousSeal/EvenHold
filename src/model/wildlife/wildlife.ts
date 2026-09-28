// Wildlife: peaceful animals that make the world feel alive. They can't be
// hurt and never block anyone; they just go about their lives and keep away
// from the hero. Each kind has its own file (ducks.ts, deer.ts); this one
// holds what they share and runs them each frame.

import { ENEMY_ACTIVE_RADIUS } from '../constants';
import { spawnDucks, stepDuckPack, type DuckWorld } from './ducks';
import { spawnDeer, stepDeerHerd, type DeerWorld } from './deer';

export type WildlifeKind = 'duck' | 'deer';
export type DuckVariant = 'drake' | 'hen' | 'duckling';
export type DeerVariant = 'stag' | 'doe' | 'fawn';

export interface Wildlife {
  id: number;
  kind: WildlifeKind;
  variant: DuckVariant | DeerVariant;
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
}

export type WildlifeWorld = DuckWorld & DeerWorld;

export function spawnWildlife(world: WildlifeWorld): Wildlife[] {
  const ducks = spawnDucks(world, 0);
  return [...ducks, ...spawnDeer(world, ducks.length)];
}

// Every pack near the hero acts, led by its first member.
export function stepWildlife(wildlife: readonly Wildlife[], world: WildlifeWorld, hero: { x: number; z: number }, dt: number): void {
  for (const animal of wildlife) {
    if (animal.pack[0] !== animal) continue;
    if (Math.abs(animal.x - hero.x) > ENEMY_ACTIVE_RADIUS || Math.abs(animal.z - hero.z) > ENEMY_ACTIVE_RADIUS) continue;
    if (animal.kind === 'duck') stepDuckPack(animal.pack, world, hero, dt);
    else stepDeerHerd(animal.pack, world, hero, dt);
  }
}
