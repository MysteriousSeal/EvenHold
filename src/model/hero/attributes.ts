// What the hero's stats (statKinds.ts) come to, and what they do. Each
// starts at 0, and is a point more for each level past the first, plus what
// their gear adds (each item's `stats`); armour is only gear's. A level-1
// hero with nothing on is as they always were:
// - Strength: harder blows, a point more damage for every 3.
// - Agility: a chance to dodge a blow, and to land a critical one (double
//   damage): a hundredth each a point, at most CHANCE_CAP.
// - Stamina: more health, 2 a point (so 2 a level, as ever).
// - Endurance: more energy, 5 a point, and spent slower.
// - Armour: a point less from each blow taken for every 5 (never under 1).

import { HERO_DAMAGE } from '../constants';
import { ITEMS } from '../human/equipment';
import type { Hero } from '../types';
import { STATS, type Stat } from './statKinds';

const STRENGTH_PER_DAMAGE = 3;
const HP_PER_STAMINA = 2;
const BASE_HP = 10;
const BASE_ENERGY = 100;
const ENERGY_PER_ENDURANCE = 5;
const CHANCE_PER_AGILITY = 0.01;
const CHANCE_CAP = 0.4;
const ARMOR_PER_DAMAGE = 5;

type Wearing = Pick<Hero, 'level' | 'equipment'>;

// What their gear adds to each stat.
export function gearStats(hero: Pick<Hero, 'equipment'>): Record<Stat, number> {
  const bonus = Object.fromEntries(STATS.map((s) => [s, 0])) as Record<Stat, number>;
  for (const item of Object.values(hero.equipment)) {
    for (const [stat, n] of Object.entries(item ? (ITEMS[item].stats ?? {}) : {})) bonus[stat as Stat] += n;
  }
  return bonus;
}

// Each stat, all told: their level's, and their gear's.
export function statsOf(hero: Wearing): Record<Stat, number> {
  const gear = gearStats(hero);
  return Object.fromEntries(STATS.map((s) => [s, hero.level - 1 + gear[s]])) as Record<Stat, number>;
}

export const armorOf = (hero: Pick<Hero, 'equipment'>): number => Object.values(hero.equipment).reduce((sum, item) => sum + (item ? (ITEMS[item].armor ?? 0) : 0), 0);

export const maxHpOf = (hero: Wearing): number => BASE_HP + HP_PER_STAMINA * statsOf(hero).stamina;
export const maxEnergyOf = (hero: Wearing): number => BASE_ENERGY + ENERGY_PER_ENDURANCE * statsOf(hero).endurance;
// How fast energy's spent (1: as ever): a twentieth slower for each point of Endurance.
export const drainOf = (hero: Wearing): number => 1 / (1 + 0.05 * statsOf(hero).endurance);

export const blowOf = (hero: Wearing): number => HERO_DAMAGE + Math.floor(statsOf(hero).strength / STRENGTH_PER_DAMAGE);
const chance = (hero: Wearing) => Math.min(CHANCE_CAP, statsOf(hero).agility * CHANCE_PER_AGILITY);
export const dodgeChanceOf = chance;
export const critChanceOf = chance;

// A blow of `damage` as it lands through their armour.
export const throughArmor = (hero: Pick<Hero, 'equipment'>, damage: number): number => Math.max(1, damage - Math.floor(armorOf(hero) / ARMOR_PER_DAMAGE));
