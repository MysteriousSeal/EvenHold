// A piece of gear a slain foe leaves (human/items/gear.ts), at its level: people and the dead only (bandits, their
// chiefs, skeletons, draugr; beasts carry none). A bandit's one of what it wore, the rest any piece. Now and then,
// its rarity rolled as any; a chief's always, and luckier (uncommon at the least); a boss's always, rare at the least
// (a crypt's lord, the brood mother: their chests besides, loot/hoard.ts). A stronghold's bandits as any bandit, its
// bruisers a little likelier; its bosses leave a piece of their own instead (strongholds/strongholdLoot.ts). Half the
// time a foe with pieces of its own (items' `droppedBy`: the crypts' dead their barrow gear, a firebrand its cult's)
// leaves one of those instead, of those found at its level. The same for a foe every time.

import type { Enemy, EnemyKind } from '../types';
import { ITEMS, ITEM_IDS, type ItemId } from '../human/equipment';
import { baseOf, foundAt, rollGear, type GearKey, type Rarity } from '../human/items/gear';
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
  bruiser: { chance: 0.16, luck: 1.2 },
  crossbowman: { chance: 0.12 },
  firebrand: { chance: 0.12 },
  sawbones: { chance: 0.14, luck: 1.2 },
  runner: { chance: 0.08 },
};

// The piece `enemy` leaves, slain (`factor`: the hero's luck, a blessing's), or null.
export function rollGearDrop(enemy: Pick<Enemy, 'id' | 'kind' | 'level' | 'human'>, factor = 1): GearKey | null {
  const drops = DROPS[enemy.kind];
  if (!drops || hashUnit(enemy.id, 0, 91) >= drops.chance * factor) return null;
  const rng = mulberry32(hashCell(enemy.id, enemy.level, 92));
  const worn = Object.values(enemy.human?.equipment ?? {}).filter((k): k is GearKey => !!k);
  const own = favouredBy(enemy.kind, enemy.level);
  const item: ItemId =
    own.length && rng() < FAVOURED ? weighted(own, rng()) : worn.length ? baseOf(oneOf(worn, rng())) : oneOf(ITEM_IDS.filter((id) => foundAt(id, enemy.level)), rng());
  return rollGear(item, enemy.level, rng, drops.luck, drops.least);
}

const FAVOURED = 0.5; // how often a foe with pieces of its own leaves one of those

// Whether a foe of `kind` ever leaves gear, slain.
export const dropsGear = (kind: EnemyKind): boolean => !!DROPS[kind];

// The pieces a foe of `kind` (or a hoard's keeper) favours, of those found at `level`, with their weights.
export function favouredBy(kind: EnemyKind, level: number): Array<[ItemId, number]> {
  return ITEM_IDS.flatMap((id): Array<[ItemId, number]> => {
    const weight = ITEMS[id].droppedBy?.[kind];
    return weight && foundAt(id, level) ? [[id, weight]] : [];
  });
}

// One of `options`, by weight (`u`: 0..1).
export function weighted(options: Array<[ItemId, number]>, u: number): ItemId {
  let left = u * options.reduce((sum, [, w]) => sum + w, 0);
  for (const [id, w] of options) if ((left -= w) < 0) return id;
  return options[options.length - 1][0];
}
