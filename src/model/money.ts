// Money: the hero's purse, counted in copper pieces (100 copper make a
// silver, 100 silver a gold), and coins dropped on the ground by slain foes,
// picked up just by walking near them.

import { hashUnit } from '../util/random';
import type { Enemy } from './types';

export const COPPER_PER_SILVER = 100;
export const SILVER_PER_GOLD = 100;
export const COIN_PICKUP_RANGE = 0.7; // tiles: close enough to scoop up coins on the way past

// Coins lying on the ground, until picked up.
export interface GroundCoins {
  id: number;
  amount: number; // in copper
  x: number;
  z: number;
  y: number;
}

// A copper amount as gold, silver and copper.
export function coins(copper: number): { gold: number; silver: number; copper: number } {
  const gold = Math.floor(copper / (COPPER_PER_SILVER * SILVER_PER_GOLD));
  const silver = Math.floor(copper / COPPER_PER_SILVER) % SILVER_PER_GOLD;
  return { gold, silver, copper: copper % COPPER_PER_SILVER };
}

// What a slain foe drops, in copper: always a few coins, more from tougher
// foes and from bandits (who carry a purse).
export function coinDrop(enemy: Enemy): number {
  const per = enemy.kind === 'bandit' ? 6 : 3;
  return Math.max(1, Math.round((1 + hashUnit(enemy.id, 0, 92) * 2) * per * enemy.level));
}
