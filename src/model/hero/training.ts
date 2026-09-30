// The hero's stat points, as Elden Ring's: a point (POINTS_PER_LEVEL) to spend with
// each level gained (heroStats.ts gainXp), on Strength, Agility, Stamina or
// Endurance, in the level-up window (P); a stat grows only as they choose.
// Spending is planned first, then confirmed, all at once.

import type { Hero } from '../types';
import { STATS, type Stat } from './statKinds';

export const POINTS_PER_LEVEL = 1;

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

// Every point spent, back to spend again (a cheat).
export function refundPoints(hero: Hero): void {
  hero.statPoints += STATS.reduce((sum, s) => sum + hero.trained[s], 0);
  hero.trained = untrained();
}
