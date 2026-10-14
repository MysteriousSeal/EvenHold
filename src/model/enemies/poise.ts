// How a foe takes a blow (its poise): whether it's knocked out of its own. The light (a wolf, a bandit, a bat, a lynx,
// a runner, the bowmen) by every blow; the steadier (a boar, a bruiser, a skeleton, a ghost, a worm) by the second
// within POISE_WINDOW of the first; the heavy (a bear, a chief, a draugr, every boss) never by a plain blow, only
// caught open: parried (reeling, hero/combatMoves.ts), or struck just after the hero's roll. Not flinching, it
// barely flashes (SHRUG_FLASH: too little to lose a told move by) and its blow comes on.
import { isBoss } from './enemyLevels';
import type { Enemy, EnemyKind } from '../types';

const STEADY: Partial<Record<EnemyKind, number>> = { boar: 2, bruiser: 2, skeleton: 2, ghost: 2, caveWorm: 2, bear: Infinity, banditChief: Infinity, draugr: Infinity }; // blows to flinch it (none said: 1; a boss: never)
const POISE_WINDOW = 1.5; // seconds after a blow that the next counts toward flinching it (longer: its poise back)
export const SHRUG_FLASH = 0.15; // seconds a foe that shrugs a blow off flashes (under a told move's 0.2: not lost by it)

export const blowsToFlinch = (kind: EnemyKind): number => (isBoss(kind) ? Infinity : STEADY[kind] ?? 1);

const taken = new WeakMap<Enemy, { blows: number; at: number }>(); // (each foe's blows lately: gone with the foe)

// A blow landed on `foe` at `now` (seconds of play): whether it flinches (its own blow lost); `open`: caught open,
// whatever its poise (parried, punished after a roll).
export function flinches(foe: Enemy, now: number, open: boolean): boolean {
  const need = blowsToFlinch(foe.kind);
  if (open || need <= 1) return true;
  const last = taken.get(foe);
  const blows = (last && now - last.at <= POISE_WINDOW ? last.blows : 0) + 1;
  const flinched = blows >= need;
  taken.set(foe, { blows: flinched ? 0 : blows, at: now });
  return flinched;
}
