// What bandits wear, earthy and dark: a hood framing the face with a
// cloth mask over mouth and nose, a leather vest over a dark green shirt,
// riding gloves, belted trousers, black boots and a short iron sword.

import type { ItemId } from '../../../../model/equipment';
import { createGrid, fillBox, setColor } from '../../voxel/voxelShapes';
import { namedPalette } from './armorShell';
import type { ItemModel } from './itemModel';

// The hood covers the crown, back and sides, with a brim over the brow;
// the face shows only between the brim and the mask.
const hood = namedPalette({ hood: 0x6b4a33, dark: 0x523826, mask: 0x2e2a28 });
const banditHood: ItemModel = {
  palette: hood.palette,
  worn: {
    head: ({ x, y, front, flank, top }) => {
      const { c } = hood;
      if (top) return x % 3 === 0 ? c.dark : c.hood;
      if (front && !flank) {
        if (y >= 5) return y === 5 ? c.dark : c.hood; // brim
        return y <= 1 ? c.mask : 0; // mask, then the eyes left open
      }
      return flank ? c.dark : c.hood;
    },
  },
};

// A sleeveless leather vest, open down the front over the shirt; the
// shirt's sleeves come with it.
const vest = namedPalette({ vest: 0x7a5236, dark: 0x5e3f28, shirt: 0x3f4a3a, shirtDark: 0x323b2e });
const banditVest: ItemModel = {
  palette: vest.palette,
  worn: {
    torso: ({ x, y, front, back, flank }) => {
      const { c } = vest;
      if (front && x === 3 && y >= 3) return c.shirt; // the open front
      if (y === 2 || back || flank) return c.dark;
      return c.vest;
    },
    arm: ({ y, flank }) => (y === 2 || flank ? vest.c.shirtDark : vest.c.shirt),
  },
};

const glove = namedPalette({ glove: 0x3a2e26, cuff: 0x4c3c30 });
const banditGloves: ItemModel = {
  palette: glove.palette,
  worn: { arm: ({ y }) => (y === 1 ? glove.c.cuff : glove.c.glove) },
};

// Brown trousers up to a dark belt with a brass buckle.
const trousers = namedPalette({ cloth: 0x4a3b2e, dark: 0x3b2f25, belt: 0x2e2622, buckle: 0xb89a5a });
const banditTrousers: ItemModel = {
  palette: trousers.palette,
  worn: {
    torso: ({ x, y, front }) => {
      const { c } = trousers;
      if (y === 1) return front && x === 3 ? c.buckle : c.belt;
      return c.cloth;
    },
    leg: ({ flank }) => (flank ? trousers.c.dark : trousers.c.cloth),
  },
};

const boots = namedPalette({ boot: 0x2a2420, cuff: 0x3a322c });
const banditBoots: ItemModel = {
  palette: boots.palette,
  worn: { leg: ({ y, z }) => (y === 1 && z <= 2 ? boots.c.cuff : boots.c.boot) },
};

// A short sword along +Z from the pommel: grip, crossguard, a plain blade.
const sword = namedPalette({ steel: 0xb9bec6, dark: 0x7d828a, grip: 0x4a3222 });
const shortSword: ItemModel = {
  palette: sword.palette,
  held: {
    build: () => {
      const { c } = sword;
      const grid = createGrid([3, 1, 13]);
      setColor(grid, 1, 0, 0, c.dark); // pommel
      fillBox(grid, 1, 0, 1, 1, 0, 4, c.grip);
      fillBox(grid, 0, 0, 5, 2, 0, 5, c.dark); // crossguard
      fillBox(grid, 1, 0, 6, 1, 0, 12, (_x, _y, z) => (z === 12 ? c.dark : c.steel));
      return grid;
    },
    grip: [1.5, 0.25, 2.5], // as the arming sword's (starterSet.ts)
  },
};

export const BANDIT_MODELS = { banditHood, banditVest, banditGloves, banditTrousers, banditBoots, shortSword } satisfies Partial<Record<ItemId, ItemModel>>;
