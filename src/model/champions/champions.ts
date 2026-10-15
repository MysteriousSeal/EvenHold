// The named champions in the deep: now and then a crypt, a cave or a stronghold has one (CHAMPION_CHANCE, from the
// seed and where it lies, the same every time), standing among its foes deeper in: a foe with a name, a title and a
// trait of its own (what its fight does that its kind's doesn't: championRun.ts). A level over the place, it hits
// harder, has more health and more poise (a blow more to flinch it: enemies/poise.ts), is worth more to learn from,
// carries more coin, and always leaves a rare piece at the least, its own kind's set's half the time
// (loot/gearDrops.ts). Not one of the place's posts (dungeons/dungeonRecord.ts CHAMPION_POST): a place cleared before
// it came still has it, and its share cleared is the same with it or without; slain, it stays slain.

import type { EnemyKind } from '../types';
import { hashUnit, oneOf } from '../../util/random';

export type ChampionHome = 'crypt' | 'cave' | 'stronghold';
// What a champion's fight does past its kind's: wakes again once, felled (unburied); its brood poured out at half its
// health (brood); quickening, a third of it left (frenzy); its fire-pots three at a throw (pots).
export type ChampionTrait = 'unburied' | 'brood' | 'frenzy' | 'pots';

export interface Champion {
  home: ChampionHome;
  kind: EnemyKind;
  name: string;
  title: string; // after the name ("the Unburied")
  trait: ChampionTrait;
  told: string; // its trait, as the target's frame tells it
  brood?: { kind: EnemyKind; count: number }; // what it calls up (brood)
}

export const CHAMPIONS = {
  brannoc: { home: 'crypt', kind: 'draugr', name: 'Old Brannoc', title: 'the Unburied', trait: 'unburied', told: 'Wakes again once' },
  ysolde: { home: 'crypt', kind: 'skeleton', name: 'Sister Ysolde', title: 'of the Nails', trait: 'frenzy', told: 'Quickens as she breaks' },
  godric: { home: 'crypt', kind: 'skeleton', name: 'Ser Godric', title: 'Twice-Hanged', trait: 'brood', told: 'Calls up his hanged men at half', brood: { kind: 'skeleton', count: 2 } },
  weeping: { home: 'cave', kind: 'caveSpider', name: 'The Weeping Spider', title: '', trait: 'brood', told: 'Her brood pours out at half', brood: { kind: 'hatchling', count: 5 } },
  gullet: { home: 'cave', kind: 'caveWorm', name: 'Old Gullet', title: 'the Bottomless', trait: 'frenzy', told: 'Quickens as it bleeds' },
  shroud: { home: 'cave', kind: 'caveSpider', name: 'Grandmother Shroud', title: '', trait: 'unburied', told: 'Plays dead once' },
  hob: { home: 'stronghold', kind: 'firebrand', name: 'Gutless Hob', title: '', trait: 'pots', told: 'Fire-pots, many' },
  wat: { home: 'stronghold', kind: 'bruiser', name: 'Big Wat', title: 'Ninefingers', trait: 'frenzy', told: 'Quickens as he bleeds' },
  meg: { home: 'stronghold', kind: 'crossbowman', name: 'Long Meg', title: 'of the Gibbet', trait: 'brood', told: 'Whistles up her lads at half', brood: { kind: 'runner', count: 2 } },
} as const satisfies Record<string, Champion>;

export type ChampionId = keyof typeof CHAMPIONS;
export const CHAMPION_IDS = Object.keys(CHAMPIONS) as ChampionId[];

export const CHAMPION_CHANCE = 0.35; // of a dungeon, that it has one
export const CHAMPION_HP = 2.2; // its health, of its kind's a level over the place
export const CHAMPION_DAMAGE = 1.3; // its blows, of its kind's
export const CHAMPION_XP = 4; // what it's worth to learn from, of its kind's
export const CHAMPION_COINS = 3; // the coin it carries, of its kind's

// Its whole name, as it's shown: "Old Brannoc the Unburied", "Gutless Hob".
export const championName = (id: ChampionId): string => [CHAMPIONS[id].name, CHAMPIONS[id].title].filter(Boolean).join(' ');

// The champion of the dungeon of `home` lying at `at` (its way in), or null: none there. The same every time.
export function championOf(home: ChampionHome, seed: number, at: { x: number; z: number }): ChampionId | null {
  if (hashUnit(Math.round(at.x * 2), Math.round(at.z * 2), seed + 6151) >= CHAMPION_CHANCE) return null;
  return oneOf(CHAMPION_IDS.filter((id) => CHAMPIONS[id].home === home), hashUnit(Math.round(at.x * 2), Math.round(at.z * 2), seed + 6157));
}
