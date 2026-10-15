// The purse dropped in a fall (setbacks.ts fall), the Souls way: half the coin the hero carried lies where they fell,
// in a purse with a glow over it (seen from afar: view/meshes/loot/purseView.ts; on the map), outdoors or down in the
// dungeon they fell in. Walk back to it and it's all theirs again. Fall again before they do, and that first purse is
// lost for good: the new fall's own purse lies where they fell this time (half of what they had left). Kept in the
// save, as one thing, apart from the coins lying about (never scooped up by another's hand, never a pile among piles).

import type { GameEvent, Hero } from '../types';

export const PURSE_SHARE = 0.5; // of the coin they carry, dropped in a fall
export const PURSE_REACH = 0.9; // tiles (a dungeon's: room tiles) from it to pick it up, walking over it

export interface Purse {
  amount: number; // in copper
  x: number; // where it lies: on the map outdoors, on the dungeon's own floor below
  z: number;
  under: string | null; // the key of the dungeon it lies in (GameModel.below.key); null, outdoors
}

interface Fallen {
  hero: Pick<Hero, 'x' | 'z' | 'money'>;
  purse: Purse | null;
  inside: { entrance: { x: number; z: number }; below?: { x: number; z: number } | null } | null;
  below: { key: string } | null;
}

// Half their coin dropped as a purse where they fell (the last one, if still lying there, lost); the purse, or none
// (nothing to drop).
export function dropPurse(m: Fallen): Purse | null {
  const amount = Math.floor(m.hero.money * PURSE_SHARE);
  m.hero.money -= amount;
  // (Down a dungeon: on its floor where they lay; in any other room (no foe falls them there, but a cheat might): at its
  // door outside.)
  const at = m.below || !m.inside ? m.hero : (m.inside.below ?? m.inside.entrance);
  m.purse = amount > 0 ? { amount, x: at.x, z: at.z, under: m.below?.key ?? null } : null;
  return m.purse;
}

// Their purse picked up, walked over where it lies (outdoors, or down the dungeon it's in); how much it held (none:
// not here).
export function reclaimPurse(m: Fallen & { report(event: GameEvent): void }): number {
  const { purse, hero } = m;
  const here = m.below ? m.below.key : m.inside ? undefined : null;
  if (!purse || purse.under !== here || Math.hypot(purse.x - hero.x, purse.z - hero.z) > PURSE_REACH) return 0;
  hero.money += purse.amount;
  m.purse = null;
  m.report({ kind: 'coins', amount: purse.amount });
  m.report({ kind: 'banner', title: 'Your purse, found', line: 'Every coin of it, back where it belongs' });
  return purse.amount;
}

// A save's purse, as far as it's sound; else none.
export function readPurse(saved: unknown): Purse | null {
  const p = (saved && typeof saved === 'object' ? saved : {}) as Record<string, unknown>;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (!Number.isInteger(p.amount) || (p.amount as number) <= 0 || !finite(p.x) || !finite(p.z) || (p.under !== null && typeof p.under !== 'string')) return null;
  return { amount: p.amount as number, x: p.x, z: p.z, under: p.under as string | null };
}
