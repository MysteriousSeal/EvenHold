// What bandits fight with: a short sword, a hatchet, a knotted club or a
// dagger, and now and then a small buckler. Each lies along +Z from the
// end held in the hand. Grips follow the arming sword's rule (starterSet.ts):
// a quarter voxel off the armor's faces up and down, so nothing held ever
// flickers against what's worn.

import type { ItemId } from '../../../../model/equipment';
import { createGrid, fillBox, setColor } from '../../voxel/voxelShapes';
import { namedPalette } from './armorShell';
import type { ItemModel } from './itemModel';

const iron = namedPalette({ steel: 0xb9bec6, dark: 0x7d828a, grip: 0x4a3222, wood: 0x7a5a3a, woodDark: 0x5e4630, knot: 0x4a3626, boss: 0x9aa0a8 });
const { c } = iron;

// Pommel, grip, crossguard, a plain blade.
const shortSword: ItemModel = {
  palette: iron.palette,
  held: {
    build: () => {
      const grid = createGrid([3, 1, 13]);
      setColor(grid, 1, 0, 0, c.dark); // pommel
      fillBox(grid, 1, 0, 1, 1, 0, 4, c.grip);
      fillBox(grid, 0, 0, 5, 2, 0, 5, c.dark); // crossguard
      fillBox(grid, 1, 0, 6, 1, 0, 12, (_x, _y, z) => (z === 12 ? c.dark : c.steel));
      return grid;
    },
    grip: [1.5, 0.25, 2.5],
  },
};

// A wooden haft, leather-wrapped where it's held, and an iron head at the
// far end with its bright edge facing down.
const hatchet: ItemModel = {
  palette: iron.palette,
  held: {
    build: () => {
      const grid = createGrid([1, 4, 10]);
      fillBox(grid, 0, 3, 0, 0, 3, 9, (_x, _y, z) => (z <= 2 ? c.grip : c.wood));
      fillBox(grid, 0, 0, 7, 0, 3, 9, (_x, y) => (y === 0 ? c.steel : c.dark)); // head, wrapping the haft
      return grid;
    },
    grip: [0.5, 3.25, 1.5],
  },
};

// A thick branch: a wrapped handle swelling into a knotted head, square in
// section and chunkier in the middle.
const club: ItemModel = {
  palette: iron.palette,
  held: {
    build: () => {
      const grid = createGrid([3, 3, 11]);
      fillBox(grid, 1, 1, 0, 1, 1, 5, (_x, _y, z) => (z <= 2 ? c.grip : c.wood));
      fillBox(grid, 0, 0, 6, 2, 2, 10, (x, y, z) => {
        const cross = x === 1 || y === 1;
        if (!cross && (z < 7 || z > 9)) return 0; // a cross at the ends, full in the middle
        return (x + y + z) % 3 === 0 && !(x === 1 && y === 1) ? c.knot : x === 1 && y === 1 ? c.wood : c.woodDark;
      });
      return grid;
    },
    grip: [1.5, 1.25, 1.5],
  },
};

// A short blade with a small crossguard, the pommel inside the fist.
const dagger: ItemModel = {
  palette: iron.palette,
  held: {
    build: () => {
      const grid = createGrid([3, 1, 8]);
      setColor(grid, 1, 0, 0, c.dark);
      fillBox(grid, 1, 0, 1, 1, 0, 2, c.grip);
      fillBox(grid, 0, 0, 3, 2, 0, 3, c.dark); // crossguard
      fillBox(grid, 1, 0, 4, 1, 0, 7, (_x, _y, z) => (z === 7 ? c.dark : c.steel));
      return grid;
    },
    grip: [1.5, 0.25, 0.5],
  },
};

// A small square of dark boards with iron corners and an iron boss.
const buckler: ItemModel = {
  palette: iron.palette,
  held: {
    build: () => {
      const grid = createGrid([4, 4, 1]);
      fillBox(grid, 0, 0, 0, 3, 3, 0, (x, y) => {
        const edgeX = x === 0 || x === 3;
        const edgeY = y === 0 || y === 3;
        if (edgeX && edgeY) return c.dark; // iron corners
        if (!edgeX && !edgeY) return c.boss;
        return x % 2 === 0 ? c.woodDark : c.wood;
      });
      return grid;
    },
    grip: [3, 1.75, -3], // as the plank shield's
  },
};

export const BANDIT_WEAPON_MODELS = { shortSword, hatchet, club, dagger, buckler } satisfies Partial<Record<ItemId, ItemModel>>;
