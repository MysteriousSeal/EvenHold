// Money: the hero's purse, counted in copper pieces (100 copper make a
// silver, 100 silver a gold), and coins dropped on the ground by slain foes,
// picked up just by walking near them.

import { ENEMY_STATS } from '../constants';
import { hashUnit } from '../../util/random';
import type { Enemy } from '../types';

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

// Picks up the coins within reach of (x, z), returning how much they came to.
export function collectCoins(piles: GroundCoins[], x: number, z: number): number {
  let total = 0;
  for (let i = piles.length - 1; i >= 0; i--) {
    if (Math.hypot(piles[i].x - x, piles[i].z - z) > COIN_PICKUP_RANGE) continue;
    total += piles[i].amount;
    piles.splice(i, 1);
  }
  return total;
}

// A copper amount as gold, silver and copper.
export function coins(copper: number): { gold: number; silver: number; copper: number } {
  const gold = Math.floor(copper / (COPPER_PER_SILVER * SILVER_PER_GOLD));
  const silver = Math.floor(copper / COPPER_PER_SILVER) % SILVER_PER_GOLD;
  return { gold, silver, copper: copper % COPPER_PER_SILVER };
}

// What a slain foe drops, in copper: always a few coins, more from tougher
// foes, and by kind (constants.ts ENEMY_STATS coins: bandits carry a purse).
export function coinDrop(enemy: Enemy): number {
  const per = ENEMY_STATS[enemy.kind].coins;
  return Math.max(1, Math.round((1 + hashUnit(enemy.id, 0, 92) * 2) * per * enemy.level));
}
