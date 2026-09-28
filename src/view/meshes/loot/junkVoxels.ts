// Junk loot in voxels, grid-aligned only. Drawn larger than life (0.045
// voxels, about the world's), so a fang or a spoon is easy to spot on the ground.

import type { JUNK_ITEMS } from '../../../model/loot/junk';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const LOOT_VOXEL_SIZE = 0.045;

export interface LootModel {
  palette: number[];
  build(): VoxelGrid;
}

// A model from a palette and a painter over a grid of `size`.
const model = (palette: number[], size: [number, number, number], paint: (grid: VoxelGrid) => void): LootModel => ({
  palette,
  build: () => {
    const grid = createGrid(size);
    paint(grid);
    return grid;
  },
});

export const JUNK_MODELS: Record<keyof typeof JUNK_ITEMS, LootModel> = {
  // A long ivory tooth, yellowed at the root, stepping to a point.
  wolfFang: model([0xefe6cc, 0xd6c79a, 0xfffbee], [3, 6, 3], (g) => {
    fillBox(g, 0, 0, 0, 2, 1, 2, 2);
    fillBox(g, 0, 2, 1, 1, 3, 2, 1);
    fillBox(g, 1, 4, 1, 1, 4, 1, 1);
    setColor(g, 1, 5, 1, 3);
  }),
  // A flat, scruffy hide: mottled greys with tufts sticking up.
  mattedPelt: model([0x8e8a82, 0x6f6b64, 0xa8a399], [7, 2, 6], (g) => {
    fillBox(g, 0, 0, 0, 6, 0, 5, (x, _y, z) => ((x + z * 2) % 3 === 0 ? 2 : (x * z) % 4 === 1 ? 3 : 1));
    for (const [x, z] of [[1, 1], [4, 2], [2, 4], [5, 4]]) setColor(g, x, 1, z, 2);
    for (const [x, z] of [[0, 0], [6, 5]]) setColor(g, x, 0, z, 0); // ragged corners
  }),
  // A dark curved claw: a stepped hook.
  brokenClaw: model([0x3a3430, 0x57504a], [2, 4, 4], (g) => {
    fillBox(g, 0, 0, 0, 1, 1, 1, 2);
    fillBox(g, 0, 2, 1, 1, 2, 2, 1);
    setColor(g, 0, 3, 3, 1);
  }),
  // A bone with knobbly ends, chewed in the middle.
  gnawedBone: model([0xe8dcc0, 0xc9bb98], [8, 2, 3], (g) => {
    fillBox(g, 1, 0, 1, 6, 0, 1, (x) => (x === 4 ? 2 : 1));
    for (const x of [0, 7]) fillBox(g, x, 0, 0, x, 1, 2, 1);
  }),
  // A square iron buckle gone orange with rust, its prong across.
  rustyBuckle: model([0x9a5a32, 0x7a4424, 0xb07040], [5, 1, 5], (g) => {
    fillBox(g, 0, 0, 0, 4, 0, 4, (x, _y, z) => (x === 0 || x === 4 || z === 0 || z === 4 ? ((x + z) % 3 === 0 ? 3 : 1) : 0));
    fillBox(g, 2, 0, 1, 2, 0, 3, 2);
  }),
  // A green glass flask with a cork, a dark crack down its side.
  crackedFlask: model([0x6aa888, 0x4a8868, 0x8a6a45, 0x2e4a3a], [3, 6, 3], (g) => {
    fillBox(g, 0, 0, 0, 2, 3, 2, (x, y, z) => (z === 2 && x === 1 && y >= 1 ? 4 : x === 0 ? 2 : 1));
    setColor(g, 1, 4, 1, 1);
    setColor(g, 1, 5, 1, 3);
  }),
  // A pewter spoon, its handle bent up.
  bentSpoon: model([0xa8aeb6, 0x7d838c], [2, 3, 7], (g) => {
    fillBox(g, 0, 0, 0, 1, 0, 1, 2); // the bowl
    fillBox(g, 0, 0, 2, 0, 0, 4, 1);
    fillBox(g, 0, 1, 5, 0, 2, 6, 1); // bent up
  }),
  // A leather pouch tied with a cord, one corner torn open.
  tornPouch: model([0x8a5a35, 0x6b4226, 0xc2a26b], [4, 4, 4], (g) => {
    fillBox(g, 0, 0, 0, 3, 2, 3, (x, y) => (y === 0 || x === 0 ? 2 : 1));
    setColor(g, 3, 2, 3, 0); // the tear
    fillBox(g, 1, 3, 1, 2, 3, 2, 3); // tied top
  }),
};
