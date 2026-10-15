// Charms written down (model/loot/scrolls.ts), as bag icons and on the ground, each its own shape to tell them apart
// at a glance: the hex, a strip of hide rolled up, its tail unrolled and the words burnt dark into it, a red smear;
// the mending verse, a leaf of vellum folded into a packet, brown writing on it, a blob of red wax; the Moon-turn's
// grimoire, a little black book, thick, its page edges pale, a silver crescent on its cover and a rusted clasp.
import { SCROLL_IDS, type ScrollId } from '../../../model/loot/scrolls';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

const LOOKS: Partial<Record<ScrollId, LootModel>> = {
  // Hide 1, its shade 2, burnt words 3, the smear 4, the twine 5.
  hexScroll: model([0xa87a4e, 0x6e4c30, 0x2a1a12, 0x7a1a1a, 0xc8b088], [10, 3, 7], (g) => {
    fillBox(g, 0, 0, 0, 9, 2, 2, (_x, y, z) => ((y === 0 || y === 2) && (z === 0 || z === 2) ? 0 : y === 1 && z === 1 ? 2 : 1)); // the roll, its corners cut round
    for (const x of [0, 9]) setColor(g, x, 1, 1, 2); // its ends, the hide wound in
    fillBox(g, 4, 0, 0, 4, 2, 2, (_x, y, z) => ((y === 0 || y === 2) && (z === 0 || z === 2) ? 0 : 5)); // tied round its middle
    fillBox(g, 1, 0, 3, 8, 0, 6, (x, _y, z) => (z === 6 && (x === 1 || x === 8) ? 0 : 1)); // its tail, unrolled flat
    for (const [x, z] of [[2, 4], [3, 4], [5, 4], [6, 4], [2, 5], [4, 5], [5, 5], [7, 5]]) setColor(g, x, 0, z, 3); // three words, burnt in
    setColor(g, 6, 0, 6, 4);
    setColor(g, 7, 0, 6, 4);
  }),
  // Vellum 1, its fold's shade 2, ink 3, wax 4, the wax's shine 5.
  mendScroll: model([0xe8dcb8, 0xc0b08a, 0x7a4a2a, 0xa83a2a, 0xd86a4a], [8, 2, 7], (g) => {
    fillBox(g, 0, 0, 0, 7, 0, 6, (x, _y, z) => (z === 3 || x === 0 || x === 7 ? 2 : 1)); // the packet, its folds' edges darker
    for (const z of [1, 5]) fillBox(g, 1, 0, z, 6, 0, z, (x) => (x % 2 ? 3 : 1)); // the writing showing on its face
    fillBox(g, 3, 1, 2, 4, 1, 4, 4); // the seal, over the fold
    setColor(g, 3, 1, 3, 5);
  }),
  // Cover 1, its spine 2, page edges 3, the clasp's rust 4, the crescent 5.
  moonGrimoire: model([0x2a2430, 0x3e3446, 0xd8ccb0, 0x9a5a2a, 0xc8d0dc], [8, 3, 7], (g) => {
    fillBox(g, 0, 0, 0, 7, 2, 6, (x, y) => (x === 0 ? 2 : y === 1 && x < 7 ? 3 : 1)); // the book shut, its pages between the boards
    fillBox(g, 7, 0, 2, 7, 2, 4, 4); // the clasp, over its fore-edge
    for (const [x, z] of [[3, 2], [3, 3], [3, 4], [4, 1], [4, 5], [5, 1], [5, 5]]) setColor(g, x, 2, z, 5); // the crescent on its cover
  }),
};

// Every charm written down's look: its own, else the hex's (a plain strip rolled up), till it's given one.
export const SCROLL_MODELS = Object.fromEntries(SCROLL_IDS.map((id) => [id, LOOKS[id] ?? LOOKS.hexScroll!])) as Record<ScrollId, LootModel>;
