// Where each boss's fight turns, as shares of its health (falling): the strongholds' four wings' bosses and their king
// (strongholds/: each one's `under`), a crypt's lord his call at half (crypts/cryptLord.ts), the brood mother her
// broods (caves/caveFoes.ts BROOD_AT). No blow takes a boss past the next of them (phaseFloor): held there, the turn
// plays (its banner, its call) before the next blow takes them on, a burst never skipping one.
import type { Enemy, EnemyKind } from '../types';
import { DEACON_TURNS } from '../reliquary/reliquaryMoves';

export const BOSS_PHASES: Partial<Record<EnemyKind, readonly number[]>> = {
  houndmaster: [2 / 3, 1 / 3],
  quartermaster: [1 / 2, 1 / 4],
  gaoler: [0.6, 0.3],
  captain: [0.5, 0.2],
  banditKing: [2 / 3, 1 / 3],
  cryptLord: [1 / 2],
  broodMother: [2 / 3, 1 / 3],
  gildedDeacon: DEACON_TURNS,
};

// The least health a blow may leave `foe` with: the next of its turns under it (its own, a champion's: else its
// kind's; none: none).
export function phaseFloor(foe: Enemy): number {
  const next = (foe.phases ?? BOSS_PHASES[foe.kind] ?? []).find((share) => foe.hp > foe.maxHp * share);
  return next === undefined ? -Infinity : Math.max(1, Math.floor(foe.maxHp * next)); // (whole points, at or under it: the turn taken; never nothing)
}
