// What the story (story.ts) says and keeps, as the rest of the game sees it: a talk, a quest under way, a mark over
// someone's head, the cheat's list; what it asks of the game; and how a quest is keyed.
import type { Entrance } from '../interiors/interiors';
import type { Npc } from '../npcs/npcs';
import type { Enemy, GameEvent, Hero } from '../types';
import type { Pace, PaceVoice } from '../jobs/room/pace';
import type { Carter } from './carter';
import type { CastHost, Point } from './storyCast';
import type { RestockHost } from './storyRestock';
import type { StoryQuest } from './storyQuests';

export type StoryMark = 'offer' | 'waiting' | 'ready'; // "!", a grey "?", a gold "?"
export interface Talk {
  speaker: string;
  lines: string[];
  quest?: { name: string; task: string; copper: number; xp: number; gift: string; state: 'offered' | 'handIn' }; // the quest it's about, shown under the lines
  night?: () => void; // a night passes before its last line (the screen gone black): called in the dark, it's morning (the clock at eight, all health and energy back)
  // A game of pace played in the dark once its last line's said (model/jobs/room/pace.ts): whose pace, and what's
  // said next, by how it went (0 to 1).
  pace?: { pace: Pace; with: string; voice?: PaceVoice; bare?: boolean; done(score: number): Talk }; // (`voice`: what they say as it goes; `bare`: whoever it's with shown with nothing on while it's played)
  later?: string; // what the black says as that time passes (unsaid: "The next morning")
  answers: Array<{ label: string; primary?: boolean; trade?: boolean; out?: boolean; pick(): void | Talk }>; // (what it does; a talk given back: said next, in the same breath; `out`: the one Escape gives, where it's not simply the first that commits to nothing) // the hero's (none: just "Farewell"; `trade`: on to their wares)
}
// A quest under way, as the tracker and the journal tell it.
export interface TakenStory {
  id: string; // its key
  name: string;
  task: string;
  ready: boolean;
  tracked: boolean;
  have: number; // of what it asks: how far along (1 of 1, where it asks nothing)
  of: number;
  to: Carter | Npc | null; // who it's handed in to (no one: done as what it asks is; or off the maps just now)
  toName: string;
  fromName: string;
  door: Entrance | null; // the building they're in, if they're indoors
  goal: Point | null; // where what it still asks is to be done, or (ready) where to go back to, if they're off the maps
  within: Entrance | null; // the building what it still asks is done in (a shift: the inn), if it's indoors
}

// A quest under way's people and village, by name, and where its village is: for when they're off the maps. (`village`,
// `next`, `camp`: since saves of 2026-10; an older save's, unsaid. `goal`: the place it asks to be reached, kept for
// when its own setting's off the maps: the second arc's, whose roads run from one place to the next.)
export type Kept = { to: string; from: string; x: number; z: number; village?: string; next?: string; camp?: string; goal?: Point };

export interface StoryHost extends CastHost, RestockHost {
  readonly hero: Hero;
  minutes: number; // the game's clock (a night spent: on to the morning)
  readonly folk: readonly Npc[];
  readonly enemies: readonly Enemy[];
  readonly entrances: readonly Entrance[];
  readonly inside: { entrance: Entrance } | null;
  readonly quests?: { trackRoom: boolean }; // the boards' quests: whether the screen takes one more tracked
  readonly lumber?: { axe: boolean }; // whether they've an axe to chop with (what's said of it)
  report(event: GameEvent): void;
  wakeWith?(who: Npc): void; // a night spent with them: woken in their place, beside them (nights.ts)
  takeAway?(who: Npc): void; // someone taken away for good (by the men in grey: a choice's `gone`, storyChoices.ts)
  cathedralTown?(): Point | null; // where Greyminster stands, off the maps too (the cathedral town's own reckoning)
  readonly heat?: { raise(where: Point, amount: number, why: string): void; calm(where: Point, amount: number): void }; // the witch-finders' heat on the hero, by village (roads/heat.ts): a choice's `heat`
}

// A quest of someone's, as the cheat's list tells it (controller/cheats/questDebug.ts).
export interface DebugQuest {
  id: string;
  key: string; // as it would be kept, set with them
  name: string;
  scope: StoryQuest['scope'];
  rare: boolean; // (its village drew it, or didn't)
  state: 'locked' | 'offered' | 'taken' | 'done';
  set: boolean; // theirs already, in this world
  lacks: string | null; // why it can't be played here, if it can't
}

export const idOf = (key: string): string => key.split('@')[0];
export const keyed = (id: string): string => (id.includes('@') ? id : `${id}@first`); // (a bare name: the first village's)
