// Ingredients in voxels (ingredients.ts), grid-aligned only: a raw haunch of
// boar, red and marbled with fat, its bone sticking out of the cut end; a
// lean strip of wolf, darker, a pale sinew along it, grey fur at one end; a
// thick slab of bear capped in fat; a honeycomb; a lean cut of lynx.

import type { IngredientId } from '../../../model/loot/ingredients';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

export const INGREDIENT_MODELS: Record<IngredientId, LootModel> = {
  // A rounded lump of red meat, darker underneath, streaked with fat; a rim of
  // fat round the cut end, and the bone out of it, knobbed at the tip.
  rawBoarMeat: model([0xc0464e, 0x8e2c36, 0xf2e2d4, 0xeee2c4], [7, 3, 5], (g) => {
    const meat = (x: number, y: number, z: number) => ((x + 2 * z + y) % 5 === 0 ? 3 : y === 0 ? 2 : 1);
    fillBox(g, 0, 0, 1, 3, 1, 3, meat);
    fillBox(g, 1, 0, 0, 3, 1, 4, meat); // (the corners left out: rounded)
    fillBox(g, 1, 2, 1, 3, 2, 3, (x, _y, z) => ((x + z) % 3 === 0 ? 3 : 1)); // its rounded top
    fillBox(g, 4, 0, 1, 4, 1, 3, 3); // the fat round the cut
    setColor(g, 5, 1, 2, 4); // the bone
    fillBox(g, 6, 1, 1, 6, 1, 3, 4); // its knob
  }),
  // A long lean strip, dark red and darker below, a pale sinew running along
  // its top, and a scrap of grey fur left on at one end.
  rawWolfMeat: model([0x9a2e34, 0x6e1e26, 0xe8d8c8, 0x8a8f96, 0x6a6e74], [7, 2, 3], (g) => {
    fillBox(g, 0, 0, 0, 5, 0, 2, (x, _y, z) => (z === 1 || (x > 0 && x < 5) ? 2 : 0)); // its underside, the ends narrower
    fillBox(g, 1, 1, 0, 4, 1, 2, (x, _y, z) => (z === 1 && x % 2 === 0 ? 3 : 1)); // its top, the sinew along it
    setColor(g, 0, 1, 1, 1);
    setColor(g, 5, 1, 1, 1);
    fillBox(g, 6, 0, 1, 6, 1, 1, (_x, y) => (y === 1 ? 4 : 5)); // the scrap of fur
  }),
  // A thick slab of bear: deep red, a broad cap of white fat along its top, a scrap of brown fur at one end.
  rawBearMeat: model([0xa8343c, 0x7a222a, 0xf2e8da, 0x5a3e2c], [7, 3, 5], (g) => {
    fillBox(g, 0, 0, 0, 5, 1, 4, (x, y, z) => ((x + z) % 4 === 0 && y === 1 ? 3 : y === 0 ? 2 : 1));
    fillBox(g, 0, 2, 1, 5, 2, 3, 3); // its cap of fat
    for (const [x, z] of [[0, 0], [5, 0], [0, 4], [5, 4]]) setColor(g, x, 1, z, 0); // (its corners off)
    fillBox(g, 6, 0, 1, 6, 1, 3, 4); // the fur
  }),
  // A honeycomb: a wedge of golden cells, a few of them dark and full, honey running from its edge.
  honeycomb: model([0xe8b440, 0xc8902a, 0x8a5a18, 0xffd870], [6, 2, 5], (g) => {
    for (let x = 0; x < 6; x++) for (let z = 0; z < 5; z++) if (z <= x - (x > 3 ? 1 : 0) + 1) setColor(g, x, 0, z, (x + z * 2) % 3 === 0 ? 3 : 2);
    for (let x = 1; x < 6; x++) for (let z = 0; z < 4; z++) if (z <= x - 1) setColor(g, x, 1, z, (x * 2 + z) % 3 === 0 ? 3 : (x + z) % 2 ? 1 : 4); // its cells, some full and dark
  }),
  // A lean cut of lynx: pale pink-red, a fine sinew along it, tawny fur with a dark spot at one end.
  leanLynxMeat: model([0xc06058, 0x8e3a38, 0xf0e0d0, 0xb8925e, 0x5a4026], [7, 2, 3], (g) => {
    fillBox(g, 0, 0, 0, 5, 0, 2, (x, _y, z) => (z === 1 || (x > 0 && x < 5) ? 2 : 0));
    fillBox(g, 1, 1, 0, 4, 1, 2, (x, _y, z) => (z === 1 && x % 2 === 1 ? 3 : 1));
    fillBox(g, 6, 0, 0, 6, 1, 2, (_x, y, z) => (y === 1 && z === 1 ? 5 : 4)); // its fur, spotted
  }),
};
