// The quests a village's notice board offers, five at a time: slay so many
// of a kind of foe, or bring back so many of what they carry, from a spot
// out beyond the village (said in words: "north-east of the village"). Each
// is rolled from the seed, the board and its number, so a board offers the
// same quests to everyone on that seed; rewards (coins, experience) grow with
// how dangerous that spot is (enemyLevels.ts).

import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';
import { enemyLevel, enemyPower } from '../enemies/enemyLevels';
import type { MapSize } from '../grid';
import { spawnOf } from '../grid';
import type { EnemyKind, Village } from '../types';
import type { QuestItemId } from './questItems';

export const OFFERS = 5; // quests on a board at once
export const MAX_ACTIVE = 3; // quests the hero can have taken at once
const NEAR = 14; // tiles from the village, the nearest a quest's foes gather
const FAR = 26; // and the farthest
const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

export interface Quest {
  key: string; // `${board}:${n}`: which board, and which of its quests
  board: number; // its village's index
  kind: 'kill' | 'collect';
  foe: EnemyKind;
  count: number; // foes to slay, or items to bring
  item: QuestItemId | null; // what to bring (collect quests)
  dropChance: number; // of a marked foe dropping it
  x: number; // where the foes gather
  z: number;
  where: string; // "north-east of the village"
  level: number;
  copper: number;
  xp: number;
}

export interface QuestWorld {
  seed: number;
  size: MapSize;
  villages: readonly Village[];
  isOpenTile(x: number, z: number): boolean;
}

// The board's `n`th quest (the same for everyone on the seed).
export function questAt(world: QuestWorld, board: number, n: number): Quest {
  const village = world.villages[board];
  const roll = (salt: number) => hashUnit(board * 131 + n, world.seed % 1_000_003, 200 + salt);
  const foe: EnemyKind = roll(1) < 0.55 ? 'wolf' : 'bandit';
  const kind = roll(2) < 0.5 ? 'kill' : 'collect';
  // A spot out beyond the village, open ground (trying a few directions).
  let x = village.x;
  let z = village.z;
  let angle = 0;
  for (let t = 0; t < 12; t++) {
    angle = roll(10 + t) * Math.PI * 2;
    const d = NEAR + roll(30 + t) * (FAR - NEAR);
    const [tx, tz] = [Math.round(village.x + Math.sin(angle) * d), Math.round(village.z - Math.cos(angle) * d)];
    if (tx > 1 && tz > 1 && tx < world.size.width - 2 && tz < world.size.depth - 2 && world.isOpenTile(tx, tz)) {
      [x, z] = [tx, tz];
      break;
    }
  }
  const where = `${DIRECTIONS[Math.round(((angle / (Math.PI * 2)) * 8) % 8) % 8]} of the village`; // north is -z
  const level = enemyLevel(spawnOf(world.size), x, z, board * 997 + n);
  const count = kind === 'kill' ? (foe === 'wolf' ? 4 + Math.floor(roll(3) * 4) : 3 + Math.floor(roll(3) * 3)) : 3 + Math.floor(roll(3) * 3);
  const item: QuestItemId | null = kind === 'collect' ? (foe === 'wolf' ? 'wolfPelt' : 'banditToken') : null;
  const dropChance = 0.45;
  // Rewards: more for tougher foes and places, and for fetching (more to slay on average).
  const perFoe = enemyPower(foe, level).xp;
  const foes = kind === 'kill' ? count : Math.ceil(count / dropChance);
  const xp = Math.round(perFoe * foes * 1.5);
  const copper = Math.round((foe === 'bandit' ? 7 : 5) * level * foes + COPPER_PER_SILVER * 0.2 * level);
  return { key: `${board}:${n}`, board, kind, foe, count, item, dropChance, x, z, where, level, copper, xp };
}

// What the quest asks, in a line: "Slay 6 wolves" / "Bring 4 wolf pelts".
export function questTitle(quest: Quest): string {
  if (quest.kind === 'kill') return `Slay ${quest.count} ${quest.foe === 'wolf' ? 'wolves' : 'bandits'}`;
  return `Bring ${quest.count} ${quest.item === 'wolfPelt' ? 'wolf pelts' : 'bandit tokens'}`;
}

// A quest's progress, for floating text: "4/6 wolves", and whether that's all.
export function questProgress(quest: Quest, have: number): { text: string; done: boolean } {
  const what = quest.kind === 'kill' ? (quest.foe === 'wolf' ? 'wolves' : 'bandits') : quest.item === 'wolfPelt' ? 'wolf pelts' : 'bandit tokens';
  return { text: `${Math.min(have, quest.count)}/${quest.count} ${what}`, done: have >= quest.count };
}
