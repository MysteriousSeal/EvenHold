// What a quest asks, done already before it was ever taken (story.ts counts it done as soon as it's seen to be): a
// camp cleared stays cleared, a dungeon's boss slain stays slain (the save's records), and a quest that asked for
// either after the fact could never be finished. Its village's own camp found empty; its village's own crypt's lord,
// or cave's brood mother, in the record of the slain.
import type { Camp } from '../camps/camps';
import type { Cave } from '../caves/caves';
import type { Crypt } from '../crypts/crypts';
import { dungeonAt } from '../dungeons/dungeons';
import { BOSS_POST } from '../dungeons/dungeonRecord';
import type { Entrance } from '../interiors/interiors';
import type { EnemyKind } from '../types';
import type { Point, Setting } from './storyCast';
import type { StoryQuest } from './storyQuests';

export interface AlreadyHost {
  readonly camps: readonly Camp[];
  readonly crypts?: readonly Crypt[];
  readonly caves: readonly Cave[];
  cleared?(key: string): ReadonlySet<number>; // a dungeon's foes slain for good, by its key
  campEmpty?(camp: Camp): boolean; // none of its crew left standing (its region there to be looked at)
  clearedShare?(entrance: Entrance): number; // how much of a dungeon's cleared for good, 0 to 1
}

const BOSS_OF: Partial<Record<EnemyKind, 'ruin' | 'cave'>> = { cryptLord: 'ruin', broodMother: 'cave' };
// Those of a dungeon that aren't its boss: with every last one of the dungeon slain, a quest for them is done.
const GUARD_OF: Partial<Record<EnemyKind, 'ruin' | 'cave'>> = { skeleton: 'ruin', skeletonArcher: 'ruin', draugr: 'ruin', caveSpider: 'cave', caveBat: 'cave', caveWorm: 'cave' };
const same = (a: Point, b: Point) => a.x === b.x && a.z === b.z;

// The way down into a place's dungeon: the cave itself, or the crypt under the ruin.
export const dungeonOf = (host: Pick<AlreadyHost, 'caves' | 'crypts'>, lair: 'ruin' | 'cave', spot: Point): Entrance | undefined =>
  lair === 'cave' ? host.caves.find((c) => same(c.entrance, spot))?.entrance : host.crypts?.find((c) => same({ x: c.ruin.x + c.ruin.w / 2, z: c.ruin.z + c.ruin.d / 2 }, spot))?.entrance;

export function alreadyDone(host: AlreadyHost, quest: StoryQuest, at: Setting | null): boolean {
  const needs = quest.needs;
  if (!at || !needs) return false;
  if (needs.kind === 'do' && needs.what === 'clearCamp') {
    const camp = at.place.camp && host.camps.find((c) => same(c.way, at.place.camp!));
    return !!camp && host.campEmpty?.(camp) === true;
  }
  const boss = needs.kind === 'slay' ? BOSS_OF[needs.foe] : undefined;
  const lair = boss ?? (needs.kind === 'slay' ? GUARD_OF[needs.foe] : undefined);
  const spot = lair && at.place[lair];
  if (!spot) return false;
  const way = dungeonOf(host, lair, spot);
  if (way && !boss) return (host.clearedShare?.(way) ?? 0) >= 1; // (its guards: every one of the dungeon's slain)
  const place = way && dungeonAt(way);
  return !!place && host.cleared?.(place.key).has(BOSS_POST) === true;
}
