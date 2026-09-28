// The hero's health, level and experience. Health grows with each level;
// each level takes more experience than the last. Hurt, the hero heals by
// itself once out of the fight for a while. Levelling up heals fully.

import type { EnemyKind, Hero } from './types';

const BASE_HP = 10;
const HP_PER_LEVEL = 2;
const REGEN_DELAY = 5; // seconds after the last hit before healing starts
const REGEN_RATE = 1; // hit points per second while healing

// Damage each kind of enemy deals per blow, and the experience it's worth.
export const ENEMY_DAMAGE: Record<EnemyKind, number> = { wolf: 1, bandit: 2 };
export const ENEMY_XP: Record<EnemyKind, number> = { wolf: 10, bandit: 20 };

export function maxHpAt(level: number): number {
  return BASE_HP + (level - 1) * HP_PER_LEVEL;
}

// Experience from `level` to the next: 30, 45, 60, ...
export function xpToNext(level: number): number {
  return 15 + level * 15;
}

export const FRESH_HERO_STATS = { hp: BASE_HP, level: 1, xp: 0, hurtFor: 0, sinceHurt: Infinity };

// Adds experience; returns how many levels were gained.
export function gainXp(hero: Hero, amount: number): number {
  hero.xp += amount;
  let gained = 0;
  while (hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    gained++;
  }
  if (gained > 0) hero.hp = maxHpAt(hero.level);
  return gained;
}

// Takes `damage` off; returns whether that was the last of the hero's health.
export function hurt(hero: Hero, damage: number): boolean {
  hero.hp = Math.max(0, hero.hp - damage);
  hero.hurtFor = 0.25;
  hero.sinceHurt = 0;
  return hero.hp === 0;
}

// Timers, and healing once it's been a while since the last hit.
export function recover(hero: Hero, dt: number): void {
  hero.hurtFor = Math.max(0, hero.hurtFor - dt);
  hero.sinceHurt += dt;
  if (hero.sinceHurt >= REGEN_DELAY) hero.hp = Math.min(maxHpAt(hero.level), hero.hp + REGEN_RATE * dt);
}
