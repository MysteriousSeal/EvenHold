// The hero's health, level and experience. Health grows with each level;
// each level takes more experience than the last. Hardcore: health never
// comes back by itself, only by eating and drinking (provisions.ts), sleeping
// in a bed, and levelling up, which heals fully.

import type { Hero } from '../types';

const BASE_HP = 10;
const HP_PER_LEVEL = 2;
const SLEEP_RATE = 0.25; // hit points per second while asleep in a bed

export function maxHpAt(level: number): number {
  return BASE_HP + (level - 1) * HP_PER_LEVEL;
}

// Experience from `level` to the next: 30, 45, 60, ...
export function xpToNext(level: number): number {
  return 15 + level * 15;
}

export const HERO_NAME = 'Hero'; // shown over the health bar

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

// Timers, and healing while `asleep` in a bed (nothing else heals over time).
export function recover(hero: Hero, dt: number, asleep = false): void {
  hero.hurtFor = Math.max(0, hero.hurtFor - dt);
  hero.sinceHurt += dt;
  if (asleep) hero.hp = Math.min(maxHpAt(hero.level), hero.hp + SLEEP_RATE * dt);
}
