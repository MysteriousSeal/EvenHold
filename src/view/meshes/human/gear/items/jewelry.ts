// How jewelry looks: small voxel models of their own (it's too small to
// show on the body), for icons on the hero sheet and in the bag.
// Amulets stand upright, facing +Z: a square chain loop and a pendant
// hanging below. Rings stand upright too: a band two voxels deep with a
// raised setting on top, and a stone in it if they have one.
//
// The new pieces (each a STAND-IN below till it's drawn; its set's colours: setPalettes.ts):
// - barrowTorc (barrow): an open torc of twisted grave-gold, green with verdigris in the twists, its two ends knobbed.
//   Grave-gold a89048, verdigris 4e7a64 / 6e9a80.
// - trophyCord (flayer): a dark thong strung with teeth and finger bones, a dried scrap of hide in the middle. Thong
//   2a1c18, tooth efe6cc, bone dcb8a0, hide 9a5a4a.
// - scallopShell (palmer): a cream scallop shell, ribbed in fans, on a red cord. Shell f0e4cc / d8c4a0, cord 9a2a2a.
// - fingerboneRing (ossuary): a ring of three finger bones wired end to end, a knucklebone for its setting. Bone e0d4b4
//   / b8a986, wire 6e747c.
// - emberRing (cinder): a soot-black iron band, an ember-red stone that glows at its heart. Soot 2a2826, ember e0602a, glow ffb040.
// - ducalSignet (velvet): a heavy gold signet, a burgundy enamel face with a gold crest on it, a pearl either side.
//   Gold d4b060, enamel 6e1a2a, pearl f6f2ea.

import type { NECK_ITEMS, RING_ITEMS } from '../../../../../model/human/items/jewelry';
import { createGrid, fillBox, setColor } from '../../../voxel/voxelShapes';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';

// An amulet: a 7x7 chain loop, a pendant `w` x `h` below, its middle in `accent`.
function amulet(chain: number, pendant: number, accent: number, w = 3, h = 3): ItemModel {
  const { palette, c } = namedPalette({ chain, pendant, accent });
  return {
    palette,
    jewel: {
      build: () => {
        const grid = createGrid([7, 7 + h, 1]);
        fillBox(grid, 0, h, 0, 6, h + 6, 0, (x, y) => (x === 0 || x === 6 || y === h + 6 ? c.chain : 0)); // the loop, open at the bottom
        const x0 = 3 - Math.floor(w / 2);
        fillBox(grid, x0, 0, 0, x0 + w - 1, h - 1, 0, c.pendant);
        setColor(grid, 3, Math.floor(h / 2), 0, c.accent);
        fillBox(grid, 1, h, 0, 2, h, 0, c.chain); // the loop's ends down to the pendant
        fillBox(grid, 4, h, 0, 5, h, 0, c.chain);
        return grid;
      },
    },
  };
}

// A ring standing up: a 5x5 band two voxels deep, open in the middle, a
// setting on top (three wide) holding the stone, or a plain crest.
function ring(band: number, stone?: number): ItemModel {
  const { palette, c } = namedPalette({ band, stone: stone ?? band });
  return {
    palette,
    jewel: {
      build: () => {
        const grid = createGrid([5, 7, 2]);
        fillBox(grid, 0, 0, 0, 4, 4, 1, (x, y) => (x === 0 || x === 4 || y === 0 || y === 4 ? c.band : 0));
        fillBox(grid, 1, 5, 0, 3, 5, 1, c.band); // the setting
        if (stone !== undefined) fillBox(grid, 2, 5, 1, 2, 6, 1, c.stone);
        return grid;
      },
    },
  };
}

export const JEWELRY_MODELS: Record<keyof typeof NECK_ITEMS | keyof typeof RING_ITEMS, ItemModel> = {
  woodenCharm: amulet(0x6b4a33, 0x9a6a3e, 0x6b4226),
  carvedPendant: amulet(0x6b4a33, 0x9a6a3e, 0x3a78c8), // (oak, a gem shard set in it)
  heartwoodAmulet: amulet(0x8a5a3a, 0x6e2a1a, 0xe85a6a), // (heartwood, a cut gem)
  boneTalisman: amulet(0x6b4a33, 0xe8dcc0, 0x9a3a2a),
  wolfToothNecklace: amulet(0x5e3f28, 0xefe6cc, 0xd6c79a, 1, 3),
  silverLocket: amulet(0xb8bec6, 0xc8ced6, 0x8d939c),
  amberPendant: amulet(0xa8862e, 0xe0902a, 0xf6c060),
  lakeStone: amulet(0xd4b060, 0x3dbdb8, 0x9be8da),
  ironTorc: amulet(0x6e747c, 0x8d939c, 0x6e747c, 5, 1),
  pearlStrand: amulet(0xf0ece0, 0xf0ece0, 0xffffff, 1, 1),
  runeStone: amulet(0x6b4a33, 0x7d828a, 0x3dbdb8),
  goldChain: amulet(0xd4b060, 0xd4b060, 0xa8862e, 3, 2),
  copperRing: ring(0xb87333),
  ironBand: ring(0x7d838c),
  boneRing: ring(0xe8dcc0),
  bentwoodRing: ring(0x9a6a3e, 0xc8ced6), // (a strip of birch bent round, bound in silver)
  silverRing: ring(0xc8ced6),
  goldRing: ring(0xd4b060),
  jadeRing: ring(0xd4b060, 0x4aa86a),
  rubyRing: ring(0xd4b060, 0xc02a3a),
  sapphireRing: ring(0xc8ced6, 0x2a4ac0),
  signetRing: ring(0xd4b060, 0xa8862e),
  twistedWire: ring(0xb87333, 0xd8a860),
  barrowTorc: amulet(0xa89048, 0xa89048, 0x4e7a64, 5, 1), // STAND-IN: open torc of twisted grave-gold, verdigris in the twists, knobbed ends
  trophyCord: amulet(0x2a1c18, 0xefe6cc, 0x9a5a4a, 1, 3), // STAND-IN: dark thong strung with teeth and finger bones, a dried scrap of hide
  scallopShell: amulet(0x9a2a2a, 0xf0e4cc, 0xd8c4a0), // STAND-IN: cream ribbed scallop shell on a red cord
  fingerboneRing: ring(0xe0d4b4, 0xb8a986), // STAND-IN: three finger bones wired end to end, a knucklebone setting
  emberRing: ring(0x2a2826, 0xe0602a), // STAND-IN: soot-black iron band, an ember-red stone glowing at its heart
  ducalSignet: ring(0xd4b060, 0x6e1a2a), // STAND-IN: heavy gold signet, burgundy enamel face with a gold crest, a pearl either side
};
