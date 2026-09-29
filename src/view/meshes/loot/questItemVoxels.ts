// Quest items in voxels (questItems.ts), grid-aligned only: a wolf pelt
// folded flat, its bushy tail hanging off one end, and a bandit's token, a
// dented tin badge struck with a skull, on a knot of red cord.

import type { QuestItemId } from '../../../model/quests/questItems';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

export const QUEST_MODELS: Record<QuestItemId, LootModel> = {
  // A folded grey pelt: dark along the spine, pale underneath, a paler-tipped tail.
  wolfPelt: model([0x7a7470, 0x55504c, 0xa8a29a, 0x3a3634, 0xe4ddd0], [8, 2, 5], (g) => {
    fillBox(g, 0, 0, 0, 5, 0, 4, (x, _y, z) => (z === 0 || z === 4 || x === 0 ? 3 : 1));
    fillBox(g, 1, 1, 1, 4, 1, 3, (_x, _y, z) => (z === 2 ? 4 : 1)); // the fold, the spine along it
    fillBox(g, 6, 0, 2, 6, 0, 2, 2); // the tail
    setColor(g, 7, 0, 2, 5); // its pale tip
    setColor(g, 6, 0, 1, 2);
  }),
  // A tin badge on its cord: a stepped disc, a bone-white skull, the red knot above.
  banditToken: model([0x9aa0a6, 0x6a7078, 0xc8ccd0, 0xf0e8d8, 0xb02a24, 0x2e2a2a], [5, 6, 2], (g) => {
    fillBox(g, 1, 0, 0, 3, 0, 1, 2);
    fillBox(g, 0, 1, 0, 4, 3, 1, (x, y) => (x === 0 || y === 3 ? 3 : x === 4 || y === 1 ? 2 : 1));
    fillBox(g, 1, 4, 0, 3, 4, 1, 2);
    fillBox(g, 1, 2, 0, 3, 3, 0, 4); // the skull
    setColor(g, 1, 3, 0, 6); // its eyes
    setColor(g, 3, 3, 0, 6);
    fillBox(g, 2, 5, 0, 2, 5, 1, 5); // the cord's knot
    setColor(g, 1, 5, 1, 5);
  }),
};
