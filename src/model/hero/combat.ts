// The rules of a fight, the hero's side: which foe a blow lands on, what it
// does (their Strength, a critical one with Agility), and what a foe's blow
// does to them (dodged with Agility, less through their armour). The fights
// play them out (fighting.ts: events, loot, knockback, a fall), and the
// hero's own moves (combatMoves.ts: the blow's timing, a roll, the guard)
// come before them.

import { ATTACK_REACH, ENEMY_STATS } from '../constants';
import type { Enemy, Hero } from '../types';
import { blowOf, critChanceOf, dodgeChanceOf, throughArmor } from './attributes';
import { blowDamage, hitTaken, spared } from './blessing';
import { profileOf } from './weaponProfiles';

// The foe a blow lands on, and how far off it is: the focused one whenever it's
// in reach, else the nearest living one within reach and in front (as far either side as the weapon sweeps, and as
// far off as it reaches: weaponProfiles.ts). Never one with something solid between (`clear`: a palisade, a wall; none
// said, nothing is), nor `but` (the one already struck: a sweeping weapon's second).
export function blowTarget(hero: Hero, enemies: readonly Enemy[], focus: Enemy | null, clear: (a: Hero, b: Enemy) => boolean = () => true, but: Enemy | null = null): { target: Enemy; distance: number } | null {
  const weapon = profileOf(hero);
  const front = Math.cos((weapon.arc * Math.PI) / 180);
  const inReach = (enemy: Enemy, d: number) => enemy !== but && enemy.state !== 'dead' && !enemy.buried && d <= ATTACK_REACH + weapon.reach + ENEMY_STATS[enemy.kind].radius && clear(hero, enemy);
  const off = (enemy: Enemy) => Math.hypot(enemy.x - hero.x, enemy.z - hero.z);
  if (focus && inReach(focus, off(focus))) return { target: focus, distance: off(focus) };
  const [fx, fz] = [Math.sin(hero.facing), Math.cos(hero.facing)];
  let best: { target: Enemy; distance: number } | null = null;
  for (const enemy of enemies) {
    const d = off(enemy);
    if (!inReach(enemy, d) || (best && d >= best.distance)) continue;
    if (d > 1e-6 && ((enemy.x - hero.x) * fx + (enemy.z - hero.z) * fz) / d < front) continue;
    best = { target: enemy, distance: d };
  }
  return best;
}

// What a blow of theirs does (as hard as their weapon's kind lands it), `roll` deciding a critical one (double). Not
// rounded (a foe's health takes fractions, as a spell's harm): each kind's harm a second its own, whatever the blow.
export function heroBlow(hero: Hero, roll: number): { damage: number; crit: boolean } {
  const crit = roll < critChanceOf(hero);
  return { damage: blowDamage(hero, blowOf(hero)) * profileOf(hero).harm * (crit ? 2 : 1), crit };
}

// What a foe's blow of `damage` (a foe of `foeLevel`) does to them, `roll` deciding a dodge: nothing then, else what
// gets through their armour and blessings.
export function blowTaken(hero: Hero, damage: number, roll: number, foeLevel = hero.level): { dodged: boolean; damage: number } {
  if (roll < dodgeChanceOf(hero)) return { dodged: true, damage: 0 };
  return { dodged: false, damage: throughArmor(hero, hitTaken(hero, damage), foeLevel, spared(hero)) };
}
