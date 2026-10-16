// What grows on the ground in each kind of country (model/scenery/biomes.ts): how thick its grass (of the meadow's: the
// meadows as they ever were), and its own plants (wildVoxels.ts), each a chance a tile and how many at most: ferns and
// mushrooms and fallen leaves in the woods, heather in clumps, bracken and thistles on the heath, reeds in the marsh (and in beds along any low shore), flat stones,
// pebbles and thistles on the hills. Kept few: each
// is drawn instanced, a draw a model a chunk, and the grass thinned where they grow (the woods and hills: shade, stone),
// so a tile costs about what it did.

import type { Biome } from '../../../model/scenery/biomes';

export type WildKind = 'fern' | 'bracken' | 'mushroom' | 'heather' | 'reed' | 'stone' | 'litter' | 'thistle';

export interface BiomeCover {
  grass: number; // the meadow's clumps times this
  short?: number; // and their size times this (1 if not said)
  pebbles: number; // a tile's chance of pebbles
  // (least: 1 if not said; drift: in drifts, so much of the ground in them (by stretches of a few tiles), none between,
  // and no grass under them)
  wild: ReadonlyArray<{ kind: WildKind; chance: number; most: number; least?: number; drift?: number }>;
}

export const BIOME_COVER: Record<Biome, BiomeCover> = {
  meadow: { grass: 1, pebbles: 0.04, wild: [] },
  forest: { grass: 0.3, pebbles: 0.03, wild: [{ kind: 'fern', chance: 0.35, most: 2 }, { kind: 'mushroom', chance: 0.07, most: 1 }, { kind: 'litter', chance: 0.2, most: 1 }] },
  heath: { grass: 0.3, short: 0.65, pebbles: 0.05, wild: [{ kind: 'heather', chance: 0.95, least: 2, most: 4, drift: 0.4 }, { kind: 'bracken', chance: 0.1, most: 2 }, { kind: 'thistle', chance: 0.05, most: 1 }, { kind: 'stone', chance: 0.015, most: 1 }] },
  marsh: { grass: 1.25, pebbles: 0, wild: [{ kind: 'reed', chance: 0.55, most: 3 }] },
  hills: { grass: 0.35, pebbles: 0.2, wild: [{ kind: 'stone', chance: 0.12, most: 1 }, { kind: 'thistle', chance: 0.07, most: 2 }] },
};
