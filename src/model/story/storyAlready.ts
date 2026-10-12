// What a quest asks, done already before it was ever taken (story.ts counts it done as soon as it's seen to be): a
// camp cleared stays cleared, a dungeon's boss slain stays slain (the save's records), and a quest that asked for
// either after the fact could never be finished. Its village's own camp found empty; its village's own crypt's lord,
// or cave's brood mother, in the record of the slain.
import type { Camp } from '../camps/camps';
import type { Cave } from '../caves/caves';
import type { Crypt } from '../crypts/crypts';
import { dungeonAt } from '../dungeons/dungeons';
import { BOSS_POST } from '../dungeons/dungeonRecord';
import type { EnemyKind } from '../types';
import type { Point, Setting } from './storyCast';
import type { StoryQuest } from './storyQuests';

export interface AlreadyHost {
  readonly camps: readonly Camp[];
  readonly crypts?: readonly Crypt[];
  readonly caves: readonly Cave[];
  cleared?(key: string): ReadonlySet<number>; // a dungeon's foes slain for good, by its key
  campEmpty?(camp: Camp): boolean; // none of its crew left standing (its region there to be looked at)
}

const BOSS_OF: Partial<Record<EnemyKind, 'ruin' | 'cave'>> = { cryptLord: 'ruin', broodMother: 'cave' };
const same = (a: Point, b: Point) => a.x === b.x && a.z === b.z;

export function alreadyDone(host: AlreadyHost, quest: StoryQuest, at: Setting | null): boolean {
  const needs = quest.needs;
  if (!at || !needs) return false;
  if (needs.kind === 'do' && needs.what === 'clearCamp') {
    const camp = at.place.camp && host.camps.find((c) => same(c.way, at.place.camp!));
    return !!camp && host.campEmpty?.(camp) === true;
  }
  const lair = needs.kind === 'slay' ? BOSS_OF[needs.foe] : undefined;
  const spot = lair && at.place[lair];
  if (!spot) return false;
  const way = lair === 'cave' ? host.caves.find((c) => same(c.entrance, spot))?.entrance : host.crypts?.find((c) => same({ x: c.ruin.x + c.ruin.w / 2, z: c.ruin.z + c.ruin.d / 2 }, spot))?.entrance;
  const place = way && dungeonAt(way);
  return !!place && host.cleared?.(place.key).has(BOSS_POST) === true;
}
