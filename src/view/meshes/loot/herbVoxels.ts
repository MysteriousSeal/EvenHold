// Herbs in voxels (loot/herbs.ts), grid-aligned only, each a bunch as it's picked and tied: stems 1 up out of a
// twist of twine 6, leaves 2 (lit 3) off them, and its heads over the top in its own colour 4 (lit 5): a spike of
// purple (lavender, woundwort, foxglove, wolfsbane's blue), a flat white head (chamomile, yarrow, snowdrop,
// hellebore), berries (rosehips red, mistletoe pale), broad leaves alone (nettle, comfrey); and two that aren't
// bunches: a fly agaric's red cap flecked white on its pale stalk, a mandrake's forked root, a tuft on its crown.
// Read by its colour first (the heads), its shape second, at the size of a coin on the ground.

import type { HerbId } from '../../../model/loot/herbs';
import { fillBox, setColor } from '../voxel/voxelShapes';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { model, type LootModel } from './lootModel';

type Heads = 'spike' | 'flat' | 'berry' | 'leaf';
const STEM = 0x4e7a32;
const LEAF = 0x3f6a2a;
const LEAF_LIT = 0x6e9c44;
const TWINE = 0xb89a68;

// The bunch: three stems up the middle (x 1..3 at z 2), tied low, a leaf out each side half way up; then its heads.
function bunch(heads: Heads, [head, lit]: [number, number], leaf = LEAF): LootModel {
  return model([STEM, leaf, LEAF_LIT, head, lit, TWINE], [5, 8, 5], (g) => {
    for (const x of [1, 2, 3]) fillBox(g, x, 0, 2, x, 4, 2, 1);
    fillBox(g, 1, 1, 1, 3, 1, 3, 6); // the twine round them
    fillBox(g, 0, 3, 2, 0, 3, 2, 2);
    fillBox(g, 4, 2, 2, 4, 2, 2, 3);
    setColor(g, 2, 3, 1, 3);
    setColor(g, 2, 2, 3, 2);
    if (heads === 'leaf') {
      // Broad leaves, rough-edged, up the stems and over the top (a nettle's, a comfrey's).
      fillBox(g, 0, 4, 1, 4, 5, 3, (x, y, z) => ((x + z + y) % 3 === 0 ? 3 : (x === 0 || x === 4) && z !== 2 ? 0 : 2));
      fillBox(g, 1, 6, 2, 3, 6, 2, 2);
      setColor(g, 2, 7, 2, 3);
      return;
    }
    if (heads === 'spike') {
      // A spire of flowers on each stem, the middle one tallest, lit on its upper side.
      for (const [x, top] of [[1, 6], [2, 7], [3, 6]] as const) fillBox(g, x, 4, 2, x, top, 2, (_x, y) => (y === top ? 5 : 4));
      setColor(g, 2, 5, 1, 4);
      setColor(g, 2, 6, 3, 4);
      return;
    }
    if (heads === 'flat') {
      // A flat head over the stems, its middle lit (a daisy's eye, a cluster's crown).
      fillBox(g, 0, 5, 1, 4, 5, 3, (x, _y, z) => ((x === 0 || x === 4) && (z === 1 || z === 3) ? 0 : x === 2 && z === 2 ? 5 : 4));
      fillBox(g, 1, 6, 2, 3, 6, 2, 4);
      return;
    }
    // Berries: here and there along the top stems and over them.
    for (const [x, y, z] of [[0, 5, 2], [1, 6, 1], [2, 6, 3], [3, 5, 1], [4, 6, 2], [2, 7, 2], [1, 5, 3]] as const) setColor(g, x, y, z, (x + y) % 3 === 0 ? 5 : 4);
    fillBox(g, 2, 5, 2, 2, 6, 2, 1);
  });
}

// A fly agaric: a pale stalk 1 with a ring 2, under a round red cap 4, flecked white 5, darker red under its rim 3.
const agaric = (): LootModel =>
  model([0xece4d0, 0xd8ccb0, 0x8e1c20, 0xd8302a, 0xf6f2ea], [5, 6, 5], (g: VoxelGrid) => {
    fillBox(g, 2, 0, 2, 2, 3, 2, 1);
    setColor(g, 2, 2, 1, 2);
    setColor(g, 2, 2, 3, 2);
    fillBox(g, 0, 3, 0, 4, 3, 4, (x, _y, z) => ((x === 0 || x === 4) && (z === 0 || z === 4) ? 0 : x === 0 || x === 4 || z === 0 || z === 4 ? 3 : 4));
    fillBox(g, 1, 4, 1, 3, 4, 3, (x, _y, z) => ((x + z) % 2 === 0 && x !== 2 ? 5 : 4));
    setColor(g, 2, 5, 2, 4);
    setColor(g, 1, 4, 1, 5);
  });

// A mandrake: a forked root 1 (darker 2 below, a pale scar 3), two legs and two arms of it, a tuft of leaves 4 (lit 5)
// on its crown.
const mandrake = (): LootModel =>
  model([0xb08a5a, 0x7a5a36, 0xdcc49a, LEAF, LEAF_LIT], [5, 7, 3], (g: VoxelGrid) => {
    setColor(g, 1, 0, 1, 2);
    setColor(g, 3, 0, 1, 2);
    fillBox(g, 1, 1, 1, 3, 1, 1, (x) => (x === 2 ? 0 : 2));
    fillBox(g, 1, 2, 1, 3, 4, 1, (x, y) => (x === 2 && y === 3 ? 3 : 1));
    setColor(g, 0, 3, 1, 1);
    setColor(g, 4, 3, 1, 1);
    for (const [x, z] of [[1, 0], [2, 1], [3, 2], [2, 0], [1, 2]] as const) setColor(g, x, 5, z, 4);
    setColor(g, 2, 6, 1, 5);
  });

const PURPLE: [number, number] = [0x7a4aa8, 0xb48ae0];
export const HERB_MODELS: Record<HerbId, LootModel> = {
  chamomile: bunch('flat', [0xf4f0e2, 0xf0c832]),
  rosehip: bunch('berry', [0xc8302a, 0xf06a4a]),
  nettle: bunch('leaf', [LEAF, LEAF_LIT], 0x2f5a22),
  yarrow: bunch('flat', [0xe8e2cc, 0xfaf6e8]),
  mistletoe: bunch('berry', [0xe8ecd8, 0xffffff], 0x6a8a3a),
  woundwort: bunch('spike', [0x9a3a7a, 0xd070b0]),
  lavender: bunch('spike', PURPLE, 0x7a9070),
  snowdrop: bunch('flat', [0xfafafa, 0x9ad070]),
  comfrey: bunch('leaf', [0x5a3a8a, 0x8a6ac0], 0x4a7a36),
  flyAgaric: agaric(),
  foxglove: bunch('spike', [0xb0407a, 0xf0a0c8]),
  hellebore: bunch('flat', [0xe8d0d8, 0xb05a7a], 0x2a4a2a),
  mandrake: mandrake(),
  wolfsbane: bunch('spike', [0x3a4aa8, 0x7a90e8], 0x2f5a22),
};
