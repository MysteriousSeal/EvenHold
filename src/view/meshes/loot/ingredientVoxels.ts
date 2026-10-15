// Ingredients in voxels (ingredients.ts), grid-aligned only: a raw haunch of
// boar, red and marbled with fat, its bone sticking out of the cut end; a
// lean strip of wolf, darker, a pale sinew along it, grey fur at one end; a
// thick slab of bear capped in fat; a honeycomb; a lean cut of lynx; and logs: a birch's white, dashed black, its
// wood pale; a pine's red-brown, a bead of resin, its wood amber; an oak's dark and furrowed, its wood warm tan.

import type { IngredientId } from '../../../model/loot/ingredients';
import { fillBox, setColor } from '../voxel/voxelShapes';
import type { VoxelGrid } from '../voxel/greedyMesh';
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

// A lump of ore: a rough block of its rock (stone 1, its underside 2), corners knocked off, its ore 3 showing through
// in flecks and a seam across the top, a glint 4 or two of it catching the light.
const ore = (palette: number[]): LootModel =>
  model(palette, [5, 3, 4], (g) => {
    fillBox(g, 0, 0, 0, 4, 2, 3, (x, y, z) => {
      const edge = (x === 0 || x === 4) && (z === 0 || z === 3);
      if (edge && y !== 1) return 0; // (rough: its corners off)
      if (y === 2 && (x === 0 || x === 4 || z === 0 || z === 3) && (x + z) % 2 === 0) return 0;
      if (y === 2 && z === 1 + (x % 2)) return x === 2 ? 4 : 3; // the seam across its top, a glint in it
      if ((x * 5 + y * 3 + z * 7) % 6 === 0) return 3; // flecks of it in the sides
      return y === 0 ? 2 : 1;
    });
  });

// A fish lying on its side along x, `long` voxels: its back 1, its flank 2, its belly 3, its fins and tail 4, its eye 5;
// the head to a point at x 0, the tail forked at the far end; `marks`, any of its own over that (spots, scutes).
const fish = (palette: number[], long: number, marks?: (g: VoxelGrid) => void): LootModel =>
  model(palette, [long, 3, 3], (g) => {
    const tail = long - 1;
    fillBox(g, 1, 0, 1, tail - 2, 2, 1, (_x, y) => (y === 2 ? 1 : y === 1 ? 2 : 3)); // its body, back to belly
    fillBox(g, 2, 1, 0, tail - 3, 1, 2, 2); // fuller amidships
    setColor(g, 0, 1, 1, 2); // its snout
    setColor(g, 1, 1, 0, 5); // an eye
    setColor(g, 1, 1, 2, 5);
    setColor(g, tail - 1, 1, 1, 4); // the wrist of the tail
    fillBox(g, tail, 0, 1, tail, 2, 1, (_x, y) => (y === 1 ? 0 : 4)); // the tail, forked
    if (long > 6) setColor(g, Math.floor(long / 2), 2, 1, 4); // a fin on its back, the bigger ones
    marks?.(g);
  });

// An ingot: a bar six long, its top a step in all round (its shadow 1 below, its body 2, a gleam 3 along its top;
// `starred`, a fleck of light 4 on it).
const ingot = (palette: number[], starred = false): LootModel =>
  model(palette, [6, 2, 3], (g) => {
    fillBox(g, 0, 0, 0, 5, 0, 2, 1);
    fillBox(g, 1, 1, 0, 4, 1, 2, 2);
    fillBox(g, 2, 1, 1, 3, 1, 1, 3);
    if (starred) setColor(g, 3, 1, 0, 4);
  });

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
  // Fish (caught from a shore): small fry, silver and slight; a roach, blue-silver, its fins and eye red; a trout, olive
  // with a pink flank; a perch, green-gold with dark fins; a pike, long and mottled green; a char, its back dark and
  // pale-spotted, its belly red; a sturgeon, longest, grey-brown, a row of pale bony plates down its back.
  smallFry: fish([0x8a96a0, 0xc8d2da, 0xeef2f4, 0x6a7680, 0x1a1a1a], 5),
  roach: fish([0x5a6e86, 0xc0ccd8, 0xeef2f4, 0xc83a2a, 0xa01a1a], 6),
  riverTrout: fish([0x5a6a3a, 0xd08a8a, 0xf0e4d0, 0x4a5a30, 0x1a1a1a], 7),
  lakePerch: fish([0x4a6a2a, 0xc8b048, 0xf0e0b0, 0xc84a2a, 0x1a1a1a], 7),
  pike: fish([0x3a5a2a, 0x7a9a4a, 0xe8e0c0, 0x2a4020, 0x1a1a1a], 9),
  // A bream, deep and flat, bronze-gold, its fins dark; a grayling, silver-grey, its long sail of a back fin purple-red.
  bream: fish([0x6a5a2a, 0xc0a050, 0xe8d8a0, 0x3a3222, 0x1a1a1a], 7, (g) => {
    for (const x of [2, 3, 4]) setColor(g, x, 2, 1, 4); // its back's long fin
  }),
  grayling: fish([0x5a646e, 0xa8b4bc, 0xe8ecee, 0x8a3a5a, 0x1a1a1a, 0x2a2e34], 8, (g) => {
    for (let x = 2; x <= 5; x++) setColor(g, x, 2, 1, 4); // the sail along its back
    for (const [x, z] of [[2, 0], [3, 2]]) setColor(g, x, 1, z, 6); // dark specks on its flanks
  }),
  // A salmon, long and silver, its back blue-grey and black-spotted, a blush of pink along its flank.
  salmon: fish([0x4a5a6e, 0xd0b8c0, 0xeef0f2, 0x3a4250, 0x1a1a1a, 0x1e2026], 10, (g) => {
    for (const x of [2, 4, 6, 7]) setColor(g, x, 2, 1, 6); // black spots along its back
  }),
  char: fish([0x3e5248, 0x6a7a68, 0xe0562a, 0xc84a2a, 0x1a1a1a, 0xf0e8c8], 8, (g) => {
    for (const [x, z] of [[2, 1], [5, 1]]) setColor(g, x, 2, z, 6); // pale spots on its back and flanks
    setColor(g, 3, 1, 0, 6);
    setColor(g, 5, 1, 2, 6);
  }),
  sturgeon: fish([0x5a564a, 0x8a8470, 0xd8d0b8, 0x3e3a32, 0x1a1a1a, 0xe8e0c8], 11, (g) => {
    for (let x = 2; x <= 8; x += 2) setColor(g, x, 2, 1, 6); // its bony plates, down the back
    setColor(g, 0, 0, 1, 4); // the barbels under its long snout
  }),
  // An eel: long and thin, dark olive above and yellowish below, a low fin running the length of its back, the head
  // a little broader, the tail to a point (no fork).
  eel: model([0x6a6236, 0x8a8248, 0xd8c870, 0x4e4828, 0x1a1a1a], [11, 3, 3], (g) => {
    fillBox(g, 1, 0, 1, 9, 1, 1, (_x, y) => (y === 1 ? 1 : 3)); // its body, back over belly
    fillBox(g, 3, 2, 1, 9, 2, 1, 4); // the fin along its back
    fillBox(g, 1, 0, 0, 2, 1, 2, (_x, y, z) => (z !== 1 && y === 1 ? 5 : z !== 1 ? 0 : y === 1 ? 2 : 3)); // the head, eyes either side
    setColor(g, 0, 0, 1, 2); // its snout
    setColor(g, 10, 1, 1, 4); // the tail, to a point
  }),
  // Bought from the barmaid: salt, a twist of linen tied at the neck, grey grains heaped at its mouth; flour, a small
  // burlap sack, tied, white at the top where it's open.
  salt: model([0xe8e0cc, 0xc8bca0, 0xb8b8b4, 0xe8e8e4, 0x8a6a4a], [3, 4, 3], (g) => {
    fillBox(g, 0, 0, 0, 2, 1, 2, (x, y, z) => ((x === 0 || x === 2) && (z === 0 || z === 2) && y === 1 ? 0 : y === 0 ? 2 : 1)); // the twist
    setColor(g, 1, 2, 1, 5); // tied
    setColor(g, 1, 3, 1, 3); // the salt heaped at its mouth
    setColor(g, 0, 2, 1, 4);
  }),
  flour: model([0xc8a878, 0xa88858, 0xf4f0e8, 0x7a5a3a], [4, 5, 4], (g) => {
    fillBox(g, 0, 0, 0, 3, 2, 3, (x, y, z) => ((x === 0 || x === 3) && (z === 0 || z === 3) ? 0 : y === 0 ? 2 : (x + y + z) % 4 === 0 ? 2 : 1)); // the sack
    fillBox(g, 1, 3, 1, 2, 3, 2, 4); // its tie
    fillBox(g, 1, 4, 1, 2, 4, 2, 3); // the flour, white at the top
  }),
  // Sold by pedlars: a bundle of firewood, short split sticks, pale where split, bark on their backs, tied twice with twine.
  firewood: model([0xc8a070, 0x8a5a34, 0x6a4428, 0xd8c8a0], [6, 3, 3], (g) =>
    fillBox(g, 0, 0, 0, 5, 2, 2, (x, y, z) => ((y === 2 || y === 0) && (z === 0 || z === 2) && (x === 0 || x === 5) ? 0 : x === 1 || x === 4 ? 4 : (x === 0 || x === 5) ? 1 : (y + z) % 2 === 0 ? 2 : 3)),
  ),
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
  // An elder oak's burl: a knotted lump of grey bark, a fleck of lichen on it, sawn off flat on one side to show its
  // grain swirled round three dark knots.
  oakBurl: model([0x5e564a, 0x40382f, 0xa8b07a, 0xc89058, 0x8a5a30, 0x3a2414], [6, 3, 5], (g) => {
    fillBox(g, 0, 0, 0, 5, 1, 4, (x, y, z) => ((x === 0 || x === 5) && (z === 0 || z === 4) ? 0 : y === 0 ? 2 : (x * 2 + z) % 5 === 0 ? 3 : 1)); // the lump of bark, rounded, lichen on it
    fillBox(g, 1, 2, 1, 4, 2, 3, (x, _y, z) => ((x + z * 2) % 3 === 0 ? 5 : 4)); // sawn flat atop: its grain swirled
    for (const [x, z] of [[1, 1], [3, 2], [4, 3]]) setColor(g, x, 2, z, 6); // round three dark knots
  }),
  // Struck from the veins (mining.ts): copper, orange in green-stained stone; tin, black grains in grey; iron, rust-red;
  // silver, bright flecks; gold, yellow in white quartz; star-iron, blue-black stone glittering pale blue.
  copperOre: ore([0x8a8a78, 0x5e5e50, 0xc8743a, 0x6ab89a]),
  tinOre: ore([0x7a766e, 0x4e4a44, 0x2a2a30, 0xd0d4d8]),
  ironOre: ore([0x8a7466, 0x5e4a3e, 0xa8482a, 0xd8885a]),
  silverOre: ore([0x86868a, 0x5a5a5e, 0xc8ccd4, 0xffffff]),
  goldOre: ore([0xe4e0d6, 0xb0aa9e, 0xe0b030, 0xfff0a0]),
  starIronOre: ore([0x2e3244, 0x1a1c28, 0x4a6aa8, 0xc8e8ff]),
  // Worked: planks (a birch's cream, a pine's amber, an oak's tan); a stoppered clay pot of varnish, amber at its lip.
  birchPlank: plank([0xf0e2c0, 0xd8c498, 0xc8b080]),
  pinePlank: plank([0xe0a868, 0xc08848, 0xa87038]),
  oakPlank: plank([0xb88858, 0x946a40, 0x7a5432]),
  varnish: model([0x9a5a38, 0x7a4428, 0xc8a070, 0xe8a030], [4, 5, 4], (g) => {
    fillBox(g, 0, 0, 0, 3, 2, 3, (x, y, z) => ((x === 0 || x === 3) && (z === 0 || z === 3) ? 0 : y === 0 ? 2 : 1)); // its belly, round
    fillBox(g, 1, 3, 1, 2, 3, 2, (x, _y, z) => (x === 2 && z === 1 ? 4 : 1)); // its neck, the varnish's sheen at the lip
    fillBox(g, 1, 4, 1, 2, 4, 2, 3); // the cork
  }),
  // Salvaged (skills/salvage.ts): iron scrap, a few jagged grey bits with rust; a leather strip, a brown strap with its
  // buckle end; linen scrap, pale cloth folded; silver filings, bright flecks on a dark heap; a gem shard, a blue
  // splinter catching the light; a tempered ingot, a dark steel bar with a bright edge; a cut gem, red, faceted.
  ironScrap: model([0x6a7482, 0x4a5462, 0x9a4a28], [6, 2, 5], (g) => {
    fillBox(g, 0, 0, 1, 2, 0, 3, 1);
    fillBox(g, 3, 0, 0, 5, 0, 2, 2);
    fillBox(g, 1, 1, 2, 1, 1, 2, 3);
    fillBox(g, 4, 1, 1, 4, 1, 1, 1);
    setColor(g, 5, 0, 2, 3);
  }),
  leatherStrip: model([0x8a5a3a, 0x5e3a22, 0xb8a070], [7, 1, 3], (g) => {
    fillBox(g, 0, 0, 1, 5, 0, 1, 1);
    fillBox(g, 2, 0, 0, 2, 0, 2, 2);
    setColor(g, 6, 0, 1, 3);
  }),
  linenScrap: model([0xeadfc6, 0xd2c4a4, 0xf6efdc], [5, 2, 5], (g) => {
    fillBox(g, 0, 0, 0, 4, 0, 4, 1);
    fillBox(g, 1, 1, 1, 3, 1, 3, 1);
    setColor(g, 2, 1, 2, 3);
    setColor(g, 0, 0, 4, 2);
    setColor(g, 4, 0, 0, 2);
  }),
  silverFilings: model([0x4a4652, 0xd8dce4, 0xf4f6fa], [5, 2, 5], (g) => {
    fillBox(g, 1, 0, 1, 3, 0, 3, 1);
    for (const [x, z] of [[1, 2], [2, 1], [3, 3], [2, 3]]) setColor(g, x, 1, z, 2);
    setColor(g, 2, 1, 2, 3);
  }),
  gemShard: model([0x3a78c8, 0x8ec0f0, 0xe8f4ff], [3, 4, 3], (g) => {
    fillBox(g, 1, 0, 1, 1, 2, 1, 1);
    fillBox(g, 0, 0, 1, 2, 0, 1, 1);
    setColor(g, 1, 3, 1, 3);
    setColor(g, 1, 1, 0, 2);
    setColor(g, 0, 1, 1, 2);
  }),
  temperedIngot: model([0x3a4450, 0x5a6878, 0xb8c4d0], [6, 2, 3], (g) => {
    fillBox(g, 0, 0, 0, 5, 1, 2, 1);
    fillBox(g, 1, 1, 1, 4, 1, 1, 2);
    setColor(g, 4, 1, 1, 3);
  }),
  cutGem: model([0xb02a3c, 0xe85a6a, 0xffd0d6], [3, 3, 3], (g) => {
    fillBox(g, 0, 0, 0, 2, 1, 2, 1);
    fillBox(g, 1, 2, 1, 1, 2, 1, 2);
    for (const [x, z] of [[0, 1], [1, 0], [2, 1], [1, 2]]) setColor(g, x, 1, z, 2);
    setColor(g, 1, 2, 1, 3);
  }),
  // A smith's (skills/smithing.ts): ingots, each a bar narrower on top, its metal's ramp (its shadow 1, its body 2, a
  // gleam 3; star-iron's a fleck of light 4 in the dark); fittings, each its own shape: rivets in a little heap, nails
  // laid side by side, a hoop of band iron, a silver corner bracket, a gilded one set with a red stone.
  copperIngot: ingot([0x8a4a22, 0xc8703a, 0xf0a070]),
  bronzeIngot: ingot([0x7a5420, 0xb0803a, 0xe0b868]),
  ironIngot: ingot([0x4a4e56, 0x6e747e, 0xa8b0ba]),
  steelIngot: ingot([0x56667a, 0x8a9cae, 0xdce6f0]),
  silverIngot: ingot([0x8a8e98, 0xc8ccd4, 0xf4f6fa]),
  goldIngot: ingot([0x9a6a10, 0xd8a830, 0xffe080]),
  starIronIngot: ingot([0x1e2440, 0x3a4878, 0x7a90d0, 0xe8f0ff], true),
  copperRivets: model([0x8a4a22, 0xc8703a, 0xf0a070], [5, 2, 4], (g) => {
    for (const [x, z] of [[0, 0], [2, 1], [4, 0], [1, 3], [3, 3]]) setColor(g, x, 0, z, 2); // the rivets, scattered
    for (const [x, z] of [[2, 1], [1, 3]]) setColor(g, x, 1, z, 3); // two lying atop, catching the light
    setColor(g, 3, 0, 2, 1);
  }),
  ironNails: model([0x3a3e46, 0x6e747e, 0xa8b0ba], [6, 2, 5], (g) => {
    for (const z of [0, 2, 4]) {
      fillBox(g, 0, 0, z, 4, 0, z, 2); // a nail's shank
      setColor(g, 5, 0, z, 1); // its point
      setColor(g, 0, 1, z, 3); // its head
    }
  }),
  ironBands: model([0x3a3e46, 0x5a606a, 0x8a929c], [6, 2, 6], (g) => {
    fillBox(g, 0, 0, 0, 5, 1, 5, (x, y, z) => {
      const edge = x === 0 || x === 5 || z === 0 || z === 5;
      const corner = (x === 0 || x === 5) && (z === 0 || z === 5);
      return edge && !corner ? (y === 1 ? 3 : 2) : 0; // a hoop, round, its upper edge lighter
    });
    setColor(g, 0, 0, 2, 1); // its rivet, darker
  }),
  silverFittings: model([0x6a6e78, 0xc8ccd4, 0xf4f6fa], [4, 2, 4], (g) => {
    fillBox(g, 0, 0, 0, 3, 0, 0, 2); // a corner bracket, two arms
    fillBox(g, 0, 0, 1, 0, 0, 3, 2);
    for (const [x, z] of [[2, 0], [0, 2]]) setColor(g, x, 1, z, 3); // its pins
    setColor(g, 0, 1, 0, 1);
  }),
  gildedFittings: model([0x9a6a10, 0xd8a830, 0xffe080, 0xb02a3c], [4, 2, 4], (g) => {
    fillBox(g, 0, 0, 0, 3, 0, 0, 2);
    fillBox(g, 0, 0, 1, 0, 0, 3, 2);
    for (const [x, z] of [[2, 0], [0, 2]]) setColor(g, x, 1, z, 3);
    setColor(g, 0, 1, 0, 4); // a red stone at its corner
  }),
};
