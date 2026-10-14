// How everything held in the off (left) hand looks. Shields (in the body's
// own voxels, in relief), a book and a torch are carried upright in front of
// the hand, their backs well ahead of it (clear of the chest's armor) and a
// voxel in toward the body;
// the parrying dagger points forward like the main hand's blades. Grips
// follow the rules in itemModel.ts.
//
// The new off-hand pieces (each a STAND-IN below till it's drawn, in the kit's colours; drawn, each its set's:
// setPalettes.ts; a shield keeps to shield() and its 7 wide):
// - ossuaryWard (ossuary): a kite of bone, ribs laid side by side across it, wired, a skull boss in its middle with
//   black sockets. Bone e0d4b4 / b8a986 / 8e7f62, socket 2a2220, wire 6e747c.
// - smokingCenser (cinder): a black-iron censer swung on a short chain from the fist, pierced all round, ember light in
//   the holes, a wisp of ash-grey smoke above (carried as the torch is). Soot 2a2826, ember e0602a / glow ffb040, smoke 8a847e.
// - watchShield (watch): a heater in teal, a sand tower (the watch's badge) on it, a steel rim and brass studs at the
//   corners. Teal 2f9c9a / 217c7a, sand efdcb8, steel b4bac2, brass d4b060.
// - sunwardAegis (sunward, legendary): a round gilded shield, ivory enamel field, a great gold sun of eight rays on azure
//   standing out in two layers of relief, a ruby at its heart, a fluted gold rim. Gold d4b060 / f0d080 / a8862e, ivory
//   f4f0e6, azure 3060c0, ruby b02838.
// - blackbannerPavise (blackbanner): a tall black pavise, a raised spine, a white band across it high up, blackened iron
//   along its top and foot. Cloth 26242a / 3a3840, band e8e2d4, iron 3e4046.

import type { OFF_HAND_ITEMS } from '../../../../../model/human/items/held';
import { createGrid, fillBox, setColor } from '../../../voxel/voxelShapes';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { mod } from '../patterns';

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

// A shield `w` wide and `h` tall facing +Z, in the body's own voxels, its
// face in relief: `layers(x, y)` gives its colours from the back out (the
// board, then what's raised on it: a rim, a band, a boss), none outside its
// outline. Held with its middle a voxel in from the hand and its back well
// ahead of it, its grip on quarter voxels (itemModel.ts `fine`).
function shield(w: number, h: number, layers: (x: number, y: number) => number[]): ItemModel {
  return {
    palette: kit.palette,
    held: {
      build: () => {
        const grid = createGrid([w, h, 4]);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) layers(x, y).forEach((color, z) => color && setColor(grid, x, y, z, color));
        return grid;
      },
      grip: [w / 2 + 1.25, h / 2 - 0.25, -4.75],
      fine: true,
    },
  };
}

// Where a round shield `n` across is: how far a cell is from its middle (in voxels), and whether it's on it at all.
const round = (n: number) => {
  const mid = (n - 1) / 2;
  const from = (x: number, y: number) => Math.hypot(x - mid, y - mid);
  return { from, on: (x: number, y: number) => from(x, y) <= mid + 0.4, rim: (x: number, y: number) => from(x, y) > mid - 0.6 };
};
const disc7 = round(7);

export const OFF_HAND_MODELS: Record<keyof typeof OFF_HAND_ITEMS, ItemModel> = {
  // Upright planks painted turquoise, bound top and bottom by riveted iron
  // bands standing proud of them, an iron boss domed in the middle.
  plankShield: shield(7, 9, (x, y) => {
    const band = y === 0 || y === 8;
    const board = x === 0 || x === 6 ? (x === 0 ? c.plankDark : c.plank) : mod(x, 2) === 0 ? c.tealDark : c.teal; // (painted planks, their seams showing)
    if (band) return [c.iron, x === 1 || x === 5 ? c.boss : c.iron];
    if (y >= 3 && y <= 5 && x >= 2 && x <= 4) return [board, c.iron, x === 3 && y === 4 ? c.boss : 0];
    return [board];
  }),
  // A small round buckler of dark boards, an iron rim raised round it and a
  // bright boss standing out in the middle.
  buckler: shield(7, 7, (x, y) => {
    if (!disc7.on(x, y)) return [];
    const boards = mod(x, 2) === 0 ? c.plankDark : c.plank;
    if (disc7.rim(x, y)) return [boards, c.iron];
    const d = disc7.from(x, y);
    return d <= 1.5 ? [boards, c.boss, d < 0.5 ? c.steel : 0] : [boards];
  }),
  // A heater shield in EvenHold's colours, sand over turquoise, its steel
  // rim raised all round its pointed outline, a gold stud standing out.
  heaterShield: shield(7, 11, (x, y) => {
    const half = y >= 3 ? 3 : y; // (its point: narrower to the foot)
    if (Math.abs(x - 3) > half) return [];
    const edge = Math.abs(x - 3) === half || y === 10;
    const field = y >= 7 ? c.sand : c.teal;
    if (edge) return [field, c.boss];
    if (x === 3 && (y === 6 || y === 7)) return [field, c.gold, y === 6 ? c.gold : 0];
    return [field];
  }),
  // A great wall of planks, its top corners rounded, three iron bands
  // riveted across it standing proud, a boss in its middle.
  towerShield: shield(7, 13, (x, y) => {
    if (y === 12 && (x === 0 || x === 6)) return [];
    const planks = mod(x, 2) === 0 ? c.plankDark : c.plank;
    if (y === 1 || y === 6 || y === 11) return [planks, x === 1 || x === 5 ? c.boss : c.iron];
    if (y >= 5 && y <= 7 && x >= 2 && x <= 4) return [planks, c.iron, x === 3 && y === 6 ? c.boss : 0];
    return [planks];
  }),
  // A tall pavise in red and sand stripes, a raised spine down its middle,
  // its top rounded, iron along its top and foot.
  pavise: shield(7, 12, (x, y) => {
    if (y === 11 && (x === 0 || x === 6)) return [];
    const stripe = mod(x, 2) === 0 ? c.red : c.sand;
    if (y === 0 || y === 11 || (y === 10 && (x === 0 || x === 6))) return [stripe, c.iron];
    return x === 3 ? [stripe, c.red] : [stripe];
  }),
  // A round shield rimmed in dark wood, a sun raised on its sand field, its
  // rays reaching out, its heart gold.
  crestShield: shield(7, 7, (x, y) => {
    if (!disc7.on(x, y)) return [];
    if (disc7.rim(x, y)) return [c.plankDark, c.plankDark];
    const d = disc7.from(x, y);
    if (d < 0.5) return [c.sand, c.sun, c.gold];
    if (d < 1.5) return [c.sand, c.sun];
    return (x === 3 || y === 3 || Math.abs(x - 3) === Math.abs(y - 3)) ? [c.sand, c.sun] : [c.sand]; // its rays
  }),
  // A bronze targe stepped up in rings to a bright boss.
  bronzeTarge: shield(7, 7, (x, y) => {
    if (!disc7.on(x, y)) return [];
    const d = disc7.from(x, y);
    if (disc7.rim(x, y)) return [c.bronzeDark, c.bronze];
    return d < 0.5 ? [c.bronze, c.bronzeLight, c.bronzeLight, c.steel] : d < 1.5 ? [c.bronze, c.bronzeLight, c.bronzeLight] : [c.bronzeDark, c.bronze];
  }),
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
  // STAND-IN: a kite of bone, ribs laid side by side, wired, a skull boss with black sockets
  ossuaryWard: shield(7, 11, (x, y) => {
    const half = y >= 3 ? 3 : y;
    if (Math.abs(x - 3) > half) return [];
    return x === 3 && y >= 5 && y <= 7 ? [c.sand, c.pages] : [mod(y, 2) === 0 ? c.sand : c.pages];
  }),
  // STAND-IN: a pierced black-iron censer on a short chain, ember light in its holes, a wisp of smoke above
  smokingCenser: {
    palette: kit.palette,
    held: {
      build: () => {
        const grid = createGrid([3, 9, 1]);
        fillBox(grid, 1, 0, 0, 1, 5, 0, c.iron);
        fillBox(grid, 0, 6, 0, 2, 7, 0, (x, y) => (x === 1 && y === 6 ? c.flame : c.iron));
        setColor(grid, 1, 8, 0, c.boss);
        return grid;
      },
      grip: [1.5, 3.75, -3],
    },
  },
  // STAND-IN: a teal heater, the watch's sand tower on it, steel rim, brass studs at the corners
  watchShield: shield(7, 11, (x, y) => {
    const half = y >= 3 ? 3 : y;
    if (Math.abs(x - 3) > half) return [];
    if (Math.abs(x - 3) === half || y === 10) return [c.teal, c.steel];
    return x >= 2 && x <= 4 && y >= 4 && y <= 8 ? [c.teal, c.sand] : [c.teal];
  }),
  // STAND-IN: round gilded shield, ivory field, a great gold sun of eight rays on azure in two layers, ruby heart, fluted rim
  sunwardAegis: shield(7, 7, (x, y) => {
    if (!disc7.on(x, y)) return [];
    if (disc7.rim(x, y)) return [c.gold, c.gold];
    const d = disc7.from(x, y);
    if (d < 0.5) return [c.pages, c.gold, c.red];
    return x === 3 || y === 3 || Math.abs(x - 3) === Math.abs(y - 3) ? [c.pages, c.gold] : [c.pages];
  }),
  // STAND-IN: tall black pavise, raised spine, a white band across it high up, blackened iron top and foot
  blackbannerPavise: shield(7, 12, (x, y) => {
    if (y === 11 && (x === 0 || x === 6)) return [];
    if (y === 0 || y === 11) return [c.iron, c.iron];
    if (y === 8) return [c.pages];
    return x === 3 ? [c.spine, c.spine] : [c.spine];
  }),
};
