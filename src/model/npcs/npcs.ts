// Villagers: one to every house in a village, each living in their own. They
// go about a simple routine (npcRoutine.ts): a while at home, a stroll on
// the village square, a sit at the inn, the square again, then home. Each
// has a name and a look of their own, from the world's seed and where their
// house stands, so a village's folk are the same for everyone on that seed
// (and different on another). For now they wear nothing.

import { INDOOR_SCALE } from '../constants';
import { hashUnit } from '../../util/random';
import { lookAt, type Humanoid } from '../human/humanoid';
import type { Entrance } from '../interiors/interiors';
import type { Seat } from '../interiors/furniture';
import type { Point } from '../obstacles';
import type { Village } from '../types';

export const NPC_RADIUS = 0.14; // as wide as the hero
export const NPC_NEAR = 2.2; // how close the hero comes to see a villager's name

// One step of what a villager's doing: walking to a spot (in the space they're
// in: the world, or a room), going in or out through a door, settling down
// inside (which becomes sitting on a free seat, or standing somewhere), or
// staying put a while.
export type NpcStep =
  | { kind: 'go'; to: Point }
  | { kind: 'enter'; entrance: Entrance }
  | { kind: 'exit' }
  | { kind: 'settle'; for: number }
  | { kind: 'sit'; seat: Seat; for: number }
  | { kind: 'wait'; for: number };

export type NpcStop = 'home' | 'square' | 'inn';
export const ROUTINE: readonly NpcStop[] = ['home', 'square', 'inn', 'square'];

export interface Npc extends Humanoid {
  id: number;
  name: string;
  home: Entrance; // their house's door
  inn: Entrance | null; // their village's
  village: Village;
  where: Entrance | null; // the building they're in, or null outdoors
  x: number; // world coordinates outdoors, the room's indoors
  z: number;
  y: number;
  facing: number;
  seat: Seat | null; // what they're sitting (or lying) on
  stood: Point | null; // where they got up from, to stand back up to
  stop: number; // how far through ROUTINE
  steps: NpcStep[]; // what's left to do at this stop, the current step first
  path: Point[] | null; // tiles still to walk, while going somewhere
  waited: number; // seconds into the current wait
  moving: boolean;
  salt: number; // their own, from the seed: their routine's rolls (npcRoutine.ts)
}

const FIRST = [
  'Al', 'Bran', 'Ced', 'Ed', 'El', 'Gar', 'Hal', 'Is', 'Mar', 'Os', 'Ro', 'Wil', 'Ber', 'Ma', 'Gwen', 'Ada', 'Tho', 'Fen', 'Lu', 'Od', 'Ag',
  'Wyn', 'Aethel', 'Alar', 'Ald', 'Alf', 'Ang', 'Ans', 'Ar', 'Ash', 'Aud', 'Bald', 'Bar', 'Bea', 'Bel', 'Bern', 'Bert', 'Bla', 'Bor', 'Bri',
  'Bro', 'Cad', 'Cal', 'Car', 'Cath', 'Cel', 'Col', 'Con', 'Cor', 'Cuth', 'Dag', 'Dal', 'Dar', 'Del', 'Dor', 'Dun', 'Ead', 'Eal', 'Eld', 'Em',
  'Er', 'Eth', 'Ev', 'Fal', 'Far', 'Fin', 'Fla', 'Fri', 'Gal', 'Gil', 'Gis', 'Gle', 'God', 'Gor', 'Gre', 'Gun', 'Guth', 'Had', 'Har', 'Hed',
  'Hel', 'Her', 'Hil', 'Hro', 'Hug', 'Id', 'Ing', 'Ivo', 'Jor', 'Kat', 'Ken', 'Lan', 'Leo', 'Lin', 'Lor', 'Mab', 'Mal', 'Mel', 'Mil', 'Mor',
  'Nor', 'Oda', 'Orm', 'Osw', 'Per', 'Quen', 'Rad', 'Ran', 'Reg', 'Ric', 'Ros', 'Sal', 'Sib', 'Sig', 'Tam', 'Tor', 'Ul', 'Wal', 'Wen', 'Wid',
  'Win', 'Yse',
];
const LAST = [
  'ric', 'wyn', 'da', 'mund', 'bert', 'ia', 'ard', 'win', 'el', 'fred', 'gar', 'ine', 'ald', 'lyn', 'wen', 'ric', 'mer', 'ette', 'ach', 'ain',
  'al', 'an', 'and', 'ane', 'ax', 'bald', 'bern', 'beth', 'bold', 'bur', 'by', 'can', 'cott', 'dane', 'del', 'den', 'dith', 'don', 'dor',
  'dric', 'dun', 'ed', 'ella', 'en', 'er', 'eth', 'fast', 'ferd', 'fin', 'ford', 'frith', 'gard', 'geat', 'gith', 'gund', 'hard', 'helm',
  'hild', 'hold', 'ian', 'ing', 'is', 'ith', 'ivar', 'la', 'lac', 'laf', 'land', 'leof', 'ley', 'lin', 'lo', 'ma', 'mar', 'mon', 'mond',
  'mot', 'na', 'nard', 'ne', 'nor', 'old', 'on', 'or', 'ot', 'oth', 'ra', 'rad', 'ran', 'red', 'ren', 'rid', 'rin', 'rod', 'ron', 'ry', 'sa',
  'sel', 'son', 'stan', 'ta', 'thor', 'ton', 'tram', 'trude', 'ulf', 'un', 'valde', 'ver', 'vin', 'ward', 'wald', 'wig', 'wine', 'wolf',
  'wulf', 'bryn', 'cyn',
];

// A name from the world's seed and where someone lives: the same house on
// the same seed, the same name.
export function nameAt(x: number, z: number, seed = 0): string {
  const pick = <T>(list: readonly T[], salt: number) => list[Math.floor(hashUnit(Math.round(x * 10), Math.round(z * 10), seed * 131 + salt) * list.length)];
  return pick(FIRST, 71) + pick(LAST, 72);
}

// One villager for every house, living in the village it stands in (the
// nearest), going to that village's inn; each starts at home, at a point
// of the routine from their house, so a village isn't all in step.
export function spawnNpcs(seed: number, entrances: readonly Entrance[], villages: readonly Village[]): Npc[] {
  const nearest = <T extends { x: number; z: number }>(list: readonly T[], x: number, z: number) =>
    list.reduce<T | null>((best, v) => (!best || Math.hypot(v.x - x, v.z - z) < Math.hypot(best.x - x, best.z - z) ? v : best), null);
  const inns = entrances.filter((e) => e.type === 'inn');
  return entrances
    .filter((e) => e.type === 'house')
    .flatMap((home, id) => {
      const village = nearest(villages, home.x, home.z);
      if (!village) return [];
      const inn = nearest(inns, village.x, village.z);
      const npc: Npc = {
        id,
        name: nameAt(home.x, home.z, seed),
        look: lookAt(Math.round(home.x * 10), Math.round(home.z * 10), seed),
        equipment: {}, // naked, for now
        home,
        inn: inn && Math.hypot(inn.x - village.x, inn.z - village.z) < 6 ? inn : null,
        village,
        where: home,
        x: 0,
        z: 0,
        y: 0,
        facing: 0,
        seat: null,
        stood: null,
        stop: 1, // home, where they start, done
        steps: [{ kind: 'settle', for: 5 + hashUnit(Math.round(home.x * 10), Math.round(home.z * 10), seed * 131 + 73) * 40 }],
        path: null,
        waited: 0,
        moving: false,
        salt: Math.floor(hashUnit(id, seed % 1_000_003, 74) * 1_000_000),
      };
      return [npc];
    });
}

// Whether a step of a walker of half-width r from `from` to (x, z), in
// `where`, bumps into a villager there: refused if it would overlap one and
// bring the two closer (stepping away is always allowed, so no one gets pinned).
export function bumpsNpc(npcs: readonly Npc[], where: Entrance | null, from: Point, x: number, z: number, r: number): boolean {
  return npcs.some((npc) => {
    if (npc.where !== where) return false;
    const reach = r + NPC_RADIUS * (where ? INDOOR_SCALE : 1); // drawn bigger indoors
    if (Math.abs(npc.x - x) >= reach || Math.abs(npc.z - z) >= reach) return false;
    return Math.hypot(npc.x - x, npc.z - z) < Math.min(reach, Math.hypot(npc.x - from.x, npc.z - from.z));
  });
}
