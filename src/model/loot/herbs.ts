// Herbs: what an alchemist picks in the wilds (skills/herbalism.ts) and brews with (skills/alchemy.ts), each in its own
// country and its own season (scenery/biomes.ts, clock.ts): chamomile in the spring and summer meadows and moors, rosehips on
// the autumn and winter briars, nettles in the woods and the marsh, foxglove on the summer moor, fly agaric under the
// autumn trees, hellebore through the winter snow, mandrake in the late marsh. Each wants the skill to know it when
// it's seen (as a vein wants a miner's: mining.ts), and every season has something to pick at every tier. Kept as
// ingredients (loot/ingredients.ts: a trade's goods, sold to a herbalist at their worth).

import type { Season } from '../clock';
import type { Biome } from '../scenery/biomes';
import type { LootEntry } from './lootEntry';

export const HERB_ITEMS = {
  chamomile: { name: 'Chamomile', value: 2, droppedBy: {} },
  rosehip: { name: 'Rosehips', value: 2, droppedBy: {} },
  nettle: { name: 'Nettle', value: 2, droppedBy: {} },
  yarrow: { name: 'Yarrow', value: 3, droppedBy: {} },
  mistletoe: { name: 'Mistletoe', value: 4, droppedBy: {} },
  woundwort: { name: 'Marsh woundwort', value: 4, droppedBy: {} },
  lavender: { name: 'Wild lavender', value: 5, droppedBy: {} },
  snowdrop: { name: 'Snowdrop', value: 5, droppedBy: {} },
  comfrey: { name: 'Comfrey', value: 6, droppedBy: {} },
  flyAgaric: { name: 'Fly agaric', value: 7, droppedBy: {} },
  foxglove: { name: 'Foxglove', value: 7, droppedBy: {} },
  hellebore: { name: 'Hellebore', value: 9, droppedBy: {} },
  mandrake: { name: 'Mandrake root', value: 12, droppedBy: {} },
  wolfsbane: { name: 'Wolfsbane', value: 12, droppedBy: {} },
} satisfies Record<string, LootEntry>;

export type HerbId = keyof typeof HERB_ITEMS;
export const HERB_IDS = Object.keys(HERB_ITEMS) as HerbId[];
export const isHerb = (item: string): item is HerbId => item in HERB_ITEMS;

export interface Herb {
  needs: number; // the skill it wants, to be known and picked (and its difficulty goes by)
  in: readonly Biome[]; // the country it grows in
  seasons: readonly Season[]; // and when it's up
  about: string; // where and when, in a line (the guide's)
}

export const HERBS: Record<HerbId, Herb> = {
  chamomile: { needs: 1, in: ['meadow', 'heath'], seasons: ['spring', 'summer'], about: 'Little white daisies in the spring and summer meadows, and on the dry moor.' },
  rosehip: { needs: 1, in: ['meadow', 'heath'], seasons: ['autumn', 'winter'], about: 'Red hips on the briars of the meadows and moors, from autumn into the winter.' },
  nettle: { needs: 25, in: ['forest', 'marsh'], seasons: ['spring', 'summer', 'autumn'], about: 'Stinging nettles in the woods and by the water, all but the winter.' },
  yarrow: { needs: 60, in: ['meadow', 'hills'], seasons: ['summer', 'autumn'], about: 'Flat white heads in the summer and autumn grass, meadow and hill.' },
  mistletoe: { needs: 60, in: ['forest'], seasons: ['autumn', 'winter'], about: 'Pale berries in the bare boughs of the woods, autumn and winter.' },
  woundwort: { needs: 90, in: ['marsh'], seasons: ['spring', 'summer', 'autumn'], about: 'Purple spikes in the marsh by the lakes, spring to autumn.' },
  lavender: { needs: 120, in: ['heath'], seasons: ['summer'], about: 'Grey-green and purple on the dry moor, in the summer only.' },
  snowdrop: { needs: 120, in: ['forest', 'meadow'], seasons: ['winter', 'spring'], about: 'White bells under the trees and in the grass, late winter into spring.' },
  comfrey: { needs: 150, in: ['marsh', 'meadow'], seasons: ['spring', 'summer'], about: "Knitbone: broad leaves in damp ground, spring and summer." },
  flyAgaric: { needs: 160, in: ['forest'], seasons: ['autumn'], about: 'Red caps flecked white under the deep woods, in the autumn.' },
  foxglove: { needs: 160, in: ['heath', 'hills'], seasons: ['summer'], about: 'Tall purple spires on the moors and the hills, in the summer.' },
  hellebore: { needs: 190, in: ['forest', 'hills'], seasons: ['winter', 'spring'], about: 'Christmas rose: up through the snow in the woods and the hills.' },
  mandrake: { needs: 230, in: ['marsh'], seasons: ['autumn', 'winter'], about: 'A forked root in the marsh, dug in autumn and winter. It screams; ignore it.' },
  wolfsbane: { needs: 230, in: ['hills', 'forest'], seasons: ['spring', 'summer'], about: 'Blue hoods in the hills and the high woods, spring and summer. Gloves on.' },
};

// The herbs up in a country in a season (none: nothing grows there then), in the order of the skill they want.
export const herbsIn = (country: Biome, season: Season): HerbId[] => HERB_IDS.filter((id) => HERBS[id].in.includes(country) && HERBS[id].seasons.includes(season));
