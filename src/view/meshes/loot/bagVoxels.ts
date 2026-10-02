// Bags in voxels (loot/bags.ts), grid-aligned: each its own silhouette and
// palette, told apart at a glance. A lumpy hessian sack tied at its neck with
// twine, a patch on it; a leather satchel, its flap down over the front, a
// brass buckle, a strap arching over; a tall traveller's pack, a bedroll
// strapped on top, a tin cup hanging from it; a tooled bag in dark rich
// leather, gold worked into its flap and a gold clasp.

import type { BAG_ITEMS } from '../../../model/loot/bags';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

export const BAG_MODELS: Record<keyof typeof BAG_ITEMS, LootModel> = {
  // Hessian, its weave in two tones, bulging lower, gathered and tied, the neck's ends sticking up; a patch darker.
  roughSack: model([0xc8aa78, 0xa88a5a, 0x8a6a42, 0x5e4a30, 0xb09060], [6, 8, 6], (g) => {
    for (let y = 0; y < 5; y++) {
      const w = y === 0 || y === 4 ? 1 : 0; // (rounded at its foot and shoulder)
      fillBox(g, w, y, w, 5 - w, y, 5 - w, (x, _y, z) => ((x + y + z) % 2 ? 1 : 2));
    }
    fillBox(g, 2, 5, 2, 3, 5, 3, 4); // the twine round its neck
    fillBox(g, 2, 6, 2, 3, 6, 3, 1); // gathered above it
    setColor(g, 2, 7, 2, 2);
    setColor(g, 3, 7, 3, 1);
    fillBox(g, 3, 1, 5, 4, 2, 5, 5); // a patch sewn on its front
    setColor(g, 3, 1, 5, 3);
  }),
  // A low leather satchel: its body, the flap down over the front a shade darker, a brass buckle; its strap arching up.
  leatherSatchel: model([0x9a5e32, 0x7a4624, 0xb87a46, 0xe2b04a, 0x5a3218], [8, 7, 4], (g) => {
    fillBox(g, 0, 0, 0, 7, 3, 3, (_x, y) => (y === 3 ? 3 : 1)); // the body, lit along its top
    fillBox(g, 0, 2, 3, 7, 3, 3, 2); // the flap over the front
    setColor(g, 3, 1, 3, 2);
    setColor(g, 4, 1, 3, 2);
    setColor(g, 3, 1, 3, 4); // the buckle
    for (const [x, y] of [[0, 4], [0, 5], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6], [7, 5], [7, 4]]) setColor(g, x, y, 1, 5); // the strap
  }),
  // Tall, upright: the pack, its pocket, two straps down its front; the bedroll on top across it; a tin cup at its side.
  travellersPack: model([0x7a6a4a, 0x5e5038, 0x9a8a62, 0x6a8a5a, 0x4e6a42, 0xb8bcc0, 0x3e3428], [7, 9, 5], (g) => {
    fillBox(g, 1, 0, 0, 5, 5, 3, (_x, y) => (y === 5 ? 3 : 1)); // the pack
    fillBox(g, 2, 1, 4, 4, 2, 4, 2); // its pocket
    for (const x of [2, 4]) fillBox(g, x, 3, 4, x, 5, 4, 7); // the straps
    fillBox(g, 0, 6, 1, 6, 7, 2, (x) => (x === 0 || x === 6 ? 5 : 4)); // the bedroll, rolled, its ends darker
    fillBox(g, 0, 8, 1, 6, 8, 2, 4);
    fillBox(g, 6, 1, 2, 6, 2, 2, 6); // the tin cup hanging
  }),
  // Dark rich leather, rounded: its flap gold-worked in a running pattern, a gold clasp; a short handle.
  tooledBag: model([0x5a2e1a, 0x3e1e10, 0x7a4426, 0xe8c050, 0xb8902e], [7, 7, 4], (g) => {
    for (let y = 0; y < 5; y++) {
      const w = y === 0 ? 1 : 0;
      fillBox(g, w, y, 0, 6 - w, y, 3, (_x, yy) => (yy === 4 ? 3 : 1));
    }
    fillBox(g, 0, 3, 3, 6, 4, 3, 2); // the flap
    for (let x = 0; x <= 6; x++) setColor(g, x, (x % 2) + 3, 3, x % 3 === 0 ? 4 : 2); // gold worked into it
    setColor(g, 3, 2, 3, 4); // the clasp
    setColor(g, 3, 3, 3, 5);
    for (const [x, y] of [[2, 5], [2, 6], [3, 6], [4, 6], [4, 5]]) setColor(g, x, y, 1, 2); // the handle
  }),
};
