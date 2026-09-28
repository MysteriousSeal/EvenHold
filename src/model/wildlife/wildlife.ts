// Wildlife: peaceful animals that make the world feel alive. They can't be
// hurt and never block anyone; they just go about their lives and keep away
// from the hero. Each kind has its own file (ducks.ts); this one holds what
// they share and runs them each frame.

import { ENEMY_ACTIVE_RADIUS } from '../constants';
import { spawnDucks, stepDuckPack, type DuckWorld } from './ducks';

export type WildlifeKind = 'duck';
export type DuckVariant = 'drake' | 'hen' | 'duckling';

export interface Wildlife {
  id: number;
  kind: WildlifeKind;
  variant: DuckVariant;
  x: number;
  z: number;
  y: number;
  heading: number; // yaw toward where it last moved (atan2(dx, dz))
  homeX: number; // where it wanders around
  homeZ: number;
  pack: Wildlife[]; // everyone in its group, leader first (shared by all of them)
  target: { x: number; z: number } | null; // where the leader is heading
  restFor: number; // seconds before the leader picks a new target
  dabble: number | null; // seconds into dabbling (tipped headfirst to feed), or null
  fleeing: boolean; // paddling away from the hero
  speed: number; // how fast it moved last frame, for the wake
}

export type WildlifeWorld = DuckWorld;

export function spawnWildlife(world: WildlifeWorld): Wildlife[] {
  return spawnDucks(world, 0);
}

// Every pack near the hero acts, led by its first member.
export function stepWildlife(wildlife: readonly Wildlife[], world: WildlifeWorld, hero: { x: number; z: number }, dt: number): void {
  for (const animal of wildlife) {
    if (animal.pack[0] !== animal) continue;
    if (Math.abs(animal.x - hero.x) > ENEMY_ACTIVE_RADIUS || Math.abs(animal.z - hero.z) > ENEMY_ACTIVE_RADIUS) continue;
    stepDuckPack(animal.pack, world, hero, dt);
  }
}
