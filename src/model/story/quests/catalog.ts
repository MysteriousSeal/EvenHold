// Every quest people give, gathered: the line a new game opens with (firstQuests.ts); those most villages have most
// of (villageQuests.ts, and what goes on behind their doors: bawdyQuests.ts); those few villages have each, so that
// villages far apart ask different things (the hard: grimQuests.ts; the uncanny: eerieQuests.ts; the daft:
// drollQuests.ts; behind closed doors: affairQuests.ts); the road's (roadQuests.ts). Their order within a list is
// what a village's share of them is drawn by (storySet.ts): added to at the end, never shuffled.
import type { StoryQuest } from '../storyQuests';
import { AFFAIR_QUESTS } from './affairQuests';
import { BAWDY_QUESTS } from './bawdyQuests';
import { DROLL_QUESTS } from './drollQuests';
import { EERIE_QUESTS } from './eerieQuests';
import { FIRST_QUESTS } from './firstQuests';
import { GRIM_QUESTS } from './grimQuests';
import { ROAD_QUESTS } from './roadQuests';
import { VILLAGE_QUESTS } from './villageQuests';

export { FIRST_QUESTS, ROAD_QUESTS };
export const COMMON_QUESTS: StoryQuest[] = [...VILLAGE_QUESTS, ...BAWDY_QUESTS];
export const RARE_QUESTS: StoryQuest[] = [...GRIM_QUESTS, ...EERIE_QUESTS, ...DROLL_QUESTS, ...AFFAIR_QUESTS];
export const STORY_QUESTS: Record<string, StoryQuest> = Object.fromEntries([...FIRST_QUESTS, ...COMMON_QUESTS, ...RARE_QUESTS, ...ROAD_QUESTS].map((q) => [q.id, q]));
