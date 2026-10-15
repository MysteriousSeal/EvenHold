// How the quests stand, as story.ts keeps them, and as they're saved with the game (and read back, an older save's too).
import { STORY_QUESTS } from './quests/catalog';
import type { Home, Point } from './storyCast';
import { idOf, keyed, type Kept } from './storyTypes';

export interface Ledger {
  forced: Map<string, number | null>; // those set by hand (the cheat's), by key: the villager put in the giver's part (their number; null: the village's own), kept through the world's changes and in the save
  freed: Set<string>; // and those let off what they follow
  staked: Set<string>; // those whose giver has handed over what it's done with (its `stake`): never again
  state: Map<string, 'taken' | 'done'>;
  untracked: Set<string>; // those taken but kept off the screen's tracker (set in the journal)
  counted: Map<string, number>; // what's been done toward each taken one (foes slain; a place reached, a thing done: 1)
  kept: Map<string, Kept>; // each taken one's people and village, for when they're off the maps
  home: Home; // the first village, once its line's taken up: kept, and in the save (storyCast.ts castOf)
  road: Point | null; // the second arc's witch's village, once the hero's sent there; Greyminster, once seen; the
  town: Point | null; // carter's name, once he's been met (saint/saintSet.ts; all in the save, an older save's: none)
  carter: string | null;
}

export type SavedStory = { states: Record<string, 'taken' | 'untracked' | 'done'>; counted: Record<string, number>; kept: Record<string, Kept>; forced: Record<string, number | null>; freed: string[]; staked: string[]; home?: Point; road?: Point; town?: Point; carter?: string; choices: Record<string, string> };

export function saveLedger(l: Ledger, choices: Record<string, string>): SavedStory {
  return {
    choices,
    states: Object.fromEntries([...l.state].map(([key, s]) => [key, s === 'taken' && l.untracked.has(key) ? 'untracked' : s])), // (untracked: taken, kept off the tracker)
    counted: Object.fromEntries(l.counted),
    kept: Object.fromEntries(l.kept),
    forced: Object.fromEntries(l.forced), // (the cheat's: what was set by hand, and let off what it follows)
    freed: [...l.freed],
    staked: [...l.staked],
    ...(l.home && l.home !== 'nearest' ? { home: l.home } : {}),
    ...(l.road ? { road: l.road } : {}),
    ...(l.town ? { town: l.town } : {}),
    ...(l.carter ? { carter: l.carter } : {}),
  };
}

const spot = (p: unknown): Point | null => {
  const { x, z } = (p ?? {}) as { x?: unknown; z?: unknown };
  return typeof x === 'number' && typeof z === 'number' ? { x, z } : null;
};

// (`data`: as saved; an older save's: its states alone, by their bare names: the first village's.)
export function loadLedger(data: unknown): Ledger {
  const saved = (data ?? {}) as { states?: Record<string, unknown>; counted?: Record<string, unknown>; kept?: Record<string, Kept>; forced?: Record<string, unknown>; freed?: unknown; staked?: unknown; home?: { x?: unknown; z?: unknown }; road?: unknown; town?: unknown; carter?: unknown } & Record<string, unknown>;
  const states = (saved.states && typeof saved.states === 'object' ? saved.states : saved) as Record<string, unknown>;
  const known = Object.entries(states).filter((e): e is [string, 'taken' | 'untracked' | 'done'] => idOf(e[0]) in STORY_QUESTS && (e[1] === 'taken' || e[1] === 'untracked' || e[1] === 'done'));
  const state = new Map(known.map(([id, s]) => [keyed(id), s === 'done' ? 'done' : 'taken'] as const));
  const named = (key: unknown): key is string => typeof key === 'string' && idOf(key) in STORY_QUESTS;
  return {
    state,
    untracked: new Set(known.filter(([, s]) => s === 'untracked').map(([id]) => keyed(id))),
    counted: new Map(Object.entries(saved.counted ?? {}).map(([id, n]) => [keyed(id), n] as const).filter((e): e is [string, number] => Number.isInteger(e[1]) && state.get(e[0]) === 'taken')),
    kept: new Map(Object.entries(saved.kept ?? {}).filter(([key]) => state.get(key) === 'taken')),
    forced: new Map(Object.entries(saved.forced ?? {}).filter(([key]) => named(key)).map(([key, id]) => [key, typeof id === 'number' ? id : null])),
    freed: new Set(Array.isArray(saved.freed) ? saved.freed.filter(named) : []),
    staked: new Set(Array.isArray(saved.staked) ? saved.staked.filter(named) : [...state.keys()].filter((key) => state.get(key) === 'taken')), // (an older save's: those under way had what they'd have been given)
    home: spot(saved.home) ?? ([...state.keys()].some((key) => key.endsWith('@first')) ? 'nearest' : null), // (an older save's line under way: where it was)
    road: spot(saved.road),
    town: spot(saved.town),
    carter: typeof saved.carter === 'string' ? saved.carter : null,
  };
}
