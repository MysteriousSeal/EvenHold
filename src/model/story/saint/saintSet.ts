// Where the second arc's quests are set ("The Bishop's Saint": quests/saintQuests*.ts, scope 'saint'), by their
// `where`: at home (the first village's setting, with the carter's wagon, and the witch's village to be reached);
// in the witch's village (the village with a hedge-witch nearest home, not home itself nor the cathedral town; kept
// once the hero's sent there, so the world streaming about never moves it); in Greyminster, the cathedral town (the
// village whose bishop lives there; its spot, off the maps, from the cathedral town's own reckoning, or as it was
// last seen). Each place's own, there only while that place is on the maps: what's under way keeps what it needs
// (story.ts `kept`), wherever the hero walks.
import type { Point, Setting } from '../storyCast';
import { nearest } from '../storyCast';
import type { StoryQuest } from '../storyQuests';

export interface SaintPins {
  home: Point | null; // the first village (kept since its line was taken up)
  road: Point | null; // the witch's village, once the hero's sent there
  town: Point | null; // Greyminster, as it was last seen, or as the cathedral town reckons it off the maps
  wagon: Point | null; // the carter's wagon, by the start
}

export interface SaintSettings {
  home: Setting | null;
  road: Setting | null;
  town: Setting | null;
}

const NEAR = 1; // tiles: a pinned spot is the village stood on it
const at = (s: Setting): Point => ({ x: s.village.x, z: s.village.z });
const door = (s: Setting): Point | undefined => {
  const keeper = s.who.bishop ?? s.who.sister;
  return keeper && 'home' in keeper ? { x: keeper.home.x, z: keeper.home.z } : undefined;
};

// The second arc's three places, from the world as it stands (`first`: the first village's setting; `villages`:
// every village's) and what's pinned.
export function saintSettings(first: Setting | null, villages: readonly Setting[], pins: SaintPins): SaintSettings {
  const town0 = villages.find((s) => s.who.bishop) ?? null;
  const townAt = town0 ? at(town0) : pins.town;
  const home = first ?? (pins.home && nearest(villages, at, pins.home, NEAR));
  const homeAt = pins.home ?? (home ? at(home) : null);
  const witchy = villages.filter((s) => s.who.witch && s.village !== home?.village && s.village !== town0?.village);
  const road0 = pins.road ? nearest(villages, at, pins.road, NEAR) : homeAt && nearest(witchy, at, homeAt);
  const roadAt = pins.road ?? (road0 ? at(road0) : null);
  const minster = town0 ? door(town0) : (townAt ?? undefined);
  return {
    home: first && { ...first, place: { ...first.place, wagon: pins.wagon ?? undefined, onward: roadAt ?? undefined }, names: { ...first.names, next: road0?.names.village ?? 'the next village' } },
    road: road0 && { ...road0, place: { ...road0.place, minster: minster } },
    town: town0 && { ...town0, place: { ...town0.place, minster, home: homeAt ?? undefined } },
  };
}

// Where a quest of the arc is set (null: that place isn't on the maps).
export const saintSettingOf = (quest: StoryQuest, settings: SaintSettings): Setting | null => settings[quest.where ?? 'home'];
