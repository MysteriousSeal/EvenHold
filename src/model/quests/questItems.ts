// Quest items: what "bring me" quests ask for, dropped (now and then) only by
// the foes a quest marks. Worth nothing to anyone but the board. Four from
// each kind of foe, so two quests seldom want the same thing.

import type { QuestFoe } from './quests';
import type { LootEntry } from '../loot/loot';

const item = (name: string): LootEntry => ({ name, value: 0, droppedBy: {} });

export const QUEST_ITEMS = {
  wolfPelt: item('Wolf pelt'),
  alphaFang: item('Alpha fang'), // not the junk "Wolf fang" (junk.ts): ids are shared by all loot
  wolfClaw: item('Wolf claw'),
  wolfTail: item('Wolf tail'),
  banditToken: item('Bandit token'),
  redBandanna: item('Red bandanna'),
  lockpicks: item('Lockpicks'),
  stolenLetter: item('Stolen letter'),
} satisfies Record<string, LootEntry>;

export type QuestItemId = keyof typeof QUEST_ITEMS;
export const isQuestItem = (item: string): item is QuestItemId => item in QUEST_ITEMS;

// What each kind of foe can be asked for.
export const QUEST_ITEMS_OF: Record<QuestFoe, readonly QuestItemId[]> = {
  wolf: ['wolfPelt', 'alphaFang', 'wolfClaw', 'wolfTail'],
  bandit: ['banditToken', 'redBandanna', 'lockpicks', 'stolenLetter'],
};

// Several of an item, in words: "wolf pelts", "lockpicks".
export const PLURALS: Record<QuestItemId, string> = {
  wolfPelt: 'wolf pelts',
  alphaFang: 'alpha fangs',
  wolfClaw: 'wolf claws',
  wolfTail: 'wolf tails',
  banditToken: 'bandit tokens',
  redBandanna: 'red bandannas',
  lockpicks: 'sets of lockpicks',
  stolenLetter: 'stolen letters',
};
