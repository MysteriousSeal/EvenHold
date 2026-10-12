// Where a quest under way sends the hero (the tracker's arrow: view/hud/questTracker.ts): where what it still asks
// is to be done, if that's anywhere. A place to reach: there. Foes to slay: the nearest of them in sight, else where
// their kind keeps. A camp to clear: its village's (the road's: the nearest). A shift to work: the inn. A wish to
// make: the village, for its well. Something to bring: where it's found, if that's one place (the quest's `near`),
// else nowhere.
import type { Camp } from '../camps/camps';
import type { Entrance } from '../interiors/interiors';
import type { Enemy, Village } from '../types';
import { nearest, type Point, type Setting } from './storyCast';
import { placeOf } from './storySet';
import type { StoryQuest } from './storyQuests';

export interface GoalHost {
  readonly hero: Point;
  readonly enemies: readonly Enemy[];
  readonly camps: readonly Camp[];
  readonly villages: readonly Village[];
  readonly entrances: readonly Entrance[];
}

const FOE_SEEN = 90; // tiles: a quest's foes this near the hero are pointed to
const here = <T extends Point>(p: T): Point => p;

// The inn a quest's shift is worked at (its village's; the road's: the nearest), if that's what it asks.
export function innOf(host: GoalHost, quest: StoryQuest, at: Setting | null): Entrance | null {
  if (quest.needs?.kind !== 'do' || quest.needs.what !== 'shift') return null;
  return at?.inn ?? nearest(host.entrances.filter((e) => e.type === 'inn'), here, host.hero);
}

export function goalOf(host: GoalHost, quest: StoryQuest, at: Setting | null): Point | null {
  const needs = quest.needs;
  const place = placeOf(quest);
  const set = (place && at?.place[place]) ?? null; // its own place, where it's set in a village
  if (!needs) return null;
  if (needs.kind === 'bring') return quest.near ? set : null; // (found in a place of its own: there)
  if (needs.kind === 'reach') return set;
  if (needs.kind === 'slay') return nearest(host.enemies.filter((e) => e.kind === needs.foe && e.state !== 'dead'), here, host.hero, FOE_SEEN) ?? set;
  if (needs.what === 'clearCamp') return set ?? nearest(host.camps, (c) => c.way, host.hero)?.way ?? null;
  if (needs.what === 'shift') return innOf(host, quest, at);
  return at?.village ?? nearest(host.villages, here, host.hero);
}
