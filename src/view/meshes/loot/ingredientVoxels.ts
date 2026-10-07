// Ingredients in voxels (ingredients.ts), grid-aligned only: a raw haunch of
// boar, red and marbled with fat, its bone sticking out of the cut end; a
// lean strip of wolf, darker, a pale sinew along it, grey fur at one end; a
// thick slab of bear capped in fat; a honeycomb; a lean cut of lynx; and logs: a birch's white, dashed black, its
// wood pale; a pine's red-brown, a bead of resin, its wood amber; an oak's dark and furrowed, its wood warm tan.

import type { IngredientId } from '../../../model/loot/ingredients';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

// A log: bark 1, a mark on it 2 (dashes, furrows, resin: by `marked`), its end grain 3, its heart 4.
const log = (palette: number[], marked: (x: number, y: number, z: number) => boolean): LootModel =>
  model(palette, [8, 4, 4], (g) =>
    fillBox(g, 0, 0, 0, 7, 3, 3, (x, y, z) => {
      const rim = y === 0 || y === 3 || z === 0 || z === 3;
      if ((y === 0 || y === 3) && (z === 0 || z === 3)) return 0; // (round: its corners off)
      if (x === 0 || x === 7) return rim ? 1 : (y + z) % 2 === 0 ? 4 : 3; // the cut ends: bark round the grain, the heart in it
      return rim && marked(x, y, z) ? 2 : rim ? 1 : 3;
    }),
  );

// A plank: a flat board along x, its face 1, a grain line along it 2, its cut ends 3.
const plank = (palette: number[]): LootModel =>
  model(palette, [8, 1, 3], (g) => fillBox(g, 0, 0, 0, 7, 0, 2, (x, _y, z) => (x === 0 || x === 7 ? 3 : z === 1 && x % 3 !== 0 ? 2 : 1)));

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
  // Logs (from the trees a lumberjack fells): a round length each, its bark round it, its cut end's grain showing.
  birchLog: log([0xe8e4da, 0x2a2826, 0xf0dcb0, 0xd8b880], (x, y, z) => (x * 3 + y * 5 + z * 7) % 6 === 0), // black dashes on white
  pineLog: log([0x8a4a2a, 0xffc040, 0xe8b870, 0xc8904a], (x, y, z) => x === 4 && y === 3 && z === 1), // a bead of resin
  oakLog: log([0x5e5246, 0x40382f, 0xd8a868, 0x8a5a30], (x, _y, z) => (x + z) % 3 === 0), // furrowed
  // Found chopping: a golden lump of resin, a lighter glint, a drip run off it; a dense block of heartwood, dark
  // red-brown, its cut end in tight rings.
  pineResin: model([0xe8a830, 0xffd070, 0xb87418], [4, 3, 3], (g) => {
    fillBox(g, 0, 0, 0, 2, 1, 2, (x, y, z) => ((x === 0 || x === 2) && (z === 0 || z === 2) && y === 1 ? 0 : y === 1 && x === 1 && z === 0 ? 2 : 1));
    setColor(g, 1, 2, 1, 2); // its top, catching the light
    setColor(g, 3, 0, 1, 3); // a drip
  }),
  heartwood: model([0x6e2a1a, 0x521e12, 0xa0482a], [5, 4, 4], (g) =>
    fillBox(g, 0, 0, 0, 4, 3, 3, (x, y, z) => (x === 4 ? (Math.max(Math.abs(y - 1.5), Math.abs(z - 1.5)) > 1 ? 1 : (Math.round(Math.max(Math.abs(y - 1.5), Math.abs(z - 1.5))) % 2 === 0 ? 3 : 1)) : y === 0 ? 2 : 1)),
  ),
  // Worked: planks (a birch's cream, a pine's amber, an oak's tan); a stoppered clay pot of varnish, amber at its lip.
  birchPlank: plank([0xf0e2c0, 0xd8c498, 0xc8b080]),
  pinePlank: plank([0xe0a868, 0xc08848, 0xa87038]),
  oakPlank: plank([0xb88858, 0x946a40, 0x7a5432]),
  varnish: model([0x9a5a38, 0x7a4428, 0xc8a070, 0xe8a030], [4, 5, 4], (g) => {
    fillBox(g, 0, 0, 0, 3, 2, 3, (x, y, z) => ((x === 0 || x === 3) && (z === 0 || z === 3) ? 0 : y === 0 ? 2 : 1)); // its belly, round
    fillBox(g, 1, 3, 1, 2, 3, 2, (x, _y, z) => (x === 2 && z === 1 ? 4 : 1)); // its neck, the varnish's sheen at the lip
    fillBox(g, 1, 4, 1, 2, 4, 2, 3); // the cork
  }),
};
