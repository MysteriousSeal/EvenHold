// The kinds of dungeon (dungeonTypes.ts), by the way in: a crypt's
// (crypts/cryptDungeon.ts), a cave's (caves/caveDungeon.ts). What the game
// asks of any dungeon, asked of the right kind.

import type { Entrance } from '../interiors/interiors';
import type { Hero } from '../types';
import { CRYPT_DUNGEON } from '../crypts/cryptDungeon';
import { CAVE_DUNGEON } from '../caves/caveDungeon';
import { clearedShare } from './dungeonRecord';
import { goesUnder, type DungeonHooks, type DungeonKind, type DungeonPlace, type DungeonRun, type Underground } from './dungeonTypes';

const KINDS: Record<Underground, DungeonKind> = { crypt: CRYPT_DUNGEON, cave: CAVE_DUNGEON };
const kindOf = (entrance: Entrance): DungeonKind => {
  if (!goesUnder(entrance)) throw new Error(`no dungeon down a ${entrance.type}'s door`);
  return KINDS[entrance.type as Underground];
};

// Who the dungeon down this way in is (its name, level, key), or null (not a dungeon's, or not placed).
export const dungeonAt = (entrance: Entrance): DungeonPlace | null => (goesUnder(entrance) ? kindOf(entrance).place(entrance) : null);

// What the game needs of it to go down: its room, its rock, how many foes to clear.
export const dungeonRoom = (seed: number, entrance: Entrance) => kindOf(entrance).room(seed, entrance);
export const dungeonBlocks = (seed: number, entrance: Entrance) => kindOf(entrance).blocks(seed, entrance);

// Its foes, run while the hero's down there (`slain`: its record of the cleared, the save's).
export const dungeonRun = (seed: number, entrance: Entrance, slain: Set<number>, hero: Hero, hooks: DungeonHooks): DungeonRun => kindOf(entrance).run(seed, entrance, slain, hero, hooks);

// How much of it's cleared (0..1), from its record (`cleared`: the save's, by its key).
export function dungeonShare(seed: number, entrance: Entrance, cleared: (key: string) => ReadonlySet<number>): number {
  const place = dungeonAt(entrance);
  return place ? clearedShare(cleared(place.key), kindOf(entrance).foeCount(seed, entrance)) : 0;
}
