// What the first arc leaves in the world, as its words say it does (quests/firstQuestsWake.ts, firstQuestsWatch.ts): in
// the chapel yard of the ruin nearest the start, a grave post with her name cut in it once the hero's gone up to stand
// by it (whereSheBurned), plated in iron with four nails once the smith's done it (herNameInIron); three candles burning
// blue by it once the watch is kept (candlesForTheWatch). Read off how the quests stand, each time it's looked at.

import type { Ruin } from '../ruins/ruins';

export type StoryPropKind = 'gravePost' | 'ironPost' | 'blueCandle';

export interface StoryProp {
  kind: StoryPropKind;
  x: number;
  z: number;
}

export interface StoryState {
  stateOf(id: string): 'locked' | 'offered' | 'taken' | 'done';
  did(id: string): boolean;
}

const FROM_ALTAR = 1.6; // tiles before the altar, toward the ruin's middle: the grave
const CANDLES: ReadonlyArray<[number, number]> = [[-0.32, 0.28], [0.3, 0.3], [0.02, 0.42]]; // round the post's foot, before it

// The ruin's grave: before its altar (a chapel's), else at its middle.
export function graveOf(ruin: Ruin): { x: number; z: number } {
  const [mx, mz] = [ruin.x + (ruin.w - 1) / 2, ruin.z + (ruin.d - 1) / 2];
  const altar = ruin.pieces.find((p) => p.kind === 'altar');
  if (!altar) return { x: mx, z: mz };
  const d = Math.hypot(mx - altar.x, mz - altar.z) || 1;
  return { x: altar.x + ((mx - altar.x) / d) * FROM_ALTAR, z: altar.z + ((mz - altar.z) / d) * FROM_ALTAR };
}

export function storyProps(story: StoryState, ruin: Ruin | null): StoryProp[] {
  if (!ruin) return [];
  const where = story.stateOf('whereSheBurned');
  if (where !== 'taken' && where !== 'done' && !story.did('whereSheBurned')) return []; // (no post till she's buried: the hero's sent up to it)
  const { x, z } = graveOf(ruin);
  const props: StoryProp[] = [{ kind: story.did('herNameInIron') ? 'ironPost' : 'gravePost', x, z }];
  if (story.did('candlesForTheWatch')) for (const [dx, dz] of CANDLES) props.push({ kind: 'blueCandle', x: x + dx, z: z + dz });
  return props;
}
