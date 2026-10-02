// The rules of a fight, the hero's side: which foe a blow lands on, what it
// does (their Strength, a critical one with Agility), and what a foe's blow
// does to them (dodged with Agility, less through their armour). The fights
// play them out (fighting.ts: events, loot, knockback, a fall), and the
// hero's own moves (combatMoves.ts: the blow's timing, a roll, the guard)
// come before them.

import { ATTACK_REACH, ENEMY_STATS } from '../constants';
import type { Enemy, Hero } from '../types';
import { blowOf, critChanceOf, dodgeChanceOf, throughArmor } from './attributes';
import { blowDamage, hitTaken } from './blessing';

const FRONT = Math.cos((70 * Math.PI) / 180); // a blow reaches this far to either side of the hero's facing

// The foe a blow lands on, and how far off it is: the focused one whenever it's
// in reach, else the nearest living one within reach and roughly in front.
export function blowTarget(hero: Hero, enemies: readonly Enemy[], focus: Enemy | null): { target: Enemy; distance: number } | null {
  const inReach = (enemy: Enemy, d: number) => enemy.state !== 'dead' && d <= ATTACK_REACH + ENEMY_STATS[enemy.kind].radius;
  const off = (enemy: Enemy) => Math.hypot(enemy.x - hero.x, enemy.z - hero.z);
  if (focus && inReach(focus, off(focus))) return { target: focus, distance: off(focus) };
  const [fx, fz] = [Math.sin(hero.facing), Math.cos(hero.facing)];
  let best: { target: Enemy; distance: number } | null = null;
  for (const enemy of enemies) {
    const d = off(enemy);
    if (!inReach(enemy, d) || (best && d >= best.distance)) continue;
    if (d > 1e-6 && ((enemy.x - hero.x) * fx + (enemy.z - hero.z) * fz) / d < FRONT) continue;
    best = { target: enemy, distance: d };
  }
  return best;
}

// What a blow of theirs does, `roll` deciding a critical one (double).
export function heroBlow(hero: Hero, roll: number): { damage: number; crit: boolean } {
  const crit = roll < critChanceOf(hero);
  return { damage: blowDamage(hero, blowOf(hero)) * (crit ? 2 : 1), crit };
}

// What a foe's blow of `damage` does to them, `roll` deciding a dodge: nothing then, else what gets through their armour.
export function blowTaken(hero: Hero, damage: number, roll: number): { dodged: boolean; damage: number } {
  if (roll < dodgeChanceOf(hero)) return { dodged: true, damage: 0 };
  return { dodged: false, damage: throughArmor(hero, hitTaken(hero, damage)) };
}
