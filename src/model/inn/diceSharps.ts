// The dice sharps: a few cheats who go from inn to inn, each known by name, each with their own patter (and their own
// fullams up a sleeve: inn/hazard.ts). Of an evening (EVENING), one may be sat at an inn's table waiting for a mark:
// at any inn about one night in four (TONIGHT), the same night and inn the same sharp on the same world. Caught out
// (diceTable.ts), they're thrown out and keep away from every inn for a few days (AWAY); back, they know the hero.

import type { Equipment } from '../human/equipment';
import { lookAt, type BodyLook, type Build, type Expression, type HairStyle } from '../human/humanoid';
import type { Entrance } from '../interiors/interiors';
import type { Npc } from '../npcs/npcs';
import { between, DAY_MINUTES } from '../clock';
import { hashUnit } from '../../util/random';

export const EVENING = { from: 18, till: 2 }; // the hours a sharp sits waiting for a mark
const TONIGHT = 0.25; // of a sharp's being at a given inn on a given night
export const AWAY = 3; // days a sharp caught out keeps away from every inn

export interface Sharp {
  key: string;
  name: string;
  build: Build;
  hair: HairStyle;
  face: Expression;
  wears: Equipment;
  hello: readonly string[]; // sitting down across from them
  again: readonly string[]; // back after the hero caught them out
  won: readonly string[]; // the hero's lost a game to them
  lost: readonly string[]; // the hero's won one
  caught: readonly string[]; // their dice found loaded
  wronged: readonly string[]; // cried foul on, honest dice
}

export const SHARPS: readonly Sharp[] = [
  {
    key: 'wat',
    name: 'Silver Wat',
    build: 'male',
    hair: 'long',
    face: 'sly',
    wears: { shoulders: 'travelCloak', ring: 'copperRing', neck: 'silverLocket' },
    hello: ["Sit, sit. A friendly game, small stakes, nobody gets hurt. That's my motto.", "You've an honest face. I like an honest face across the table."],
    again: ["You again. New dice, friend, fresh from the turner. Feel the weight if you like.", "No hard feelings, eh? I've forgiven you already."],
    won: ["The bones love me tonight.", "Hard luck, friend. Again?", "Ah, the dice giveth."],
    lost: ["Well thrown! Well thrown.", "You've the touch. Double it?", "Bah. Beginner's luck holds a while."],
    caught: ["These? Never seen them before in my life.", "Fine, fine! Take it. Take your coin and choke on it."],
    wronged: ["Loaded? Loaded? Weigh them yourself! Then pay me for the insult."],
  },
  {
    key: 'meg',
    name: 'Long Meg',
    build: 'female',
    hair: 'braid',
    face: 'cheerful',
    wears: { head: 'strawHat', shoulders: 'woolShawl', ring: 'copperRing' },
    hello: ["Fancy a throw, pet? I'm terrible at it. Ask anyone.", "Sit down, you're blocking my light. Dice?"],
    again: ["Oh, it's you. I've been saying my prayers since, I swear it.", "Come to rob a poor woman again, have you?"],
    won: ["Ooh! Did I win? I did!", "My dead mother's luck, that.", "Pay up, pet."],
    lost: ["Bugger. Again.", "You've done this before, haven't you?", "Well, piss on it."],
    caught: ["They were my mother's! She must have... oh, sod it. Take it.", "Get your hands off me, you great ox!"],
    wronged: ["You calling me a cheat? In front of everyone? That'll cost you, pet."],
  },
  {
    key: 'hob',
    name: 'Hob Nine-Lives',
    build: 'male',
    hair: 'shaggy',
    face: 'cheerful',
    wears: { head: 'linenCoif', torso: 'patchedTunic', legs: 'linenTrousers' },
    hello: ["Hob, they call me. Hob Nine-Lives. I've used seven. Throw?", "Room for one more at this table. Stakes on the board."],
    again: ["Ha! The one who nearly cost me my eighth life. Sit down, sit down.", "No grudges. Grudges are bad for the dice."],
    won: ["Nine lives and nine mains!", "That's my supper paid for.", "Oh, you'll get it back. Probably."],
    lost: ["Hah, take it. Easy come.", "You're a menace. Again.", "Bloody bones."],
    caught: ["Run, Hob!", "A man's got to eat, hasn't he? Fine. Fine!"],
    wronged: ["Straight as a pilgrim's road, those dice. You owe me for that."],
  },
  {
    key: 'agnes',
    name: 'Sister Agnes',
    build: 'female',
    hair: 'bun',
    face: 'calm',
    wears: { head: 'linenCoif', shoulders: 'travelCloak', neck: 'scallopShell' },
    hello: ["Every copper you lose goes to the new saint's shrine, child. Every one. Throw.", "A game for the cathedral's roof? The saint watches over the righteous."],
    again: ["The saint forgives you, child. I am still deciding.", "Penance, child. Sit, and do penance."],
    won: ["The saint provides.", "For the shrine, child. Bless you.", "Heaven smiles on the Church."],
    lost: ["The saint tests me.", "Hm. The Lord giveth to fools.", "Throw again. For your soul."],
    caught: ["Unhand a holy woman! ...Oh, very well. Take it, and may you itch.", "These dice are blessed! Blessed heavy. Fine."],
    wronged: ["Accuse a woman of the Church? Pay the shrine for that, sinner."],
  },
];

const sharpByKey = new Map(SHARPS.map((s) => [s.key, s]));
export const sharpOf = (key: string): Sharp | undefined => sharpByKey.get(key);

// The night (a day's number, from 0) the evening at `minutes` belongs to: past midnight, still the night before's.
export const nightOf = (minutes: number): number => Math.floor((minutes - EVENING.till * 60) / DAY_MINUTES);

// The sharp at inn `inn` (its door's number) on the evening of `minutes`, if any: one in TONIGHT, a sharp kept
// away (`away`: by their key, the night they may come back) not there.
export function sharpTonight(seed: number, inn: number, minutes: number, away: Readonly<Record<string, number>> = {}): Sharp | null {
  if (!between(minutes, EVENING.from, EVENING.till)) return null;
  const night = nightOf(minutes);
  if (hashUnit(inn, night, (seed % 1_000_003) + 811) >= TONIGHT) return null;
  const sharp = SHARPS[Math.floor(hashUnit(inn, night, (seed % 1_000_003) + 812) * SHARPS.length)];
  return (away[sharp.key] ?? -Infinity) > night ? null : sharp;
}

// The sharp as someone at the inn: a villager to look at, sat where they're put (diceHall.ts), not about any routine
// of their own (`led`). Their own face and clothes, the same everywhere.
export function sharpFigure(sharp: Sharp, inn: Entrance, village: Npc['village'], id: number): Npc {
  const k = SHARPS.indexOf(sharp);
  const look: BodyLook = { ...lookAt(901 + k * 17, 37 + k * 5, 0, sharp.build === 'female' ? 1 : 0), hairStyle: sharp.hair, expression: sharp.face, beard: sharp.build === 'male' && k % 2 === 0 };
  return {
    id,
    name: sharp.name,
    role: 'villager',
    look,
    equipment: { ...sharp.wears },
    home: inn,
    inn,
    village,
    field: null,
    where: inn,
    x: 0,
    z: 0,
    y: 0,
    facing: 0,
    seat: null,
    stood: null,
    stop: 0,
    steps: [],
    path: null,
    waited: 0,
    moving: false,
    working: false,
    salt: 0,
    led: true,
  };
}
