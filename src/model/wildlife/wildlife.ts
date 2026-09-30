// Wildlife: peaceful animals that make the world feel alive. They can't be
// hurt and never block anyone; they just go about their lives and keep away
// from the hero (cats mind them less). Each kind has its own file (ducks.ts,
// deer.ts, cats.ts); this one
// holds what they share and runs them each frame.

import { ENEMY_ACTIVE_RADIUS } from '../constants';
import { spawnDucks, stepDuckPack, type DuckWorld } from './ducks';
import { spawnDeer, stepDeerHerd, type DeerWorld } from './deer';
import { spawnCats, stepCat, type CatWorld } from './cats';
import type { Wildlife } from './animal';

export type { CatVariant, DeerVariant, DuckVariant, Wildlife, WildlifeKind } from './animal';

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
