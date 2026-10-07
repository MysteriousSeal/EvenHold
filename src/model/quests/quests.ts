// The quests a village's notice board offers, six in all: slay so many
// of a kind of foe, or bring back so many of what they carry, from a spot
// out beyond the village (said in words: "north-east of the village"). Each
// is rolled from the seed, the board and its number, so a board offers the
// same quests to everyone on that seed; rewards (coins, experience) grow with
// how dangerous that spot is (enemyLevels.ts).

import { hashUnit } from '../../util/random';
import { COPPER_PER_SILVER } from '../hero/money';
import { enemyPower, zoneLevel } from '../enemies/enemyLevels';
import type { MapSize } from '../map/grid';
import { NEIGHBORS_4, spawnOf } from '../map/grid';
import { HERO_RADIUS } from '../constants';
import type { Village } from '../types';
import { PLURALS, QUEST_ITEMS_OF, type QuestItemId } from './questItems';

export const OFFERS = 6; // quests a board has, for good
export const MAX_ACTIVE = 10; // quests the hero can have taken at once (the journal holds ten)
export const MAX_PER_BOARD = 3; // of them, from any one board
export const MAX_TRACKED = 3; // of them, shown on screen at once (the quest tracker)
const NEAR = 14; // tiles from the village, the nearest a quest's foes gather
const FAR = 26; // and the farthest
const DIRECTIONS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

export type QuestFoe = 'wolf' | 'bandit' | 'boar'; // what quests ask to be slain (or robbed)

// Per foe: how often a quest is about it (weights), what it pays in copper
// per foe and level, and what they're called, several of them.
const FOES: Record<QuestFoe, { weight: number; pay: number; plural: string }> = {
  wolf: { weight: 0.45, pay: 10, plural: 'wolves' },
  bandit: { weight: 0.3, pay: 14, plural: 'bandits' },
  boar: { weight: 0.25, pay: 12, plural: 'boars' },
};
const FOE_KINDS = Object.keys(FOES) as QuestFoe[];

// A foe for a quest, from a roll in 0..1, by the weights.
function foeOf(roll: number): QuestFoe {
  let left = roll * FOE_KINDS.reduce((sum, f) => sum + FOES[f].weight, 0);
  for (const foe of FOE_KINDS) if ((left -= FOES[foe].weight) < 0) return foe;
  return FOE_KINDS[FOE_KINDS.length - 1];
}

export interface Quest {
  key: string; // `${board}:${n}`: which board, and which of its quests
  board: number; // its village's index
  kind: 'kill' | 'collect';
  foe: QuestFoe;
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
  isBlocked(x: number, z: number, r: number): boolean;
  // A board's number, its village's own (a classic world's: its place among them; a streamed world's: where it stands,
  // the same however its regions are made), and the village of one: model/world/liveWorld.ts. (Else by place.)
  boardOf?(village: Village): number;
  villageOf?(board: number): Village | undefined;
}

// The village of board `board`, if it's known (a streamed world's: its region made, this game).
export const boardVillage = (world: QuestWorld, board: number): Village | undefined => (world.villageOf ? world.villageOf(board) : world.villages[board]);
// The board number of the `i`th village of the world's list.
export const boardNumber = (world: QuestWorld, i: number): number => (world.boardOf ? world.boardOf(world.villages[i]) : i);

const WALK_WINDOW = FAR + 14; // tiles round a village searched for the way out to a quest's spot

// The tiles the hero can walk to from a village's square, within WALK_WINDOW
// of it (a step counts as pathfinding.ts has it: clear where it ends and
// halfway there). Worked out once per village: boards ask often.
const walkable = new WeakMap<QuestWorld, Map<Village, (x: number, z: number) => boolean>>();
function walkableFrom(world: QuestWorld, village: Village): (x: number, z: number) => boolean {
  let byVillage = walkable.get(world);
  if (!byVillage) walkable.set(world, (byVillage = new Map()));
  const known = byVillage.get(village);
  if (known) return known;
  const side = WALK_WINDOW * 2 + 1;
  const index = (x: number, z: number) => (x - village.x + WALK_WINDOW) * side + (z - village.z + WALK_WINDOW);
  const inWindow = (x: number, z: number) => Math.abs(x - village.x) <= WALK_WINDOW && Math.abs(z - village.z) <= WALK_WINDOW && x > 0 && z > 0 && x < world.size.width - 1 && z < world.size.depth - 1;
  const free = (x: number, z: number) => !world.isBlocked(x, z, HERO_RADIUS);
  const seen = new Uint8Array(side * side);
  // From the open ground nearest the square's middle (the well stands on it).
  const todo: Array<[number, number]> = [];
  for (let ring = 1; ring <= 3 && todo.length === 0; ring++) {
    for (let dx = -ring; dx <= ring; dx++) for (let dz = -ring; dz <= ring; dz++) if (todo.length === 0 && free(village.x + dx, village.z + dz)) todo.push([village.x + dx, village.z + dz]);
  }
  for (const [x, z] of todo) seen[index(x, z)] = 1;
  while (todo.length > 0) {
    const [x, z] = todo.pop()!;
    for (const [dx, dz] of NEIGHBORS_4) {
      const [nx, nz] = [x + dx, z + dz];
      if (!inWindow(nx, nz) || seen[index(nx, nz)] || !free(nx, nz) || !free(x + dx / 2, z + dz / 2)) continue;
      seen[index(nx, nz)] = 1;
      todo.push([nx, nz]);
    }
  }
  const reach = (x: number, z: number) => inWindow(x, z) && seen[index(x, z)] === 1;
  byVillage.set(village, reach);
  return reach;
}

// The board's `n`th quest (the same for everyone on the seed).
export function questAt(world: QuestWorld, board: number, n: number): Quest {
  const village = boardVillage(world, board)!;
  const roll = (salt: number) => hashUnit(board * 131 + n, world.seed % 1_000_003, 200 + salt);
  const foe = foeOf(roll(1));
  const kind = roll(2) < 0.5 ? 'kill' : 'collect';
  // A spot out beyond the village, open ground the hero can walk to from it (trying a few directions).
  let x = village.x;
  let z = village.z;
  let angle = 0;
  const fits = (tx: number, tz: number) => tx > 1 && tz > 1 && tx < world.size.width - 2 && tz < world.size.depth - 2 && world.isOpenTile(tx, tz) && walkableFrom(world, village)(tx, tz);
  // (twelve tries at random; failing those, round the village from the rolled way, nearest first)
  const tries = Array.from({ length: 12 }, (_, t) => [roll(10 + t) * Math.PI * 2, NEAR + roll(30 + t) * (FAR - NEAR)]);
  for (let d = NEAR; d <= FAR; d += 2) for (let k = 0; k < 16; k++) tries.push([roll(10) * Math.PI * 2 + (k * Math.PI) / 8, d]);
  for (const [a, d] of tries) {
    const [tx, tz] = [Math.round(village.x + Math.sin(a) * d), Math.round(village.z - Math.cos(a) * d)];
    if (!fits(tx, tz)) continue;
    [x, z, angle] = [tx, tz, a % (Math.PI * 2)];
    break;
  }
  const where = `${DIRECTIONS[Math.round(((angle / (Math.PI * 2)) * 8) % 8) % 8]} of the village`; // north is -z
  const level = zoneLevel(spawnOf(world.size), village); // (the village's: for better paid work, farther villages)
  const count = kind === 'kill' ? 6 + Math.floor(roll(3) * 3) : 4 + Math.floor(roll(3) * 3); // slay 6 to 8, bring 4 to 6
  // What to bring: one of the foe's four, turned round per board so its notices ask for different things.
  const turn = Math.floor(hashUnit(board * 131, world.seed % 1_000_003, 250) * 4);
  const item: QuestItemId | null = kind === 'collect' ? QUEST_ITEMS_OF[foe][(turn + n) % 4] : null;
  const dropChance = 0.45;
  // Rewards: more for tougher foes and places, and for fetching (more to slay on average).
  const perFoe = enemyPower(foe, level).xp;
  const foes = kind === 'kill' ? count : Math.ceil(count / dropChance);
  const xp = Math.round(perFoe * foes * 1.5);
  const copper = Math.round(FOES[foe].pay * level * foes + COPPER_PER_SILVER * 0.2 * level);
  return { key: `${board}:${n}`, board, kind, foe, count, item, dropChance, x, z, where, level, copper, xp };
}

// What the quest asks, in a line: "Slay 6 wolves" / "Bring 4 wolf pelts".
export function questTitle(quest: Quest): string {
  if (quest.kind === 'kill') return `Slay ${quest.count} ${FOES[quest.foe].plural}`;
  return `Bring ${quest.count} ${PLURALS[quest.item!]}`;
}

// A quest's progress, for floating text: "4/6 wolves", and whether that's all.
export function questProgress(quest: Quest, have: number): { text: string; done: boolean } {
  const what = quest.kind === 'kill' ? FOES[quest.foe].plural : PLURALS[quest.item!];
  return { text: `${Math.min(have, quest.count)}/${quest.count} ${what}`, done: have >= quest.count };
}

// A distance in tiles, told in meters (a tile is two): "40 m".
const METERS_PER_TILE = 2;
export const inMeters = (tiles: number) => `${Math.round(tiles * METERS_PER_TILE)} m`;
