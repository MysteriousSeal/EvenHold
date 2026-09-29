// Quest items in voxels (questItems.ts), grid-aligned only, each its own
// silhouette: from wolves, a pelt folded flat, an alpha's long ivory fang, a paw's
// black claws, a bushy tawny tail; from bandits, a tin token struck with a
// skull, a knotted red bandanna, a rolled case of lockpicks, a letter sealed in wax.

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
  // An alpha's fang: a dark root, a long curving ivory point stepping to its tip.
  alphaFang: model([0xf0e8d0, 0xc8bc98, 0x7a5a3c], [3, 7, 2], (g) => {
    fillBox(g, 0, 0, 0, 2, 1, 1, (_x, y) => (y === 0 ? 3 : 2)); // the root
    fillBox(g, 0, 2, 0, 2, 3, 1, (x) => (x === 2 ? 2 : 1));
    fillBox(g, 1, 4, 0, 2, 5, 1, (x) => (x === 2 ? 2 : 1)); // curving over
    fillBox(g, 2, 6, 0, 2, 6, 1, 1); // the point
  }),
  // A paw: a grey pad of fur, three black claws curling out of its front.
  wolfClaw: model([0x7a7470, 0x55504c, 0x2a2624, 0x4a4442], [5, 2, 5], (g) => {
    fillBox(g, 0, 0, 1, 4, 0, 4, (x, _y, z) => (z === 4 || x === 0 || x === 4 ? 2 : 1));
    fillBox(g, 1, 1, 2, 3, 1, 4, (_x, _y, z) => (z === 4 ? 2 : 1)); // the pad, raised
    for (const x of [0, 2, 4]) {
      setColor(g, x, 0, 0, 3); // each claw
      setColor(g, x, 1, 1, 3);
    }
  }),
  // A bushy tail: tawny grey (set apart from the pelt), darker along its top, stepping thinner to a pale tip.
  wolfTail: model([0x9a8470, 0x6a5646, 0xbca690, 0xf0e8da], [9, 3, 3], (g) => {
    fillBox(g, 0, 0, 1, 1, 1, 1, 2); // where it was cut
    fillBox(g, 2, 0, 0, 5, 2, 2, (_x, y, z) => (y === 2 ? 2 : z === 0 ? 3 : 1)); // bushy
    fillBox(g, 6, 0, 0, 7, 1, 2, (_x, y) => (y === 1 ? 2 : 1));
    fillBox(g, 8, 0, 1, 8, 0, 1, 4); // the pale tip
    setColor(g, 7, 0, 1, 4);
  }),
  // A red bandanna, folded to a triangle, white dots on it, its knot at the corner.
  redBandanna: model([0xc0302a, 0x8a1e1a, 0xf2e6d8, 0xe0504a], [7, 2, 6], (g) => {
    for (let z = 0; z < 6; z++) fillBox(g, z, 0, z, 6, 0, z, (x) => (x === z ? 2 : (x + z) % 3 === 0 ? 3 : 1)); // stepped triangle
    fillBox(g, 5, 1, 0, 6, 1, 1, 4); // the knot
    setColor(g, 6, 1, 2, 2);
  }),
  // Lockpicks: a rolled leather case, tied with a cord, three steel pick
  // handles standing out of its top (chunky enough to read from afar).
  lockpicks: model([0x7a4a2a, 0x5a341c, 0xa8acb4, 0xdadee4, 0xd8c08a], [6, 6, 3], (g) => {
    fillBox(g, 0, 0, 0, 5, 3, 2, (x, y, z) => (x === 0 || x === 5 || z === 0 || y === 0 ? 2 : 1)); // the roll
    fillBox(g, 0, 2, 0, 5, 2, 2, (x, _y, z) => (x === 0 || x === 5 || z === 0 || z === 2 ? 5 : 1)); // the cord round it
    for (const [x, top] of [[1, 5], [3, 4], [4, 5]]) fillBox(g, x, 4, 1, x, top, 1, (_x, y) => (y === top ? 4 : 3)); // the picks, bright at the tips
  }),
  // A stolen letter: folded parchment, a few lines of ink, sealed with red wax.
  stolenLetter: model([0xf2e6c8, 0xd8c69c, 0x5a4632, 0xb02a24, 0x7a1a16], [7, 2, 5], (g) => {
    fillBox(g, 0, 0, 0, 6, 0, 4, (x, _y, z) => (x === 0 || z === 0 ? 2 : (z === 1 || z === 3) && x > 1 && x < 5 ? 3 : 1));
    fillBox(g, 4, 1, 2, 5, 1, 3, (x) => (x === 5 ? 5 : 4)); // the seal
  }),
};
