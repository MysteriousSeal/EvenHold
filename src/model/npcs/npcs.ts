// Villagers: one to every house in a village, each living in their own, and
// two barmaids in every inn, who live and work there (innStaff.ts). Villagers
// go about a simple routine (npcRoutine.ts): a while at home, a stroll on
// the village square, a sit at the inn, the square again, then home; some
// are farmers, working a field by the village instead of strolling. Each
// has a name and a look of their own, from the world's seed and where their
// house stands, so a village's folk are the same for everyone on that seed
// (and different on another). For now they wear nothing.

import { INDOOR_SCALE } from '../constants';
import { hashUnit } from '../../util/random';
import { lookAt, type Build, type Humanoid } from '../human/humanoid';
import type { Entrance } from '../interiors/interiors';
import type { Seat } from '../interiors/furniture';
import type { Point } from '../obstacles';
import type { Field, Village } from '../types';

export const NPC_RADIUS = 0.14; // as wide as the hero
export const NPC_NEAR = 2.2; // how close the hero comes to see a villager's name

// One step of what a villager's doing: walking to a spot (in the space they're
// in: the world, or a room), going in or out through a door, settling down
// inside (which becomes sitting on a free seat, or standing somewhere), or
// staying put a while.
// (A walk can go `direct`, in a straight line with no path found, and end
// turned to `face` a way or toward a point.)
export type NpcStep =
  | { kind: 'go'; to: Point; direct?: boolean; face?: number; faceToward?: Point }
  | { kind: 'enter'; entrance: Entrance }
  | { kind: 'exit' }
  | { kind: 'settle'; for: number }
  | { kind: 'sit'; seat: Seat; for: number }
  | { kind: 'work'; for: number } // bent over the crops, in a field
  | { kind: 'wait'; for: number }
  | { kind: 'hand'; then(): void }; // something done there and then (a drink picked up, handed over)

export type NpcStop = 'home' | 'square' | 'inn' | 'field';
export const ROUTINE: readonly NpcStop[] = ['home', 'square', 'inn', 'square'];
// A farmer's day: their field instead of the square.
export const FARMER_ROUTINE: readonly NpcStop[] = ['home', 'field', 'inn', 'field'];
const FARMER_CHANCE = 0.4; // of a villager with a field near their village working it
const FIELD_NEAR = 15; // tiles from the village's middle

export type NpcRole = 'villager' | 'barkeep' | 'server';

// What a villager is called by, after their name, if anything: "Adawen (Barmaid)".
const TITLES: Record<NpcRole, string | null> = { villager: null, barkeep: 'Barmaid', server: 'Waitress' };
export function titleOf(npc: Npc): string {
  const title = TITLES[npc.role];
  return title ? `${npc.name} (${title})` : npc.name;
}

export interface Npc extends Humanoid {
  id: number;
  name: string;
  role: NpcRole;
  home: Entrance; // their house's door (a barmaid's, the inn's)
  inn: Entrance | null; // their village's
  village: Village;
  field: Field | null; // the one they work, a farmer's (null for everyone else)
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
  working: boolean; // bent over the crops
  carrying?: boolean; // a tankard in hand (the barmaid, bringing an ale)
  salt: number; // their own, from the seed: their routine's rolls (npcRoutine.ts)
}

// First parts: some anyone's, some only men's, some only women's.
const FIRST = [
  'Al', 'Ed', 'El', 'Mar', 'Os', 'Ro', 'Ber', 'Fen', 'Od', 'Ag', 'Wyn', 'Aethel', 'Alar', 'Ald', 'Ang', 'Ar', 'Ash', 'Aud', 'Bar', 'Bel',
  'Bla', 'Bri', 'Cal', 'Car', 'Cath', 'Cel', 'Col', 'Dal', 'Del', 'Dor', 'Ead', 'Eal', 'Eld', 'Er', 'Eth', 'Fal', 'Fin', 'Fla', 'Fri', 'Gal',
  'Gil', 'Gis', 'Gle', 'Gre', 'Hed', 'Hel', 'Her', 'Hil', 'Id', 'Ing', 'Lan', 'Lor', 'Mil', 'Nor', 'Quen', 'Sal', 'Wen', 'Win',
];
const MALE_FIRST = [
  'Bran', 'Ced', 'Gar', 'Hal', 'Wil', 'Tho', 'Bald', 'Bern', 'Bert', 'Cuth', 'Dag', 'Dun', 'Guth', 'Gun', 'God', 'Hro', 'Hug', 'Orm', 'Osw',
  'Reg', 'Ric', 'Sig', 'Tor', 'Wal', 'Wid', 'Alf', 'Ans', 'Cad', 'Con', 'Cor', 'Dar', 'Far', 'Gor', 'Had', 'Har', 'Ivo', 'Jor', 'Ken', 'Leo',
  'Mal', 'Mor', 'Per', 'Rad', 'Ran', 'Tam', 'Bor', 'Bro', 'Ul',
];
const FEMALE_FIRST = [
  'Gwen', 'Ada', 'Ma', 'Mab', 'Mel', 'Kat', 'Sib', 'Yse', 'Bea', 'Oda', 'Em', 'Ev', 'Ros', 'Lin', 'Lu', 'Is',
];
// Endings for men's names, and for women's (Ead-ric, Ead-gith).
const MALE_LAST = [
  'ric', 'mund', 'bert', 'ard', 'win', 'el', 'fred', 'gar', 'ald', 'mer', 'ach', 'ain', 'al', 'an', 'and', 'ax', 'bald', 'bern', 'bold',
  'bur', 'by', 'can', 'cott', 'dane', 'del', 'den', 'don', 'dor', 'dric', 'dun', 'ed', 'er', 'fast', 'ferd', 'fin', 'ford', 'gard', 'geat',
  'gund', 'hard', 'helm', 'hold', 'ian', 'ing', 'ivar', 'lac', 'laf', 'land', 'leof', 'lo', 'mar', 'mon', 'mond', 'mot', 'nard', 'nor', 'old',
  'on', 'or', 'ot', 'oth', 'rad', 'ran', 'red', 'rid', 'rin', 'rod', 'ron', 'son', 'stan', 'thor', 'ton', 'tram', 'ulf', 'un', 'valde', 'ver',
  'vin', 'ward', 'wald', 'wig', 'wine', 'wolf', 'wulf', 'bryn', 'cyn',
];
const FEMALE_LAST = [
  'wyn', 'ia', 'ine', 'lyn', 'wen', 'ette', 'ella', 'beth', 'dith', 'hild', 'gith', 'trude', 'la', 'ma', 'na', 'sa', 'ta', 'ra', 'frith',
  'lin', 'a', 'ina', 'elle', 'ana', 'anna', 'ara', 'ea', 'eda', 'elda', 'enna', 'etta', 'eva', 'ilda', 'isa', 'ise', 'issa', 'iva', 'lina',
  'lise', 'mina', 'nora', 'rada', 'rith', 'rune', 'sine', 'thea', 'tha', 'tilde', 'una', 'unn', 'vina', 'wara', 'wina', 'ynn', 'yth', 'ada',
  'aine', 'alia', 'ayne', 'bera', 'bryd', 'cia', 'dis', 'drun', 'eyn', 'flaed', 'gunn', 'hilda', 'iel', 'leda', 'linde', 'lotte', 'lyse',
  'nys', 'oda', 'rika', 'rose', 'ryth', 'sanne', 'sia', 'thild', 'ula', 'vera', 'ynne', 'yse', 'zelle', 'bella', 'eline', 'gifu', 'burh',
  'swith', 'thryth', 'isolde', 'wynn', 'ota', 'wenna', 'elwyn', 'ilde', 'osa', 'leofa', 'ith', 'eth', 'da',
];

const MEN_FIRST = [...FIRST, ...MALE_FIRST];
const WOMEN_FIRST = [...FIRST, ...FEMALE_FIRST];

// A name from the world's seed and where someone lives (the same house on
// the same seed, the same name), a man's or a woman's by their build.
export function nameAt(x: number, z: number, seed = 0, build: Build = 'male'): string {
  const pick = <T>(list: readonly T[], salt: number) => list[Math.floor(hashUnit(Math.round(x * 10), Math.round(z * 10), seed * 131 + salt) * list.length)];
  const woman = build === 'female';
  return pick(woman ? WOMEN_FIRST : MEN_FIRST, 71) + pick(woman ? FEMALE_LAST : MALE_LAST, 72);
}

// A name picked at random, a man's or a woman's by their build (the hero's, each game).
export function randomName(build: Build): string {
  const roll = () => Math.random() * 100_000;
  return nameAt(roll(), roll(), Math.floor(roll()), build);
}

// One villager for every house, living in the village it stands in (the
// nearest), going to that village's inn; each starts at home, at a point
// of the routine of their own, so a village isn't all in step. Then two
// barmaids in every inn, starting at work.
export function spawnNpcs(seed: number, entrances: readonly Entrance[], villages: readonly Village[], fields: readonly Field[] = []): Npc[] {
  const nearest = <T extends { x: number; z: number }>(list: readonly T[], x: number, z: number) =>
    list.reduce<T | null>((best, v) => (!best || Math.hypot(v.x - x, v.z - z) < Math.hypot(best.x - x, best.z - z) ? v : best), null);
  const person = (id: number, role: NpcRole, home: Entrance, inn: Entrance | null, village: Village, at: Point): Npc => {
    const look = lookAt(Math.round(at.x * 10), Math.round(at.z * 10), seed, role === 'villager' ? 0.5 : 1); // about half the village's folk women; the inn's barmaids always
    return {
      id,
      name: nameAt(at.x, at.z, seed, look.build),
      role,
      look,
      equipment: {}, // naked, for now
      home,
      inn,
      village,
      field: null,
      where: home,
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
      salt: Math.floor(hashUnit(id, seed % 1_000_003, 74) * 1_000_000),
    };
  };
  const inns = entrances.filter((e) => e.type === 'inn');
  const villagers = entrances
    .filter((e) => e.type === 'house')
    .flatMap((home, id) => {
      const village = nearest(villages, home.x, home.z);
      if (!village) return [];
      const inn = nearest(inns, village.x, village.z);
      const npc = person(id, 'villager', home, inn && Math.hypot(inn.x - village.x, inn.z - village.z) < 6 ? inn : null, village, home);
      // At home to begin with, a while, then on from a point of the routine of their own.
      npc.stop = Math.floor(hashUnit(id, seed % 1_000_003, 75) * ROUTINE.length);
      npc.steps = [{ kind: 'settle', for: 5 + hashUnit(Math.round(home.x * 10), Math.round(home.z * 10), seed * 131 + 73) * 40 }];
      // Some work the field nearest their village, if there's one near.
      const field = nearest(fields.map((f) => ({ f, x: f.x0 + f.width / 2, z: f.z0 + f.depth / 2 })), village.x, village.z);
      if (field && Math.hypot(field.x - village.x, field.z - village.z) < FIELD_NEAR && hashUnit(id, seed % 1_000_003, 76) < FARMER_CHANCE) npc.field = field.f;
      return [npc];
    });
  const staff = inns.flatMap((inn, i) => {
    const village = nearest(villages, inn.x, inn.z);
    if (!village) return [];
    const id = entrances.length + i * 2;
    return (['barkeep', 'server'] as const).map((role, k) => person(id + k, role, inn, inn, village, { x: inn.x + 0.3 * (k + 1), z: inn.z - 0.2 }));
  });
  return [...villagers, ...staff];
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
