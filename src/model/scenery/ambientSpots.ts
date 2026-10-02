// Where the small life of the wilds is (drawn round the hero:
// view/meshes/wildlife/ambientLife.ts), from the seed, patch by patch of
// ground (LIFE_CELL tiles a side): butterflies over a meadow, a little flock
// of songbirds on open grass, fireflies; each where on open, natural ground,
// and its own roll. And when they're out: the butterflies and the birds by
// day, the fireflies from dusk through the night. Kept here so what's drawn
// and what's looked for (the cheats' Sights) are the one.

import { hashUnit } from '../../util/random';
import { hourAt } from '../clock';
import { createMeadowDensity } from '../worldgen/meadows';
import type { Surface } from '../types';

export const LIFE_CELL = 6; // tiles a side of each patch of ground
export type LifeKind = 'butterfly' | 'bird' | 'firefly';

export interface LifeSpot {
  kind: LifeKind;
  x: number; // its home, where it wanders round
  z: number;
  seed: number; // its own rolls (0..1)
}

export interface LifeWorld {
  seed: number;
  surfaceMap: readonly (readonly Surface[])[];
  isOpenTile(x: number, z: number): boolean;
}

// Whether `kind` is out at `minutes`.
export function lifeOut(kind: LifeKind, minutes: number): boolean {
  const hour = hourAt(minutes);
  return kind === 'firefly' ? hour >= 19 || hour < 5.5 : hour >= 6.5 && hour < 19.5;
}

// The hour each comes out at its best (for the cheats: noon for the day's, ten at night for the fireflies).
export const LIFE_HOUR: Record<LifeKind, number> = { butterfly: 12, bird: 12, firefly: 22 };

// What lives in patch (cx, cz).
export function lifeIn(world: LifeWorld, cx: number, cz: number, meadow = createMeadowDensity(world.seed)): LifeSpot[] {
  const roll = (salt: number) => hashUnit(cx, cz, world.seed + salt);
  const out: LifeSpot[] = [];
  const spot = (salt: number) => {
    const [x, z] = [Math.floor(cx * LIFE_CELL + roll(salt) * LIFE_CELL), Math.floor(cz * LIFE_CELL + roll(salt + 1) * LIFE_CELL)];
    return world.isOpenTile(x, z) && world.surfaceMap[x]?.[z] === 'natural' ? { x: x + 0.5, z: z + 0.5 } : null;
  };
  const add = (kind: LifeKind, count: number, salt: number, spread: number) => {
    const at = spot(salt);
    if (!at) return;
    for (let i = 0; i < count; i++) {
      out.push({ kind, x: at.x + (hashUnit(i, cx, world.seed + salt + 4) - 0.5) * spread, z: at.z + (hashUnit(i, cz, world.seed + salt + 5) - 0.5) * spread, seed: hashUnit(cx * 7 + i, cz * 11, world.seed + salt + 3) });
    }
  };
  const lush = meadow(cx * LIFE_CELL + LIFE_CELL / 2, cz * LIFE_CELL + LIFE_CELL / 2);
  if (roll(11) < 0.15 + lush * 0.35) add('butterfly', 1 + Math.floor(roll(12) * 3), 13, 2);
  if (roll(21) < 0.14) add('bird', 2 + Math.floor(roll(22) * 4), 23, 1.6);
  if (roll(31) < 0.3 + lush * 0.3) add('firefly', 3 + Math.floor(roll(32) * 6), 33, 4);
  return out;
}
