// What the hero's stats (statKinds.ts) come to, and what they do. Each
// starts at 0, and is what points they've spent on it (training.ts), plus
// what their gear adds (each item's `stats`); armour is only gear's. Health
// grows with each level too (2 a level). A level-1 hero with nothing on is as they always were:
// - Strength: harder blows, a point more damage for every 3.
// - Agility: a chance to dodge a blow, and to land a critical one (double
//   damage): a hundredth each a point, at most CHANCE_CAP.
// - Stamina: more health, 2 a point.
// - Endurance: more energy, 5 a point, and spent slower.
// - Armour: a point less from each blow taken for every 5 (never under 1).
// Each piece's armour and stats grow with its level, and its rarity adds lines (human/items/gear.ts): more of a stat
// or armour, or a special one: crit and dodge (on Agility's, under the same cap), health back over time, pace, life
// on hit (gearAffixes).

import { HERO_DAMAGE } from '../constants';
import { AFFIXES, gearSpecs, noSpecs, type Affix, type GearSpecs } from '../human/items/gear';
import type { Hero } from '../types';
import { STATS, type Stat } from './statKinds';

const STRENGTH_PER_DAMAGE = 3;
const HP_PER_STAMINA = 2;
const HP_PER_LEVEL = 2;
const BASE_HP = 10;
const BASE_ENERGY = 100;
const ENERGY_PER_ENDURANCE = 5;
const CHANCE_PER_AGILITY = 0.01;
const CHANCE_CAP = 0.4;
const ARMOR_PER_DAMAGE = 5;

type Wearing = Pick<Hero, 'level' | 'equipment' | 'trained'>;

// Health at `level`, with nothing on and no points in Stamina.
export const maxHpAt = (level: number): number => BASE_HP + HP_PER_LEVEL * (level - 1);

// What all they wear gives, added up once for what they wear (asked each frame: their pace, their health back),
// again only once that changes. (Not to be changed by those asking.)
const worn = new WeakMap<Hero['equipment'], { pieces: string; specs: GearSpecs }>();
function wornSpecs(hero: Pick<Hero, 'equipment'>): GearSpecs {
  const pieces = Object.values(hero.equipment).join('|');
  const kept = worn.get(hero.equipment);
  if (kept?.pieces === pieces) return kept.specs;
  const specs = noSpecs();
  for (const item of Object.values(hero.equipment)) {
    if (!item) continue;
    const g = gearSpecs(item);
    specs.armor += g.armor;
    for (const s of STATS) specs.stats[s] += g.stats[s];
    for (const a of AFFIXES) specs.affixes[a] += g.affixes[a];
  }
  worn.set(hero.equipment, { pieces, specs });
  return specs;
}

// What their gear adds to each stat.
export const gearStats = (hero: Pick<Hero, 'equipment'>): Readonly<Record<Stat, number>> => wornSpecs(hero).stats;

// What their gear's special lines come to, all told (none: 0 each).
export const gearAffixes = (hero: Pick<Hero, 'equipment'>): Readonly<Record<Affix, number>> => wornSpecs(hero).affixes;

// Each stat, all told: the points they've spent on it, and their gear's.
export function statsOf(hero: Wearing): Record<Stat, number> {
  const gear = gearStats(hero);
  return Object.fromEntries(STATS.map((s) => [s, (hero.trained?.[s] ?? 0) + gear[s]])) as Record<Stat, number>;
}

export const armorOf = (hero: Pick<Hero, 'equipment'>): number => wornSpecs(hero).armor;

export const maxHpOf = (hero: Wearing): number => maxHpAt(hero.level) + HP_PER_STAMINA * statsOf(hero).stamina;
export const maxEnergyOf = (hero: Wearing): number => BASE_ENERGY + ENERGY_PER_ENDURANCE * statsOf(hero).endurance;
// How fast energy's spent (1: as ever): a twentieth slower for each point of Endurance.
export const drainOf = (hero: Wearing): number => 1 / (1 + 0.05 * statsOf(hero).endurance);

export const blowOf = (hero: Wearing): number => HERO_DAMAGE + Math.floor(statsOf(hero).strength / STRENGTH_PER_DAMAGE);
const chance = (hero: Wearing, more: number) => Math.min(CHANCE_CAP, statsOf(hero).agility * CHANCE_PER_AGILITY + more);
export const dodgeChanceOf = (hero: Wearing): number => chance(hero, gearAffixes(hero).dodge);
export const critChanceOf = (hero: Wearing): number => chance(hero, gearAffixes(hero).crit);

// A blow of `damage` as it lands through their armour.
export const throughArmor = (hero: Pick<Hero, 'equipment'>, damage: number): number => Math.max(1, damage - Math.floor(armorOf(hero) / ARMOR_PER_DAMAGE));

// Health and energy no more than their most (after gear came off, or points were had back).
export function fitToMost(hero: Hero): void {
  hero.hp = Math.min(hero.hp, maxHpOf(hero));
  hero.energy = Math.min(hero.energy, maxEnergyOf(hero));
}
