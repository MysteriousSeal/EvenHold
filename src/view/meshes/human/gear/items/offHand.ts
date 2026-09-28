// How everything held in the off (left) hand looks. Shields, a book and a
// torch are carried upright in front of the hand, their backs 3 voxels
// ahead of it (clear of the chest's armor) and a voxel in toward the body;
// the parrying dagger points forward like the main hand's blades. Grips
// follow the rules in itemModel.ts.

import type { OFF_HAND_ITEMS } from '../../../../../model/items/held';
import { createGrid, fillBox, setColor } from '../../../voxel/voxelShapes';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';

const kit = namedPalette({
  plank: 0x9a6a3e,
  plankDark: 0x7e522c,
  iron: 0x5a5e66,
  boss: 0x9aa0a8,
  teal: 0x3dbdb8,
  tealDark: 0x2f9c9a,
  sand: 0xefdcb8,
  red: 0xa8402e,
  sun: 0xe8903a,
  gold: 0xd4b060,
  bronze: 0xb07a3a,
  bronzeDark: 0x8a5a28,
  bronzeLight: 0xd8a860,
  flame: 0xffb040,
  flameCore: 0xffe08a,
  cover: 0x7a2a22,
  spine: 0x5a1e18,
  pages: 0xeee4cc,
  grip: 0x5e3f28,
  steel: 0xc3c9d1,
});
const { c } = kit;

// A board `w` wide and `h` tall facing +Z, painted cell by cell, held with
// its middle a voxel in from the hand and its back 3 voxels ahead.
function board(w: number, h: number, paint: (x: number, y: number) => number): ItemModel {
  return {
    palette: kit.palette,
    held: {
      build: () => {
        const grid = createGrid([w, h, 1]);
        fillBox(grid, 0, 0, 0, w - 1, h - 1, 0, paint);
        return grid;
      },
      grip: [w / 2 + 1, h / 2 - 0.25 - (h % 2) * 0.5, -3],
    },
  };
}

const rimOf = (w: number, h: number) => (x: number, y: number) => x === 0 || y === 0 || x === w - 1 || y === h - 1;

export const OFF_HAND_MODELS: Record<keyof typeof OFF_HAND_ITEMS, ItemModel> = {
  // Planks bound by iron bands top and bottom, painted turquoise round an iron boss.
  plankShield: board(4, 6, (x, y) => {
    if (y === 0 || y === 5) return c.iron;
    if (x === 0 || x === 3) return x === 0 ? c.plankDark : c.plank;
    return y === 2 || y === 3 ? c.boss : c.teal;
  }),
  // A small square of dark boards with iron corners and an iron boss.
  buckler: board(4, 4, (x, y) => {
    const edgeX = x === 0 || x === 3;
    const edgeY = y === 0 || y === 3;
    if (edgeX && edgeY) return c.iron;
    if (!edgeX && !edgeY) return c.boss;
    return x % 2 === 0 ? c.plankDark : c.plank;
  }),
  // A steel-rimmed shield in EvenHold's colors: turquoise over sand, a gold stud.
  heaterShield: board(5, 7, (x, y) => {
    if (rimOf(5, 7)(x, y)) return c.boss;
    if (x === 2 && y === 3) return c.gold;
    return y >= 4 ? c.teal : c.sand;
  }),
  // A great wall of planks, banded with iron, nearly as tall as its bearer
  // (5 wide: odd widths keep its sides clear of the legs' faces).
  towerShield: board(5, 9, (x, y) => {
    if (y === 0 || y === 8 || y === 2 || y === 6) return c.iron;
    return x % 2 === 0 ? c.plankDark : c.plank;
  }),
  // A tall narrow shield painted in red and sand stripes.
  pavise: board(4, 8, (x, y) => (y === 0 || y === 7 ? c.iron : x % 2 === 0 ? c.red : c.sand)),
  // A sand field bearing an orange sun, rimmed in dark wood.
  crestShield: board(5, 5, (x, y) => {
    if (rimOf(5, 5)(x, y)) return c.plankDark;
    if (x === 2 && y === 2) return c.gold;
    return x === 2 || y === 2 ? c.sun : c.sand;
  }),
  // Bronze in squares one inside the other, a bright boss in the middle.
  bronzeTarge: board(5, 5, (x, y) => [c.bronzeLight, c.bronze, c.bronzeDark][Math.max(Math.abs(x - 2), Math.abs(y - 2))]),
  // A wooden stick wrapped in cloth, burning: held upright ahead of the
  // hand, low enough that the flame stays below the face.
  torch: {
    palette: kit.palette,
    held: {
      build: () => {
        const grid = createGrid([3, 9, 1]);
        fillBox(grid, 1, 0, 0, 1, 5, 0, (_x, y) => (y >= 4 ? c.grip : c.plank));
        fillBox(grid, 0, 6, 0, 2, 6, 0, (x) => (x === 1 ? c.flameCore : c.flame));
        setColor(grid, 1, 7, 0, c.flame);
        setColor(grid, 1, 8, 0, c.flameCore);
        return grid;
      },
      grip: [1.5, 3.75, -3],
    },
  },
  // A short blade with a brass guard, for catching blows.
  parryingDagger: {
    palette: kit.palette,
    held: {
      build: () => {
        const grid = createGrid([3, 1, 7]);
        setColor(grid, 1, 0, 0, c.gold);
        fillBox(grid, 1, 0, 1, 1, 0, 2, c.grip);
        fillBox(grid, 0, 0, 3, 2, 0, 3, c.gold);
        fillBox(grid, 1, 0, 4, 1, 0, 6, (_x, _y, z) => (z === 6 ? c.boss : c.steel));
        return grid;
      },
      grip: [1.5, 0.25, 0.5],
    },
  },
  // A red leather book with brass corners, pages showing at the edge.
  tome: {
    palette: kit.palette,
    held: {
      build: () => {
        const grid = createGrid([3, 4, 2]);
        fillBox(grid, 0, 0, 0, 2, 3, 1, (x, y, z) => {
          if (x === 2 && y >= 1 && y <= 2) return c.pages;
          if (z === 1 && (x === 0 || x === 2) && (y === 0 || y === 3)) return c.gold;
          return x === 0 ? c.spine : c.cover;
        });
        return grid;
      },
      grip: [1.5, 1.75, -3],
    },
  },
};
