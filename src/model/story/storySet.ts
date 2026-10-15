// Where each quest people give is set (story.ts): the first village's line in the first village; a village's own in
// each village that draws it (by its `share`, from the village's number and the world's seed: the same villages
// every time) and has its people and its place; one that follows another, only where that one is; the road's, nowhere (whoever's met gives it). Each set is kept by a key, the quest's and where it's
// set ("scrapForTheForge@8201", "wordToTheInn@first", "wolvesAtMyHeels@road"); the second arc's, in its own three
// places, those of them on the maps (saint/saintSet.ts). Worked out from the world as it stands, afresh only as that
// changes (storyCast.ts).
import type { Ruin } from '../ruins/ruins';
import type { EnemyKind } from '../types';
import { hashUnit } from '../../util/random';
import { COMMON_QUESTS, FIRST_QUESTS, RARE_QUESTS, ROAD_QUESTS, SAINT_QUESTS } from './quests/catalog';
import type { Carter } from './carter';
import { saintSettingOf, saintSettings, type SaintPins, type SaintSettings } from './saint/saintSet';
import { castKey, castOf, isTraveller, type CastHost, type Home, type Point, type Setting, type Who } from './storyCast';
import type { Objective, StoryPlace, StoryQuest } from './storyQuests';

export interface Instance {
  key: string;
  quest: StoryQuest;
  at: Setting | null; // where it's set (the road's: nowhere)
}

export interface QuestSet {
  key: string; // the world's, as it stood (storyCast.ts castKey)
  first: Setting | null;
  firstRuin: Ruin | null;
  villages: Setting[];
  all: Map<string, Instance>;
  by: Map<object, Instance[]>; // whose each is: given by them, or handed in to them
  road: Instance[];
  saint: SaintSettings; // the second arc's places, those on the maps
}

// Where a foe's kind keeps, for those that keep to a place.
const LAIR: Partial<Record<EnemyKind, StoryPlace>> = { ghost: 'ruin', skeleton: 'ruin', skeletonArcher: 'ruin', draugr: 'ruin', cryptLord: 'ruin', bandit: 'camp', banditChief: 'camp', caveSpider: 'cave', caveBat: 'cave', caveWorm: 'cave', broodMother: 'cave' };
// The place what a quest asks can't be done without, if any: the one to reach, its foes' lair, the camp to clear.
// (or where what it asks to be brought is found: its `near`).
export const placeOf = ({ needs, near }: { needs?: Objective; near?: StoryPlace }): StoryPlace | null => near ?? (needs?.kind === 'reach' ? needs.place : needs?.kind === 'slay' ? (LAIR[needs.foe] ?? null) : needs?.kind === 'do' && needs.what === 'clearCamp' ? 'camp' : null);

const COMMON_SALT = 9173; // (each list drawn its own way: one added to never moves the other's)
const RARE_SALT = 40127;

export const sameWorld = (set: QuestSet | null, host: CastHost): set is QuestSet => set?.key === castKey(host);

// What a quest is kept by, set there: its own name and the place's ("…@8201", "…@first", "…@road").
export const keyOf = (id: string, at: Setting | null | undefined): string => `${id}@${at?.key ?? 'road'}`;

// What a village lacks for a quest to be set there, in a word: whoever gives it, whoever takes it in, its place.
export function lacks(quest: StoryQuest, at: Setting | null): string | null {
  if (!at) return null;
  const place = placeOf(quest);
  return !at.who[quest.giver] ? `no ${quest.giver} here` : quest.receiver && !at.who[quest.receiver] ? `no ${quest.receiver} here` : place && !at.place[place] ? `no ${place} near` : quest.unless && at.place[quest.unless] ? `a ${quest.unless} near` : null;
}

// A quest set there: kept by its key, and by whoever gives it and whoever takes it in.
export function place(set: Pick<QuestSet, 'all' | 'by'>, quest: StoryQuest, at: Setting | null): Instance {
  const instance = { key: keyOf(quest.id, at), quest, at };
  set.all.set(instance.key, instance);
  for (const who of new Set([at?.who[quest.giver], quest.receiver && at?.who[quest.receiver]])) if (who) set.by.set(who, [...(set.by.get(who) ?? []).filter((i) => i.key !== instance.key), instance]);
  return instance;
}

// Where a quest would be set for `who` to give it, whether their village drew it or not (a cheat's: story.ts
// `replay`): their own village's setting, themselves in the giver's part (the opening line's, in the first village:
// its own); on the road, nowhere.
export function settingFor(set: Pick<QuestSet, 'first' | 'villages'>, quest: StoryQuest, who: Who): Setting | null {
  if (isTraveller(who)) return null;
  const home = 'village' in who ? set.villages.find((s) => s.village === who.village) : undefined;
  const base = quest.scope === 'first' && (!home || set.first?.village === home.village) ? set.first : home;
  return base ? cast(base, quest, who) : null;
}

// A setting with `who` in a quest's giver's part (as it is, where that's theirs already).
const cast = (at: Setting, quest: StoryQuest, who: Who | undefined): Setting => (!who || at.who[quest.giver] === who ? at : { ...at, who: { ...at.who, [quest.giver]: who } });

// Quests set by hand, set again in a world just worked out (a cheat's, kept in the save: `forced`, by key: who was
// put in the giver's part, if anyone); and any other under way that its village didn't draw (`taken`: an older
// save's), with the village's own people. Left out, where its village now lacks what it needs.
export function resettle(set: QuestSet, forced: ReadonlyMap<string, Who | undefined>, taken: Iterable<string>, quests: Record<string, StoryQuest>): void {
  for (const key of new Set([...forced.keys(), ...taken])) {
    const [id, spot] = key.split('@');
    const base = spot === 'first' ? set.first : set.villages.find((s) => s.key === spot);
    if (!quests[id] || !base || (set.all.has(key) && !forced.has(key))) continue;
    const at = cast(base, quests[id], forced.get(key));
    if (!lacks(quests[id], at)) place(set, quests[id], at);
  }
}

// (`pins`: the second arc's places, as kept: saint/saintSet.ts.)
export function settle(host: CastHost, home: Home = null, pins: { road: Point | null; town: Point | null } = { road: null, town: null }): QuestSet {
  const { first, firstRuin, villages } = castOf(host, home);
  const all = new Map<string, Instance>();
  const by = new Map<object, Instance[]>();
  const add = (quest: StoryQuest, at: Setting | null) => void (lacks(quest, at) ?? place({ all, by }, quest, at)); // (its people, its place: all there)
  const drawn = (quest: StoryQuest, i: number, at: Setting, salt: number) => hashUnit(Number(at.key), i, host.seed + salt) < (quest.share ?? 1);
  if (first) for (const quest of FIRST_QUESTS) add(quest, first);
  for (const at of villages) {
    const after = (quest: StoryQuest) => !quest.follows || all.has(keyOf(quest.follows, at)); // (one that follows another: only where that one is, as its words take it to be)
    COMMON_QUESTS.forEach((quest, i) => drawn(quest, i, at, COMMON_SALT) && after(quest) && add(quest, at));
    RARE_QUESTS.forEach((quest, i) => drawn(quest, i, at, RARE_SALT) && after(quest) && add(quest, at));
  }
  for (const quest of ROAD_QUESTS) add(quest, null);
  const saint = saintSettings(first, villages, { ...pins, home: home && home !== 'nearest' ? home : null, wagon: (first?.who.carter as Carter | undefined)?.wagon ?? null } satisfies SaintPins);
  for (const quest of SAINT_QUESTS) {
    const at = saintSettingOf(quest, saint);
    if (at) add(quest, at); // (its place off the maps: not set, till it's on them)
  }
  return { key: castKey(host), first, firstRuin, villages, all, by, road: [...all.values()].filter((i) => !i.at), saint };
}
