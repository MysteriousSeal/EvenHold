// How tough an enemy is: its level rises with how far from spawn it lives
// (a level every LEVEL_DISTANCE tiles, give or take one), and each level
// adds health, damage and the experience it's worth.

import { ENEMY_STATS } from '../constants';
import type { EnemyKind } from '../types';
import { hashUnit } from '../../util/random';

const LEVEL_DISTANCE = 50; // tiles from spawn per level
const HP_PER_LEVEL = 0.2; // +20% of the base per level
const DAMAGE_PER_LEVEL = 0.15;
const XP_PER_LEVEL = 0.25;

// The level of an enemy living at (x, z), with a little spread per enemy.
export function enemyLevel(spawn: { x: number; z: number }, x: number, z: number, id: number): number {
  const base = 1 + Math.hypot(x - spawn.x, z - spawn.z) / LEVEL_DISTANCE;
  const spread = Math.floor(hashUnit(id, Math.round(x), 81) * 3) - 1; // -1, 0 or +1
  return Math.max(1, Math.floor(base) + spread);
}

// What a `kind` of enemy at `level` has: health, damage per blow, experience.
export function enemyPower(kind: EnemyKind, level: number): { maxHp: number; damage: number; xp: number } {
  const stats = ENEMY_STATS[kind];
  const up = level - 1;
  return {
    maxHp: Math.round(stats.hp * (1 + up * HP_PER_LEVEL)),
    damage: Math.max(1, Math.round(stats.damage * (1 + up * DAMAGE_PER_LEVEL))),
    xp: Math.round(stats.xp * (1 + up * XP_PER_LEVEL)),
  };
}
