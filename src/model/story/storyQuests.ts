// The quests people give (story.ts), each written once, by hand (quests/: one file to a kind, gathered in
// quests/catalog.ts), and set down wherever its people are (storySet.ts): `scope` 'first' (the village nearest where
// the hero sets out, the carter by his wagon: the line a new game opens with), 'village' (a village's own keepers
// and villagers, the places near it; `share` of the villages, so no two ask quite the same), 'road' (whoever of that
// calling is met on the road), 'saint' (the second arc, "The Bishop's Saint": once the first village's line is done,
// set at home, in the witch's village on the road out, and in Greyminster, the cathedral town, by its `where`:
// saint/saintSet.ts).
// Who gives it, who it's handed in to (no one: done, and paid, the moment what it asks is), what it asks (`needs`:
// something brought, foes slain, a place reached, a thing done; none: only the walk to whoever takes it in), which
// quest of the same village it follows, what each says, and what it pays (coin and experience, by the village's
// level; a gift besides, for some). The words may name those it's about (`Told`), known only once the world's made.
import type { EnemyKind } from '../types';
import type { LootId } from '../loot/loot';
import type { ItemId } from '../human/items';
import type { Rarity } from '../human/items/gear';
import type { Build } from '../human/humanoid';
import type { Choice } from './storyChoices';

export type StoryQuestId = string;
// Who's who, by the village a quest is set in: its keepers; two of its villagers; the barmaid of the village nearest
// it; the carter (the first village's alone); and those met on the road. (The hedge-witch, and Greyminster's people:
// the second arc's, saint/saintSet.ts.)
export type StoryRole = 'carter' | 'barmaid' | 'smith' | 'herbalist' | 'bouncer' | 'villagerA' | 'villagerB' | 'nextBarmaid' | 'pedlar' | 'pilgrim' | 'guard' | 'witch' | 'bishop' | 'deacon' | 'captain' | 'sister' | 'pardoner' | 'prisoner';
// The nearest to its village (the first village's ruin: the one nearest the start); and the second arc's: the
// carter's wagon, the witch's village on the road out, the Minster's door in Greyminster, home (saint/saintSet.ts).
export type StoryPlace = 'ruin' | 'camp' | 'cave' | 'wagon' | 'onward' | 'minster' | 'home';

// What a quest asks before it can be handed in.
export type Objective =
  | { kind: 'bring'; item: LootId; count: number } // carried, and given over as it's handed in
  | { kind: 'slay'; foe: EnemyKind; count: number } // slain since it was taken, anywhere
  | { kind: 'reach'; place: StoryPlace; within: number } // come within so many tiles of
  | { kind: 'do'; what: 'clearCamp' | 'shift' | 'wish' | 'reliquary'; count: number }; // a bandit camp cleared, a shift worked at an inn, a coin tossed in a well, the Undercroft under the Minster cleared (its saint fallen)

// A thing given besides the coin: so many of something, or a piece of gear made at the village's level.
export type Gift = { item: LootId; count: number } | { gear: ItemId; least: Rarity };

export interface Told {
  village: string;
  giver: string; // whoever gives it, and whoever it's handed in to (the giver again, where there's no one)
  receiver: string;
  next: string; // the village nearest this one
  barmaid: string; // this village's keepers, by name (a village without one: "the smith")
  smith: string;
  carter: string; // (the first village's)
  camp: string; // the bandit camp nearest it, by name
  axe: boolean; // whether the hero has an axe to chop with (in hand or in the pack), as they speak
  chose?(id: StoryQuestId): string | undefined; // the way the hero took at a quest that was a choice (storyChoices.ts), if they took one
  did?(id: StoryQuestId): boolean; // whether the hero's done a quest (anywhere it's set: a road's, a pilgrim's coin)
}

export interface StoryQuest {
  id: StoryQuestId;
  name: string;
  scope: 'first' | 'village' | 'road' | 'saint';
  where?: 'home' | 'road' | 'town'; // (a 'saint' one) which of the second arc's places it's set in
  share?: number; // of the villages (a 'village' one): how many have it (all, unsaid)
  giver: StoryRole;
  receiver?: StoryRole;
  follows?: StoryQuestId; // on offer only once this one's done (in the same village)
  needs?: Objective;
  near?: StoryPlace; // where what's to be brought is found, if it's one kind of place: set only in villages with one near, and pointed to
  offer(t: Told): string[]; // the giver, offering it
  accept: string; // the hero's two answers
  decline: string;
  waiting(t: Told): string[]; // the giver again, while it's under way
  pending?(t: Told): string[]; // whoever takes it in, asked before it's ready (the giver's own waiting lines, where they're the same)
  after(t: Told): string[]; // the giver, once it's done
  task(t: Told): string; // what's to be done, in a line (the tracker, the journal)
  handIn(t: Told): string[]; // the receiver, as it's handed in (no receiver: never said)
  thanks: string; // the hero's answer, taking what's paid
  copper: number; // at a first-level village: more, the further out (story.ts)
  xpShare: number; // of a level's experience, at the village's level
  gift?: Gift;
  stake?: { copper: number } | { item: LootId; count: number }; // what the giver hands over as it's taken, to do it with (the silver for a well; potions for a fight): once, however often it's taken up again
  sex?: Build; // whoever gives it, where the words have them a man or a woman ("my wife", "my husband"): offered only by one (story.ts)
  night?: boolean; // handed in, the night's spent with whoever takes it: all health and energy back, and up in the morning (offered only by someone of the other sex than the hero's: story.ts)
  choice?: Choice[]; // its handing in a choice: each way its own answer, its word after and reward (storyChoices.ts); `thanks` unsaid
}

// A village's quest, with what most of them share said once.
export const villageQuest = (q: Omit<StoryQuest, 'scope' | 'accept' | 'decline' | 'thanks'> & Partial<Pick<StoryQuest, 'accept' | 'decline' | 'thanks'>>): StoryQuest => ({ scope: 'village', accept: "I'll do it.", decline: 'Not now.', thanks: 'Thank you.', ...q });
