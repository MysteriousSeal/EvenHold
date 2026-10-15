// The choices the story leaves to the hero (story.ts): a quest whose handing in is a choice (StoryQuest `choice`), each
// way of it its own answer, its own word after, and its own reward (coin, a gift); what was chosen kept (and in the
// save), so what's said later can turn on it (Told `chose`), and a later quest pay a reward one way earned (`later`).

import type { Gift, StoryQuest, StoryQuestId, StoryRole, Told } from './storyQuests';
import type { Talk } from './story';

export interface Choice {
  key: string;
  label: string; // the hero's answer
  said?(t: Told): string[]; // whoever it's handed in to, after it
  copper?: number; // paid on top (at a first-level village; more, the further out, as the quest's own)
  gift?: Gift; // given on top
  later?: { quest: StoryQuestId; gift: Gift }; // a later quest's handing in, the richer for it
  gone?: StoryRole; // whoever plays that part taken away for good, after it (the men in grey's: story.ts)
  heat?: number; // the witch-finders' heat on the hero, raised (or, less than nothing, calmed) where it's handed in
}

// The hero's answers as a quest's handed in: its thanks; or, a choice, each way of it (the first lit), and a way to
// put it off (Escape's: nothing chosen, nothing handed in). `done`: handed in, the way taken with it.
export function choiceAnswers(quest: StoryQuest, t: Told, speaker: string, done: (choice?: Choice) => boolean): Talk['answers'] {
  if (!quest.choice) return [{ label: quest.thanks, primary: true, pick: () => void done() }];
  return [
    ...quest.choice.map((c, i) => ({
      label: c.label,
      primary: i === 0,
      pick: (): Talk | void => {
        if (!done(c)) return;
        const said = c.said?.(t);
        return said?.length ? { speaker, lines: said, answers: [] } : undefined;
      },
    })),
    { label: 'Let me think on it.', out: true, pick: () => {} },
  ];
}

export class Choices {
  private chosen = new Map<StoryQuestId, string>(); // by quest id: the way taken

  // The way taken at quest `id`, if one was.
  of = (id: StoryQuestId): string | undefined => this.chosen.get(id);

  take(id: StoryQuestId, key: string): void {
    this.chosen.set(id, key);
  }

  // What a quest's handing in brings on top, earned by a way taken before (none: null).
  laterFor(id: StoryQuestId, choicesAt: (at: StoryQuestId) => readonly Choice[] | undefined): Gift | null {
    for (const [at, key] of this.chosen) {
      const later = choicesAt(at)?.find((c) => c.key === key)?.later;
      if (later?.quest === id) return later.gift;
    }
    return null;
  }

  saved(): Record<string, string> {
    return Object.fromEntries(this.chosen);
  }

  load(saved: unknown, known: (id: string) => boolean): void {
    this.chosen = new Map(Object.entries(saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : {}).filter((e): e is [string, string] => known(e[0]) && typeof e[1] === 'string'));
  }
}
