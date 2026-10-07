// A piece of gear a slain foe leaves (human/items/gear.ts), at its level: people and the dead only (bandits, their
// chiefs, skeletons, draugr; beasts carry none). A bandit's one of what it wore, the rest any piece. Now and then,
// its rarity rolled as any; a chief's always, and luckier (uncommon at the least); a boss's always, rare at the least
// (a crypt's lord, the brood mother: their chests besides, loot/hoard.ts). The same for a foe every time.

import type { Enemy, EnemyKind } from '../types';
import { ITEM_IDS, type ItemId } from '../human/equipment';
import { baseOf, rollGear, type GearKey, type Rarity } from '../human/items/gear';
import { hashCell, hashUnit, mulberry32, oneOf } from '../../util/random';

interface Drops {
  chance: number; // of a piece, slain
  luck?: number; // rarer the higher (1: as any)
  least?: Rarity;
}

const DROPS: Partial<Record<EnemyKind, Drops>> = {
  bandit: { chance: 0.12 },
  banditChief: { chance: 1, luck: 2.2, least: 'uncommon' },
  skeleton: { chance: 0.08 },
  skeletonArcher: { chance: 0.08 },
  draugr: { chance: 0.14, luck: 1.3 },
  cryptLord: { chance: 1, luck: 3, least: 'rare' },
  broodMother: { chance: 1, luck: 3, least: 'rare' },
};

// The piece `enemy` leaves, slain (`factor`: the hero's luck, a blessing's), or null.
export function rollGearDrop(enemy: Pick<Enemy, 'id' | 'kind' | 'level' | 'human'>, factor = 1): GearKey | null {
  const drops = DROPS[enemy.kind];
  if (!drops || hashUnit(enemy.id, 0, 91) >= drops.chance * factor) return null;
  const rng = mulberry32(hashCell(enemy.id, enemy.level, 92));
  const worn = Object.values(enemy.human?.equipment ?? {}).filter((k): k is GearKey => !!k);
  const item: ItemId = worn.length ? baseOf(oneOf(worn, rng())) : oneOf(ITEM_IDS, rng());
  return rollGear(item, enemy.level, rng, drops.luck, drops.least);
}
