// The hero's health, level and experience. Health grows with each level
// (and with Stamina, and Endurance their energy: attributes.ts);
// each level takes more experience than the last. Hardcore: health never
// comes back by itself, only by eating and drinking (provisions.ts), sleeping
// in a bed, and levelling up, which heals fully.

import { DAY_MINUTES } from '../clock';
import type { Hero, Meal } from '../types';
import { drainOf, maxEnergyOf, maxHpAt, maxHpOf } from './attributes';
import { POINTS_PER_LEVEL } from './training';

export const MAX_ENERGY = 100; // a level-1 hero's, with nothing on (more with Endurance: maxEnergyOf)
const ENERGY_SPENT = MAX_ENERGY / DAY_MINUTES; // a second awake (a game minute): all of it over a whole day, 24 hours
const ENERGY_SLEPT = 2; // a second asleep in a bed (or on the floor after a collapse): all of it back in under a minute

export { maxHpAt }; // a hero's health at `level`, with nothing on and no Stamina (more with it: maxHpOf)

// Experience from `level` to the next, paced for level 10 after about three
// hours: what a hero earns a minute at that level (foes and quests pay more
// as they go up, about 50 + 7 a level) times the minutes the level should
// take (3 at first, 4 more each level): 171, 448, 781, 1170, 1615 …
export function xpToNext(level: number): number {
  return (50 + 7 * level) * (4 * level - 1);
}

// Experience for beating something of `foeLevel` (a foe, or a quest's foes),
// by how it measures up to the hero: full at their own level, more above,
// less and less below (a little still at 3 and 4 below: what's about once
// the hero's outgrown a place), and a token 1 once it's trivial (TRIVIAL below).
export const TRIVIAL = 5; // levels below the hero, a foe's worth only a token
export function xpAgainst(xp: number, foeLevel: number, heroLevel: number): number {
  const gap = foeLevel - heroLevel;
  if (gap <= -TRIVIAL) return 1;
  const below = [1, 0.75, 0.55, 0.35, 0.2]; // by levels below: 0, 1, 2, 3, 4
  const factor = gap >= 3 ? 1.3 : gap >= 1 ? 1.15 : below[-gap];
  return Math.max(1, Math.round(xp * factor));
}

export const HERO_NAME = 'Hero'; // shown over the health bar

export const FRESH_HERO_STATS = { hp: maxHpAt(1), energy: MAX_ENERGY, level: 1, xp: 0, hurtFor: 0, statPoints: 0 }; // (and `trained`: untrained(), its own)

// Adds experience; returns how many levels were gained (each, points to spend on their stats).
export function gainXp(hero: Hero, amount: number): number {
  hero.xp += amount;
  let gained = 0;
  while (hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level++;
    gained++;
  }
  hero.statPoints += gained * POINTS_PER_LEVEL;
  if (gained > 0) hero.hp = maxHpOf(hero);
  return gained;
}

// Takes `damage` off; returns whether that was the last of the hero's health.
export function hurt(hero: Hero, damage: number): boolean {
  hero.hp = Math.max(0, hero.hp - damage);
  hero.hurtFor = 0.25;
  return hero.hp === 0;
}

export const TIRED = 25; // energy: under it, tired, a slower walk (whatever their most: Endurance only gives more before it)
const TIRED_PACE = 0.7;

// How much slower the hero walks for being tired (1: not).
export const tiredPace = (hero: Hero): number => (hero.energy < TIRED ? TIRED_PACE : 1);

// Timers, and energy: spent while up and about, kept `sitting` down,
// slept back `asleep` (lying in a bed, or on the floor after a collapse).
export function recover(hero: Hero, dt: number, asleep = false, sitting = false): void {
  hero.hurtFor = Math.max(0, hero.hurtFor - dt);
  const rate = asleep ? ENERGY_SLEPT : sitting ? 0 : -ENERGY_SPENT * drainOf(hero);
  hero.energy = Math.min(maxEnergyOf(hero), Math.max(0, hero.energy + rate * dt));
  // A drink being sipped at the bar (or a pie eaten), and food or drink from the bag: health and energy back a little
  // at a time, all of it once it's done.
  hero.potionCooldown = Math.max(0, (hero.potionCooldown ?? 0) - dt); // (another potion, in a while)
  hero.drinking = restoring(hero, hero.drinking, dt);
  hero.eating = restoring(hero, hero.eating, dt);
}

function restoring(hero: Hero, meal: Meal | null | undefined, dt: number): Meal | null | undefined {
  if (!meal) return meal;
  const step = Math.min(dt, meal.left);
  hero.hp = Math.min(maxHpOf(hero), hero.hp + (meal.heal * step) / meal.seconds);
  hero.energy = Math.min(maxEnergyOf(hero), hero.energy + ((meal.energy ?? 0) * step) / meal.seconds);
  meal.left -= step;
  return meal.left <= 0 ? null : meal;
}

// Starts sipping a drink (or eating, a pie at the bar) worth `heal` health and `energy` over
// `seconds` (stopped by setting hero.drinking to null: what's left is left).
export function startDrinking(hero: Hero, seconds: number, { heal = 0, energy = 0 }: { heal?: number; energy?: number }): void {
  hero.drinking = { heal, energy, left: seconds, seconds };
}
