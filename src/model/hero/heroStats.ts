// The hero's health, level and experience. Health grows with each level
// (and with Stamina, and Endurance their energy: attributes.ts);
// each level takes more experience than the last. Hardcore: health never
// comes back by itself, only by eating and drinking (provisions.ts), sleeping
// in a bed, and levelling up, which heals fully.

import type { Hero } from '../types';
import { drainOf, maxEnergyOf, maxHpOf } from './attributes';

const BASE_HP = 10;
const HP_PER_LEVEL = 2;
export const MAX_ENERGY = 100; // a level-1 hero's, with nothing on (more with Endurance: maxEnergyOf)
const ENERGY_SPENT = MAX_ENERGY / (24 * 60); // a second awake (a game minute): all of it over a whole day, 24 hours
const ENERGY_SLEPT = 2; // a second asleep in a bed (or on the floor after a collapse): all of it back in under a minute

// A hero's health at `level`, with nothing on (more with Stamina: maxHpOf).
export function maxHpAt(level: number): number {
  return BASE_HP + (level - 1) * HP_PER_LEVEL;
}

// Experience from `level` to the next: 30, 45, 60, ...
export function xpToNext(level: number): number {
  return 15 + level * 15;
}

// Experience for beating something of `foeLevel` (a foe, or a quest's foes),
// by how it measures up to the hero: full at their own level, more above,
// less and less below, and a token 1 once it's trivial (3 or more below).
export function xpAgainst(xp: number, foeLevel: number, heroLevel: number): number {
  const gap = foeLevel - heroLevel;
  if (gap <= -3) return 1;
  const factor = gap >= 3 ? 1.3 : gap >= 1 ? 1.15 : gap === 0 ? 1 : gap === -1 ? 0.7 : 0.4;
  return Math.max(1, Math.round(xp * factor));
}

export const HERO_NAME = 'Hero'; // shown over the health bar

export const FRESH_HERO_STATS = { hp: BASE_HP, energy: MAX_ENERGY, level: 1, xp: 0, hurtFor: 0 };

// Adds experience; returns how many levels were gained.
export function gainXp(hero: Hero, amount: number): number {
  hero.xp += amount;
  let gained = 0;
  while (hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    gained++;
  }
  if (gained > 0) hero.hp = maxHpOf(hero);
  return gained;
}

// Takes `damage` off; returns whether that was the last of the hero's health.
export function hurt(hero: Hero, damage: number): boolean {
  hero.hp = Math.max(0, hero.hp - damage);
  hero.hurtFor = 0.25;
  return hero.hp === 0;
}

const TIRED = 1 / 4; // of their most energy: under it, tired, a slower walk
const TIRED_PACE = 0.7;

// How much slower the hero walks for being tired (1: not).
export const tiredPace = (hero: Hero): number => (hero.energy < maxEnergyOf(hero) * TIRED ? TIRED_PACE : 1);

// Timers, and energy: spent while up and about, kept `sitting` down,
// slept back `asleep` (lying in a bed, or on the floor after a collapse).
export function recover(hero: Hero, dt: number, asleep = false, sitting = false): void {
  hero.hurtFor = Math.max(0, hero.hurtFor - dt);
  const rate = asleep ? ENERGY_SLEPT : sitting ? 0 : -ENERGY_SPENT * drainOf(hero);
  hero.energy = Math.min(maxEnergyOf(hero), Math.max(0, hero.energy + rate * dt));
  // A drink being sipped: its health back a little at a time, all of it once it's empty.
  const drink = hero.drinking;
  if (drink) {
    const step = Math.min(dt, drink.left);
    hero.hp = Math.min(maxHpOf(hero), hero.hp + (drink.heal * step) / drink.seconds);
    drink.left -= step;
    if (drink.left <= 0) hero.drinking = null;
  }
}

// Starts sipping a drink worth `heal` health over `seconds` (stopped by
// setting hero.drinking to null: what's left is left).
export function startDrinking(hero: Hero, heal: number, seconds: number): void {
  hero.drinking = { heal, left: seconds, seconds };
}
