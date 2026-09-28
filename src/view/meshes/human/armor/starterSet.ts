// The hero's starter set, humble and warm: a quilted linen gambeson with
// sleeves, a leather cap, woad-blue wool hose under a belt, leather boots,
// an arming sword and a small plank shield painted in EvenHold's turquoise.

import type { ItemId } from '../../../../model/equipment';
import { createGrid, fillBox, setColor } from '../../voxel/voxelShapes';
import { namedPalette } from './armorShell';
import type { ItemModel } from './itemModel';

// A leather cap: a seamed crown, down to the ears at the sides and back,
// a brow band in front, brass rivets along its rim.
const cap = namedPalette({ leather: 0x8a5a35, rim: 0x6b4226, seam: 0x4e2f1a, rivet: 0xd4b060 });
const leatherCap: ItemModel = {
  palette: cap.palette,
  worn: {
    head: ({ x, y, z, front, top }) => {
      const { c } = cap;
      if (top) return x === 3 || z === 3 ? c.seam : c.leather;
      const rim = front ? 6 : 4;
      if (y < rim) return 0;
      if (y > rim) return c.leather;
      return !front && (x + z) % 3 === 0 ? c.rivet : c.rim;
    },
  },
};

// A gambeson: padded linen quilted in vertical channels, laced up the
// front, a leather-trimmed hem, and padded sleeves up over the shoulders.
const quilt = namedPalette({ linen: 0xdccba2, shade: 0xc9b58a, channel: 0xb39e74, trim: 0x8a6a45, lace: 0x5e4630 });
const gambeson: ItemModel = {
  palette: quilt.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = quilt;
      if (y === 2) return c.trim; // hem
      if (front && x === 3) return y === 4 ? c.lace : c.channel; // the laced opening
      if ((front || back) && (x === 0 || x === 6)) return c.channel;
      return flank || back ? c.shade : c.linen;
    },
    arm: ({ y, flank, top }) => {
      const { c } = quilt;
      if (top) return c.shade; // padded shoulder
      if (y === 2) return c.trim; // cuff
      if (y === 4) return c.channel;
      return flank ? c.shade : c.linen;
    },
  },
};

// Wool hose dyed with woad, held up by a belt with a brass buckle.
const hose = namedPalette({ wool: 0x5a7196, shade: 0x485c7c, belt: 0x5e3f28, buckle: 0xd4b060 });
const woolHose: ItemModel = {
  palette: hose.palette,
  worn: {
    torso: ({ x, y, front, flank }) => {
      const { c } = hose;
      if (y === 1) return front && x === 3 ? c.buckle : c.belt;
      return flank ? c.shade : c.wool;
    },
    leg: ({ flank, back }) => (flank || back ? hose.c.shade : hose.c.wool),
  },
};

// Leather ankle boots: a folded cuff and darker toe caps.
const boot = namedPalette({ leather: 0x7a4e2c, dark: 0x5e3a20, cuff: 0x9a6a3e });
const leatherBoots: ItemModel = {
  palette: boot.palette,
  worn: {
    leg: ({ y, z, front, flank }) => {
      const { c } = boot;
      if (front) return c.dark; // toe caps
      if (y === 1) return z >= 3 ? c.leather : c.cuff; // the cuff, then the top of the foot
      return flank ? c.dark : c.leather;
    },
  },
};

// An arming sword along +Z from the pommel: brass pommel, leather grip, a
// brass crossguard with steel tips, a long blade.
const sword = namedPalette({ steel: 0xc3c9d1, edge: 0x8d939c, brass: 0xd4b060, grip: 0x5e3f28 });
const armingSword: ItemModel = {
  palette: sword.palette,
  held: {
    build: () => {
      const { c } = sword;
      const grid = createGrid([3, 1, 17]);
      setColor(grid, 1, 0, 0, c.brass); // pommel
      fillBox(grid, 1, 0, 1, 1, 0, 4, c.grip);
      fillBox(grid, 0, 0, 5, 2, 0, 5, (x) => (x === 1 ? c.brass : c.edge)); // crossguard
      fillBox(grid, 1, 0, 6, 1, 0, 16, (_x, _y, z) => (z === 16 ? c.edge : c.steel));
      return grid;
    },
    // Armor faces lie on whole voxels (the torso's shells) or half ones (the
    // arms'), so held items sit a quarter voxel off both, up and down; the
    // crossguard lands half a voxel in front of the armor at the hips, the
    // pommel half a voxel behind a gloved fist.
    grip: [1.5, 0.25, 2.5],
  },
};

// A small shield of planks bound by iron bands top and bottom, its face
// painted turquoise around an iron boss, carried in front of the off hand.
const shield = namedPalette({ plank: 0x9a6a3e, plankDark: 0x7e522c, iron: 0x5a5e66, boss: 0x9aa0a8, paint: 0x3dbdb8 });
const plankShield: ItemModel = {
  palette: shield.palette,
  held: {
    build: () => {
      const { c } = shield;
      const grid = createGrid([4, 6, 1]);
      fillBox(grid, 0, 0, 0, 3, 5, 0, (x, y) => {
        if (y === 0 || y === 5) return c.iron;
        if (x === 0 || x === 3) return x === 0 ? c.plankDark : c.plank; // bare planks at the edges
        return y === 2 || y === 3 ? c.boss : c.paint;
      });
      return grid;
    },
    // Centered a voxel in from the hand (toward the body), its back three
    // voxels in front of the hand: clear of a glove and of the chest.
    grip: [3, 2.75, -3],
  },
};

export const STARTER_MODELS = { leatherCap, gambeson, woolHose, leatherBoots, armingSword, plankShield } satisfies Partial<Record<ItemId, ItemModel>>;
