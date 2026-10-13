// What someone may be turned into (turned.ts), kind by kind, said once: the kinds themselves (`Into`), which of them
// are kept as one of the turned (`Beast`: all but a tree, which is one of the world's trees from then on, and a doll,
// which is a thing lying on the ground to be picked up); how many colourings each has (`COATS`: one theirs by
// chance); how each goes about (`GAIT`); and what's kept of each (`Hen`: the first of them was the hen).
import type { Humanoid } from '../human/humanoid';
import type { Point } from '../map/obstacles';
import type { Enemy } from '../types';
import type { Hung } from './hung';

export type Into = 'chicken' | 'horse' | 'cow' | 'bull' | 'statue' | 'tree' | 'pig' | 'sheep' | 'goat' | 'donkey' | 'toad' | 'rat' | 'cat' | 'ghost' | 'painting' | 'doll';
export const INTO: readonly Into[] = ['chicken', 'horse', 'cow', 'bull', 'statue', 'tree', 'pig', 'sheep', 'goat', 'donkey', 'toad', 'rat', 'cat', 'ghost', 'painting', 'doll'];
export type Beast = Exclude<Into, 'tree' | 'doll'>;
export const BEASTS: readonly Beast[] = INTO.filter((into): into is Beast => into !== 'tree' && into !== 'doll');

// The colourings each kind may have (their voxels': cowVoxels.ts and the rest), one theirs by chance as they're
// turned, kept with them. A kind not here has the one.
export const COATS = { cow: 4, bull: 4, pig: 3, sheep: 2, goat: 3, donkey: 2, toad: 2, rat: 2, cat: 4 } as const satisfies Partial<Record<Beast, number>>;
export type Coated = keyof typeof COATS;
export const coatsOf = (kind: Into): number => (COATS as Partial<Record<Into, number>>)[kind] ?? 0; // (0: none to choose among)
export const COW_COATS = COATS.cow;

// How each goes about: tiles a second (0: never moving), and the seconds stood between goes (a hen pecking, a horse
// grazing, a cow at her cud, a cat sat). `dash`: the most tiles gone at one go, from where they are (none: anywhere
// within ROAM of where they were turned, in one stroll). `hops`: each go a leap of just `dash`, told as it's made
// (`Hen.hop`). `drifts`: through whatever stands in the way (a ghost).
export interface Gait {
  pace: number;
  stood: [number, number];
  dash?: number;
  hops?: boolean;
  drifts?: boolean;
}
const STILL: Gait = { pace: 0, stood: [0, 0] };
export const GAIT: Record<Beast, Gait> = {
  chicken: { pace: 0.55, stood: [0.6, 2.2] },
  horse: { pace: 0.8, stood: [3, 9] },
  cow: { pace: 0.4, stood: [5, 14] },
  bull: { pace: 0.45, stood: [4, 11] },
  statue: STILL,
  pig: { pace: 0.5, stood: [2, 7] }, // rooting about, never long in one spot
  sheep: { pace: 0.36, stood: [6, 16] }, // at the grass
  goat: { pace: 0.65, stood: [2, 6] }, // brisk, and restless
  donkey: { pace: 0.3, stood: [7, 18] }, // slow to start, slow to get there
  toad: { pace: 1.5, stood: [1.5, 6], dash: 0.5, hops: true }, // sat; then a hop, half a tile of it
  rat: { pace: 1.7, stood: [0.3, 1.6], dash: 1.4 }, // a quick dash, a stop, another
  cat: { pace: 0.5, stood: [8, 24], dash: 2.5 }, // a few steps, and sat a long while
  ghost: { pace: 0.22, stood: [1, 4], drifts: true }, // the slowest of them, and never still for long
  painting: STILL,
};

// Who a statue, a ghost or a painting is of: someone (their look, what they wore), or a foe (its kind and number:
// itself, to be drawn again; a bandit's look and what they wore).
export interface Stone {
  foe?: Enemy['kind'];
  id: number;
  human?: Humanoid;
}
export const OF_SOMEONE: readonly Beast[] = ['statue', 'ghost', 'painting']; // (each of someone: of no one, none)
export const soundStone = (stone: unknown): stone is Stone => !!stone && typeof stone === 'object' && Number.isFinite((stone as Stone).id) && !!((stone as Stone).foe || (stone as Stone).human?.look);

export interface Hen {
  id: number;
  kind: Beast; // what they were turned into
  x: number;
  y: number;
  z: number;
  at: string | null; // where she is: out of doors (null), or in a building or down a dungeon (its door's: placeOf)
  from: Point; // where they were turned
  to: Point | null; // where she's strutting to, if anywhere
  peck: number; // seconds more stood pecking (a cat: sat)
  facing: number;
  coat?: number; // which of their kind's coats (COATS: 0 .. one less than it has), for a kind with any
  stone?: Stone; // a statue's, a ghost's, a painting's: who it's of
  hung?: Hung; // a painting's: the wall it hangs on, and the floor tile under it (its x, z: on that wall's face; its facing: out from it)
  hop?: number; // a toad's: 0 sat; in a hop, how far through it (over 0, up to 1 as it lands)
  up?: boolean; // upstairs in its building (the floor above has its door's place too)
  fresh?: boolean; // just turned (the view's: a puff of smoke as she's first seen)
}
