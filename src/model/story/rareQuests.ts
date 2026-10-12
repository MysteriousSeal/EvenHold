// Some villages' own troubles: quests set in few villages each (a third of them at most, some one in seven), so
// that those far apart ask different things. One that follows another is set only where that one is. By kind: the
// hard (grimQuests.ts), the uncanny (eerieQuests.ts), the daft (drollQuests.ts), the ones behind closed doors
// (affairQuests.ts).
import { AFFAIR_QUESTS } from './affairQuests';
import { DROLL_QUESTS } from './drollQuests';
import { EERIE_QUESTS } from './eerieQuests';
import { GRIM_QUESTS } from './grimQuests';
import type { StoryQuest } from './storyQuests';

export const RARE_QUESTS: StoryQuest[] = [...GRIM_QUESTS, ...EERIE_QUESTS, ...DROLL_QUESTS, ...AFFAIR_QUESTS];
