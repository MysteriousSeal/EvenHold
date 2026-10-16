// What the hero's stats (statKinds.ts) come to, and what they do. Each
// starts at 0, and is what points they've spent on it (training.ts), plus
// what their gear adds (each item's `stats`); armour is only gear's. Health
// grows with each level too (2 a level, from 14). Gear's Strength and Stamina add flat; the points trained in them
// multiply (a build's choice, whatever the kit). With nothing on and no points spent:
// - Strength: harder blows: gear's a point more damage for every GEAR_STRENGTH_PER_DAMAGE; each trained point
//   STRENGTH_SHARE more of it all.
// - Agility: a chance to dodge a blow, and to land a critical one (double
//   damage): a hundredth each a point, at most CHANCE_CAP (gear's alone GEAR_CHANCE_CAP: room left for points).
// - Stamina: more health: gear's 2 a point; each trained point STAMINA_HEALTH more of it all, and STAMINA_GUARD less
//   of a blow taken (GUARD_CAP at most).
// - Endurance: more energy, 5 a point, and spent slower.
// - Armour: a share off each blow taken, armour / (armour + ARMOR_EASE + ARMOR_EASE_PER_LEVEL a level of the foe's)
//   (the stronger the foe, the less it takes off), a blessing's share with it, SPARED_CAP at most (never under 1).
// Each piece's armour and stats grow with its level, and its rarity adds lines (human/items/gear.ts): more of a stat
// or armour, or a special one: crit and dodge (on Agility's, under the same cap), health back over time, pace, life
// on hit (gearAffixes).

import { brokenKey, isBroken } from './wear';
import { HERO_DAMAGE } from '../constants';
import { AFFIXES, gearSpecs, noSpecs, type Affix, type GearSpecs } from '../human/items/gear';
import type { Hero } from '../types';
import { STATS, type Stat } from './statKinds';

const GEAR_STRENGTH_PER_DAMAGE = 4; // (3 when a level gave 1 point, and Strength trained added as gear's does)
const STRENGTH_SHARE = 0.04; // more damage, a trained point
const HP_PER_STAMINA = 2;
const STAMINA_HEALTH = 0.03; // more health, a trained point
const STAMINA_GUARD = 0.01; // less of a blow taken, a trained point
const GUARD_CAP = 0.25;
const HP_PER_LEVEL = 2;
const BASE_HP = 14; // (10 was a fresh hero two bites of a lynx from falling, with no way to heal on the road)
const BASE_ENERGY = 100;
const ENERGY_PER_ENDURANCE = 5;
const CHANCE_PER_AGILITY = 0.01;
const CHANCE_CAP = 0.25; // (more, stacked on a quick blow, made everything a walk once gear could reach it)
const GEAR_CHANCE_CAP = 0.15; // (gear alone reached the cap: Agility trained came to nothing)
const ARMOR_EASE = 26; // (a smith's kit, some 30 of it, takes some 35% off a level-5 foe's blows)
const ARMOR_EASE_PER_LEVEL = 6;
export const SPARED_CAP = 0.6; // the most of a blow armour and blessings together take off

type Wearing = Pick<Hero, 'level' | 'equipment' | 'trained'>;

// Health at `level`, with nothing on and no points in Stamina.
export const maxHpAt = (level: number): number => BASE_HP + HP_PER_LEVEL * (level - 1);

// What all they wear gives, added up once for what they wear (asked each frame: their pace, their health back),
// again only once that changes. (Not to be changed by those asking.)
// A broken piece gives nothing (hero/wear.ts).
const worn = new WeakMap<Hero['equipment'], { pieces: string; specs: GearSpecs }>();
function wornSpecs(hero: Pick<Hero, 'equipment'> & { wear?: Hero['wear'] }): GearSpecs {
  const pieces = `${Object.values(hero.equipment).join('|')}/${brokenKey(hero)}`;
  const kept = worn.get(hero.equipment);
  if (kept?.pieces === pieces) return kept.specs;
  const specs = noSpecs();
  for (const item of Object.values(hero.equipment)) {
    if (!item || isBroken(hero, item)) continue;
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

const trainedIn = (hero: Wearing, stat: Stat): number => hero.trained?.[stat] ?? 0;

export const maxHpOf = (hero: Wearing): number => Math.round((maxHpAt(hero.level) + HP_PER_STAMINA * gearStats(hero).stamina) * (1 + STAMINA_HEALTH * trainedIn(hero, 'stamina')));
// The share of a blow their trained Stamina takes off (with armour's and blessings', under SPARED_CAP).
export const guardOf = (hero: Wearing): number => Math.min(GUARD_CAP, STAMINA_GUARD * trainedIn(hero, 'stamina'));
export const maxEnergyOf = (hero: Wearing): number => BASE_ENERGY + ENERGY_PER_ENDURANCE * statsOf(hero).endurance;
// How fast energy's spent (1: as ever): a twentieth slower for each point of Endurance.
export const drainOf = (hero: Wearing): number => 1 / (1 + 0.05 * statsOf(hero).endurance);

// A blow's damage before its weapon's kind (fractional: shown rounded).
export const blowOf = (hero: Wearing): number => (HERO_DAMAGE + gearStats(hero).strength / GEAR_STRENGTH_PER_DAMAGE) * (1 + STRENGTH_SHARE * trainedIn(hero, 'strength'));
const chance = (hero: Wearing, more: number) => Math.min(CHANCE_CAP, Math.min(GEAR_CHANCE_CAP, gearStats(hero).agility * CHANCE_PER_AGILITY + more) + trainedIn(hero, 'agility') * CHANCE_PER_AGILITY);
export const dodgeChanceOf = (hero: Wearing): number => chance(hero, gearAffixes(hero).dodge);
export const critChanceOf = (hero: Wearing): number => chance(hero, gearAffixes(hero).crit);

// The share of a blow from a foe of `foeLevel` their armour takes off.
export const armorShare = (hero: Pick<Hero, 'equipment'>, foeLevel: number): number => armorOf(hero) / (armorOf(hero) + ARMOR_EASE + ARMOR_EASE_PER_LEVEL * foeLevel);

// A blow of `damage` from a foe of `foeLevel` as it lands through their armour, and `more` off (a blessing's share),
// SPARED_CAP off at most, never under 1.
export const throughArmor = (hero: Pick<Hero, 'equipment'>, damage: number, foeLevel: number, more = 0): number =>
  Math.max(1, Math.round(damage * (1 - Math.min(SPARED_CAP, armorShare(hero, foeLevel) + more))));

// Health and energy no more than their most (after gear came off, or points were had back).
export function fitToMost(hero: Hero): void {
  hero.hp = Math.min(hero.hp, maxHpOf(hero));
  hero.energy = Math.min(hero.energy, maxEnergyOf(hero));
}
