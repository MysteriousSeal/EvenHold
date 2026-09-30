// The hero's stat points, as Elden Ring's: a point (POINTS_PER_LEVEL) to spend with
// each level gained (heroStats.ts gainXp), on Strength, Agility, Stamina or
// Endurance, in the level-up window (P); a stat grows only as they choose.
// Spending is planned first, then confirmed, all at once. Every point spent
// can be had back to spend again, for coin: RESET_PER_LEVEL a level.

import type { Hero } from '../types';
import { maxEnergyOf, maxHpOf } from './attributes';
import { STATS, type Stat } from './statKinds';

export const POINTS_PER_LEVEL = 1;
export const RESET_PER_LEVEL = 50; // copper, a level: what having every point back costs

// What having every point back costs at `level`.
export const resetCost = (level: number): number => RESET_PER_LEVEL * level;

// No points in anything: a new hero's.
export const untrained = (): Record<Stat, number> => Object.fromEntries(STATS.map((s) => [s, 0])) as Record<Stat, number>;

// Spends points as `plan` says (how many on each stat); returns whether it could (they had that many).
export function spendPoints(hero: Hero, plan: Partial<Record<Stat, number>>): boolean {
  const total = STATS.reduce((sum, s) => sum + (plan[s] ?? 0), 0);
  if (total <= 0 || total > hero.statPoints || STATS.some((s) => (plan[s] ?? 0) < 0 || !Number.isInteger(plan[s] ?? 0))) return false;
  for (const s of STATS) hero.trained[s] += plan[s] ?? 0;
  hero.statPoints -= total;
  return true;
}

// Every point spent, back to spend again (for free: a cheat); health and energy no more than their new most.
export function refundPoints(hero: Hero): void {
  hero.statPoints += STATS.reduce((sum, s) => sum + hero.trained[s], 0);
  hero.trained = untrained();
  hero.hp = Math.min(hero.hp, maxHpOf(hero));
  hero.energy = Math.min(hero.energy, maxEnergyOf(hero));
}

// Every point spent back, for resetCost: why not, if not (none spent, or they're short).
export function resetPoints(hero: Hero): 'reset' | 'none' | 'too poor' {
  if (STATS.every((s) => hero.trained[s] === 0)) return 'none';
  const cost = resetCost(hero.level);
  if (hero.money < cost) return 'too poor';
  hero.money -= cost;
  refundPoints(hero);
  return 'reset';
}
