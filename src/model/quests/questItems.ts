// Quest items: what "bring me" quests ask for, dropped (now and then) only by
// the foes a quest marks. Worth nothing to anyone but the board.

import type { LootEntry } from '../loot/loot';

export const QUEST_ITEMS = {
  wolfPelt: { name: 'Wolf pelt', value: 0, droppedBy: {} },
  banditToken: { name: 'Bandit token', value: 0, droppedBy: {} },
} satisfies Record<string, LootEntry>;

export type QuestItemId = keyof typeof QUEST_ITEMS;
export const isQuestItem = (item: string): item is QuestItemId => item in QUEST_ITEMS;
