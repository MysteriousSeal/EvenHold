// How jewelry looks: small voxel models of their own (it's too small to
// show on the body), for icons on the hero sheet and in the bag.
// Amulets stand upright, facing +Z: a square chain loop and a pendant
// hanging below. Rings stand upright too: a band two voxels deep with a
// raised setting on top, and a stone in it if they have one.
//
// The new pieces (each its set's colours: setPalettes.ts), each built its own way:
// - barrowTorc (barrow): an open torc of twisted grave-gold, green with verdigris in the twists, its two ends knobbed.
//   Grave-gold a89048, verdigris 4e7a64 / 6e9a80.
// - trophyCord (flayer): a dark thong strung with teeth and finger bones, a dried scrap of hide in the middle. Thong
//   2a1c18, tooth efe6cc, bone c4a46a, hide 7a4a32.
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
import { mod } from '../patterns';
import { SET_PALETTES } from '../setPalettes';

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

// A ring standing up: a round hoop 7 across, a voxel thick and two deep,
// lit on its upper left and shaded on its lower right (round, not a square
// nut); a stone, if it has one, in a setting on top.
const tint = (hex: number, k: number) => [16, 8, 0].reduce((n, s) => n | (Math.min(255, Math.round(((hex >> s) & 255) * k)) << s), 0);
const HOOP = ['..###..', '.#...#.', '#.....#', '#.....#', '#.....#', '.#...#.', '..###..']; // (top row first)
function ring(band: number, stone?: number): ItemModel {
  const { palette, c } = namedPalette({ band, lit: tint(band, 1.22), shade: tint(band, 0.72), stone: stone ?? band });
  return {
    palette,
    jewel: {
      build: () => {
        const grid = createGrid([7, stone === undefined ? 7 : 9, 2]);
        fillBox(grid, 0, 0, 0, 6, 6, 1, (x, y) => (HOOP[6 - y][x] !== '#' ? 0 : y - x >= 3 ? c.lit : x - y >= 3 ? c.shade : c.band));
        if (stone !== undefined) {
          fillBox(grid, 2, 7, 0, 4, 7, 1, c.band); // the setting
          fillBox(grid, 3, 7, 1, 3, 8, 1, c.stone);
        }
        return grid;
      },
    },
  };
}

// A bentwood ring: a strip of birch bent round, its grain in two tones, bound in silver at its sides and its top.
const birch = namedPalette({ wood: 0x9a6a3e, grain: 0x7a4e2a, silver: 0xd8dde4 });
const bentwoodRing: ItemModel = {
  palette: birch.palette,
  jewel: {
    build: () => {
      const { c } = birch;
      const grid = createGrid([7, 7, 2]);
      fillBox(grid, 0, 0, 0, 6, 6, 1, (x, y) => (HOOP[6 - y][x] !== '#' ? 0 : y === 3 || (y === 6 && x === 3) ? c.silver : mod(x + y, 2) ? c.grain : c.wood));
      return grid;
    },
  },
};

// The barrow's torc: a ring of twisted grave-gold open at the bottom, two
// strands deep, verdigris in the twists, the ends knobbed.
const barrow = namedPalette({ ...SET_PALETTES.barrow });
const barrowTorc: ItemModel = {
  palette: barrow.palette,
  jewel: {
    build: () => {
      const { c } = barrow;
      const grid = createGrid([9, 8, 2]);
      const twist = (x: number, y: number, z: number) => (mod(x + y + z, 2) === 0 ? c.graveGold : c.verdigris);
      fillBox(grid, 0, 2, 0, 8, 7, 1, (x, y, z) => ((x === 0 || x === 8 || y === 7) && !((x === 0 || x === 8) && y === 7) ? twist(x, y, z) : 0)); // the hoop, its corners rounded off
      fillBox(grid, 1, 6, 0, 1, 6, 1, twist);
      fillBox(grid, 7, 6, 0, 7, 6, 1, twist);
      fillBox(grid, 1, 0, 0, 2, 1, 1, c.graveGold); // the knobs, turned in toward the gap
      fillBox(grid, 6, 0, 0, 7, 1, 1, c.graveGold);
      setColor(grid, 1, 2, 0, c.graveGold);
      setColor(grid, 7, 2, 0, c.graveGold);
      setColor(grid, 2, 0, 1, c.verdigrisLight);
      setColor(grid, 6, 0, 1, c.verdigrisLight);
      return grid;
    },
  },
};

// The flayer's trophy cord: a black thong strung with teeth and finger
// bones, a dried scrap of hide in the middle.
const flayer = namedPalette({ ...SET_PALETTES.flayer });
const trophyCord: ItemModel = {
  palette: flayer.palette,
  jewel: {
    build: () => {
      const { c } = flayer;
      const grid = createGrid([13, 13, 1]);
      fillBox(grid, 0, 4, 0, 12, 12, 0, (x, y) => (x === 0 || x === 12 || y === 12 || y === 4 ? c.stitch : 0)); // the thong, a thin loop
      for (const x of [1, 11]) fillBox(grid, x, 2, 0, x, 3, 0, c.tooth); // teeth
      for (const x of [3, 9]) fillBox(grid, x, 1, 0, x, 3, 0, (_, y) => (y === 2 ? c.hideDark : c.hidePale)); // finger bones, a knuckle in each
      fillBox(grid, 5, 0, 0, 7, 3, 0, (x, y) => (x === 6 && y === 2 ? c.blood : y === 0 && x !== 6 ? 0 : c.raw)); // the scrap of hide
      return grid;
    },
  },
};

// The palmer's scallop: a cream shell whose ribs stand out in a fan from
// the hinge, its two ears at the top, hung on a red cord.
const palmer = namedPalette({ ...SET_PALETTES.palmer });
const scallopShell: ItemModel = {
  palette: palmer.palette,
  jewel: {
    build: () => {
      const { c } = palmer;
      const grid = createGrid([7, 12, 2]);
      const rows: Array<[number, number]> = [[1, 5], [0, 6], [0, 6], [0, 6], [1, 5], [2, 4], [1, 5]]; // bottom up: the fan, the hinge, the ears
      rows.forEach(([x0, x1], y) => fillBox(grid, x0, y, 0, x1, y, 1, (x, _, z) => (y === 0 && mod(x, 2) === 1 ? 0 : z === 0 || y >= 5 || mod(x, 2) === 0 ? c.shell : c.fawn))); // ribbed, its edge wavy
      fillBox(grid, 0, 7, 0, 6, 11, 0, (x, y) => ((x === 0 || x === 6 || y === 11) && !(y === 11 && (x === 0 || x === 6)) ? c.cross : 0)); // the cord
      setColor(grid, 0, 7, 0, 0);
      setColor(grid, 6, 7, 0, 0);
      fillBox(grid, 1, 7, 0, 1, 7, 0, c.cross);
      fillBox(grid, 5, 7, 0, 5, 7, 0, c.cross);
      return grid;
    },
  },
};

// The Reliquary's: a saint's finger in a little gilt capsule on a red cord, a crystal down its front showing the
// bone, a gilt cap at either end.
const reliquary = namedPalette({ ...SET_PALETTES.reliquary });
const saintsFinger: ItemModel = {
  palette: reliquary.palette,
  jewel: {
    build: () => {
      const { c } = reliquary;
      const grid = createGrid([5, 9, 2]);
      fillBox(grid, 0, 6, 0, 4, 8, 0, (x, y) => (x === 0 || x === 4 || y === 8 ? c.silk : 0)); // the cord
      fillBox(grid, 1, 5, 0, 3, 5, 1, c.giltLight); // its cap
      fillBox(grid, 1, 1, 0, 3, 4, 1, (x, y, z) => (z === 1 && x === 2 ? (y === 1 ? c.gilt : c.crystal) : x === 2 && z === 0 ? c.bone : c.gilt)); // the capsule, the finger in it
      fillBox(grid, 1, 0, 0, 3, 0, 1, c.giltDark); // its foot
      return grid;
    },
  },
};

// The ossuary's ring: three finger bones wired end to end round the finger,
// their knuckles swelling at the joins, a knucklebone set on top.
const ossuary = namedPalette({ ...SET_PALETTES.ossuary });
const fingerboneRing: ItemModel = {
  palette: ossuary.palette,
  jewel: {
    build: () => {
      const { c } = ossuary;
      const grid = createGrid([5, 7, 2]);
      const joint = (x: number, y: number) => (x === 0 && y === 1) || (x === 4 && y === 1) || (x === 2 && y === 4);
      fillBox(grid, 0, 0, 0, 4, 4, 1, (x, y, z) => (x === 0 || x === 4 || y === 0 || y === 4 ? (joint(x, y) ? (z === 1 ? c.wire : c.boneDark) : mod(x + y, 3) === 0 ? c.boneShade : c.bone) : 0));
      fillBox(grid, 1, 5, 0, 3, 5, 1, c.boneShade); // the knucklebone,
      fillBox(grid, 1, 6, 0, 3, 6, 1, (x) => (x === 2 ? c.socket : c.bone)); // its two knobs
      return grid;
    },
  },
};

// Cinder: a soot-black iron band with ember cracks, a raw stone of ember
// held in iron claws, glowing at its heart.
const cinder = namedPalette({ ...SET_PALETTES.cinder });
const emberRing: ItemModel = {
  palette: cinder.palette,
  jewel: {
    build: () => {
      const { c } = cinder;
      const grid = createGrid([5, 8, 2]);
      fillBox(grid, 0, 0, 0, 4, 4, 1, (x, y) => (x === 0 || x === 4 || y === 0 || y === 4 ? c.soot : 0));
      setColor(grid, 0, 2, 1, c.ember); // a crack
      setColor(grid, 4, 1, 1, c.ember);
      fillBox(grid, 0, 5, 0, 4, 5, 1, (x) => (x === 0 || x === 4 ? c.sootDeep : c.soot)); // the claws,
      fillBox(grid, 1, 6, 0, 3, 7, 1, (x, y) => (y === 7 && x !== 2 ? 0 : c.ember)); // the stone,
      setColor(grid, 2, 6, 1, c.glow); // its heart
      return grid;
    },
  },
};

// The velvet court's ducal signet: a heavy gold band, a broad bezel, its
// face on top burgundy enamel between gold rims with a gold crest, a pearl
// either side of it.
const velvet = namedPalette({ ...SET_PALETTES.velvet });
const ducalSignet: ItemModel = {
  palette: velvet.palette,
  jewel: {
    build: () => {
      const { c } = velvet;
      const grid = createGrid([7, 7, 3]);
      fillBox(grid, 1, 0, 0, 5, 4, 2, (x, y) => (x === 1 || x === 5 || y <= 1 || y === 4 ? c.gold : 0)); // the band, heavy below
      fillBox(grid, 1, 5, 0, 5, 5, 2, c.gold); // the bezel,
      fillBox(grid, 1, 6, 0, 5, 6, 2, (x, _, z) => (x === 1 || x === 5 ? c.gold : x === 3 && z === 1 ? c.gold : c.velvet)); // its face on top, the crest in it
      setColor(grid, 0, 5, 1, c.pearl);
      setColor(grid, 6, 5, 1, c.pearl);
      return grid;
    },
  },
};

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
  bentwoodRing,
  silverRing: ring(0xc8ced6),
  goldRing: ring(0xd4b060),
  jadeRing: ring(0xd4b060, 0x4aa86a),
  rubyRing: ring(0xd4b060, 0xc02a3a),
  sapphireRing: ring(0xc8ced6, 0x2a4ac0),
  signetRing: ring(0xd4b060, 0xa8862e),
  twistedWire: ring(0xb87333, 0xd8a860),
  barrowTorc,
  saintsFinger,
  trophyCord,
  scallopShell,
  pilgrimAmpulla: amulet(0x9a2a2a, 0x8a8e94, 0xb8bcc2, 3, 4), // (a lead flask on a red cord)
  saintsKnuckle: amulet(0xb8bec6, 0xc8ced6, 0xe6d8b4, 3, 3), // (a bone in a silver case)
  martyrsThorn: amulet(0xd4b060, 0xd4b060, 0x3a2a1c, 3, 4), // (a black thorn under crystal, in gold)
  fingerboneRing,
  emberRing,
  ducalSignet,
};
