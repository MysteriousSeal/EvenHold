// The cheat's quests (controller/cheats/questDebug.ts): every one of someone's calling, listed, and any put back on
// offer from them, to play again.
import { RARE_QUESTS, STORY_QUESTS } from './quests/catalog';
import { partsOf, type Who } from './storyCast';
import type { Ledger } from './storySave';
import { keyOf, lacks, place, settingFor, type QuestSet } from './storySet';
import type { DebugQuest } from './storyTypes';

// Every quest of `who`'s calling, set with them or not (the cheat's list).
export function questsOf(set: QuestSet, who: Who, stateOf: (key: string) => DebugQuest['state']): DebugQuest[] {
  const roles = partsOf(who);
  return Object.values(STORY_QUESTS)
    .filter((q) => roles.includes(q.giver))
    .map((quest) => {
      const at = settingFor(set, quest, who);
      const key = keyOf(quest.id, at);
      const now = set.all.get(key);
      return { id: quest.id, key, name: quest.name, scope: quest.scope, rare: RARE_QUESTS.includes(quest), state: stateOf(key), set: !!now && (!now.at || now.at.who[quest.giver] === who), lacks: quest.scope !== 'road' && !at ? 'no village of theirs' : lacks(quest, at) };
    });
}

// A quest put back on offer from `who` (the cheat's), whatever it follows and however it stood: set with them if
// it wasn't; its key, to open its talk by (null: it can't be played here).
export function replay(set: QuestSet, l: Ledger, id: string, who: Who): string | null {
  const quest = STORY_QUESTS[id];
  const at = quest && settingFor(set, quest, who);
  if (!quest || (quest.scope !== 'road' && !at) || lacks(quest, at ?? null)) return null;
  const i = place(set, quest, at ?? null);
  if (at) l.forced.set(i.key, 'id' in who && typeof who.id === 'number' && 'village' in who ? who.id : null);
  for (const kept of [l.state, l.untracked, l.counted, l.kept]) kept.delete(i.key);
  l.freed.add(i.key);
  return i.key;
}
