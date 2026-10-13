// What a stronghold's bosses leave that's found nowhere else: one named piece
// each (human/items/namedGear.ts: an item of the catalog under a name of its
// own, its lines fixed), at the stronghold's level. A wing's boss's lies where
// he falls (strongholdMoves.ts: slain); the king's is the piece in his chest
// (strongholdFoes.ts: its hoard).

import type { EnemyKind } from '../types';
import { namedGear, type GearKey } from '../human/items/gear';
import type { NamedId } from '../human/items/namedGear';

export const BOSS_PIECE: Partial<Record<EnemyKind, NamedId>> = { houndmaster: 1001, quartermaster: 1002, gaoler: 1003, captain: 1004, banditKing: 1005 };

// The piece a foe of `kind` leaves (a boss's own), at `level`; or null: not a boss.
export function bossPiece(kind: EnemyKind, level: number): GearKey | null {
  const id = BOSS_PIECE[kind];
  return id ? namedGear(id, level) : null;
}
