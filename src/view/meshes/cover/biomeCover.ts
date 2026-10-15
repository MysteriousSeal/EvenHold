// What grows on the ground in each kind of country (model/scenery/biomes.ts): how thick its grass (of the meadow's: the
// meadows as they ever were), and its own plants (wildVoxels.ts), each a chance a tile and how many at most: ferns and
// mushrooms and fallen leaves in the woods, heather on the heath, reeds in the marsh, flat stones and pebbles on the hills. Kept few: each
// is drawn instanced, a draw a model a chunk, and the grass thinned where they grow (the woods and hills: shade, stone),
// so a tile costs about what it did.

import type { Biome } from '../../../model/scenery/biomes';

export type WildKind = 'fern' | 'mushroom' | 'heather' | 'reed' | 'stone' | 'litter';

export interface BiomeCover {
  grass: number; // the meadow's clumps times this
  pebbles: number; // a tile's chance of pebbles
  wild: ReadonlyArray<{ kind: WildKind; chance: number; most: number }>;
}

export const BIOME_COVER: Record<Biome, BiomeCover> = {
  meadow: { grass: 1, pebbles: 0.04, wild: [] },
  forest: { grass: 0.3, pebbles: 0.03, wild: [{ kind: 'fern', chance: 0.45, most: 2 }, { kind: 'mushroom', chance: 0.07, most: 1 }, { kind: 'litter', chance: 0.4, most: 2 }] },
  heath: { grass: 0.45, pebbles: 0.06, wild: [{ kind: 'heather', chance: 0.3, most: 2 }, { kind: 'stone', chance: 0.015, most: 1 }] },
  marsh: { grass: 1.25, pebbles: 0, wild: [{ kind: 'reed', chance: 0.4, most: 3 }] },
  hills: { grass: 0.35, pebbles: 0.16, wild: [{ kind: 'stone', chance: 0.07, most: 1 }] },
};
