// How jewelry looks: small voxel models of their own (it's too small to
// show on the body), for icons on the hero sheet and in the bag.
// Amulets stand upright, facing +Z: a square chain loop and a pendant
// hanging below. Rings lie flat: a square band, maybe with a stone on top.

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

// A ring: a 5x5 band lying flat, a stone raised in the middle of one side.
function ring(band: number, stone?: number): ItemModel {
  const { palette, c } = namedPalette({ band, stone: stone ?? band });
  return {
    palette,
    jewel: {
      build: () => {
        const grid = createGrid([5, 2, 5]);
        fillBox(grid, 0, 0, 0, 4, 0, 4, (x, _y, z) => (x === 0 || x === 4 || z === 0 || z === 4 ? c.band : 0));
        if (stone !== undefined) fillBox(grid, 1, 1, 4, 3, 1, 4, (x) => (x === 2 ? c.stone : c.band));
        return grid;
      },
    },
  };
}

export const JEWELRY_MODELS: Record<keyof typeof NECK_ITEMS | keyof typeof RING_ITEMS, ItemModel> = {
  woodenCharm: amulet(0x6b4a33, 0x9a6a3e, 0x6b4226),
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
  silverRing: ring(0xc8ced6),
  goldRing: ring(0xd4b060),
  jadeRing: ring(0xd4b060, 0x4aa86a),
  rubyRing: ring(0xd4b060, 0xc02a3a),
  sapphireRing: ring(0xc8ced6, 0x2a4ac0),
  signetRing: ring(0xd4b060, 0xa8862e),
  twistedWire: ring(0xb87333, 0xd8a860),
};
