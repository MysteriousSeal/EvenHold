// What the special lines of the hero's gear do over time and in a fight (human/items/gear.ts; crit and dodge are
// folded into their chances: attributes.ts): health back, so much each 10 seconds; a quicker pace; a share of the
// damage dealt healed.

import type { Hero } from '../types';
import { gearAffixes, maxHpOf } from './attributes';

// Health back over `dt` seconds (none once fallen), never past the most.
export function regenerate(hero: Hero, dt: number): void {
  const regen = gearAffixes(hero).regen;
  if (regen > 0 && hero.hp > 0) hero.hp = Math.min(maxHpOf(hero), hero.hp + (regen / 10) * dt);
}

// How much quicker they go (1: as ever).
export const gearPace = (hero: Pick<Hero, 'equipment'>): number => 1 + gearAffixes(hero).speed;

// A blow of `damage` landed: its share healed.
export function leech(hero: Hero, damage: number): void {
  const share = gearAffixes(hero).leech;
  if (share > 0 && damage > 0 && hero.hp > 0) hero.hp = Math.min(maxHpOf(hero), hero.hp + damage * share);
}
