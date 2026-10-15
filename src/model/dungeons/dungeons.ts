// The kinds of dungeon (dungeonTypes.ts), by the way in: a crypt's
// (crypts/cryptDungeon.ts), a cave's (caves/caveDungeon.ts), a stronghold's
// (strongholds/strongholdDungeon.ts). What the game
// asks of any dungeon, asked of the right kind.

import type { Entrance } from '../interiors/interiors';
import type { Hero } from '../types';
import { CRYPT_DUNGEON } from '../crypts/cryptDungeon';
import { CAVE_DUNGEON } from '../caves/caveDungeon';
import { STRONGHOLD_DUNGEON } from '../strongholds/strongholdDungeon';
import { RELIQUARY_DUNGEON } from '../reliquary/reliquary';
import { clearedShare } from './dungeonRecord';
import { goesUnder, type DungeonHooks, type DungeonKind, type DungeonPlace, type DungeonRun, type Underground } from './dungeonTypes';

const KINDS: Record<Underground, DungeonKind> = { crypt: CRYPT_DUNGEON, cave: CAVE_DUNGEON, stronghold: STRONGHOLD_DUNGEON, reliquary: RELIQUARY_DUNGEON };
const kindOf = (entrance: Entrance): DungeonKind => {
  if (!goesUnder(entrance)) throw new Error(`no dungeon down a ${entrance.type}'s door`);
  return KINDS[entrance.type as Underground];
};

// Who the dungeon down this way in is (its name, level, key), or null (not a dungeon's, or not placed).
export const dungeonAt = (entrance: Entrance): DungeonPlace | null => (goesUnder(entrance) ? kindOf(entrance).place(entrance) : null);

// What's told at its way in while it's barred, or null: open (any but the reliquary's, always).
export const dungeonBarred = (entrance: Entrance, game: { story?: unknown }) => (goesUnder(entrance) ? kindOf(entrance).barred?.(entrance, game) ?? null : null);

// What the game needs of it to go down: its room, its rock, how many foes to clear.
export const dungeonRoom = (seed: number, entrance: Entrance) => kindOf(entrance).room(seed, entrance);
export const dungeonBlocks = (seed: number, entrance: Entrance) => kindOf(entrance).blocks(seed, entrance);

// What walls the hero in down there: its rock and what stands solid, and its boss's chest once it's there (its `run`'s).
export const dungeonWalls = (blocks: (x: number, z: number, r: number) => boolean, run: () => DungeonRun | null | undefined) => (x: number, z: number, r: number): boolean => blocks(x, z, r) || !!run()?.chestBlocks(x, z, r);

// Its foes, run while the hero's down there (`slain`: its record of the cleared, the save's).
export const dungeonRun = (seed: number, entrance: Entrance, slain: Set<number>, hero: Hero, hooks: DungeonHooks): DungeonRun => kindOf(entrance).run(seed, entrance, slain, hero, hooks);

// How much of it's cleared (0..1), from its record (`cleared`: the save's, by its key).
export function dungeonShare(seed: number, entrance: Entrance, cleared: (key: string) => ReadonlySet<number>): number {
  const place = dungeonAt(entrance);
  return place ? clearedShare(cleared(place.key), kindOf(entrance).foeCount(seed, entrance)) : 0;
}
