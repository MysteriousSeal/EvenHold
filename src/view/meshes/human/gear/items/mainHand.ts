// How everything held in the main (right) hand looks: weapons, each lying
// along +Z from the end in the hand. Grips follow the rules in itemModel.ts;
// blades have their crossguard at z 5 with the grip at 2.5, so the guard
// sits half a voxel clear of a glove and of the armor at the hips. Long
// shafts held in the middle sit a voxel outside the hand, so what runs back
// past the fist clears the hips.

import type { MAIN_HAND_ITEMS } from '../../../../../model/items/held';
import { createGrid, fillBox, setColor } from '../../../voxel/voxelShapes';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';
import { mod } from '../patterns';

const metal = namedPalette({
  steel: 0xc3c9d1,
  edge: 0x8d939c,
  dark: 0x6e747c,
  brass: 0xd4b060,
  grip: 0x5e3f28,
  wood: 0x7a5a3a,
  woodDark: 0x5e4630,
  woodLight: 0xb89466,
  knot: 0x4a3626,
});
const { c } = metal;
const held = (build: () => ReturnType<typeof createGrid>, grip: [number, number, number]): ItemModel => ({ palette: metal.palette, held: { build, grip } });

// A sword 3 voxels wide at the guard: pommel, a 4-voxel grip, crossguard at
// z 5, then `blade` voxels of blade.
function sword(blade: number, colors: { pommel: number; grip: number; guard: number; guardTips: number; blade: number; tip: number }) {
  return held(() => {
    const grid = createGrid([3, 1, 6 + blade]);
    setColor(grid, 1, 0, 0, colors.pommel);
    fillBox(grid, 1, 0, 1, 1, 0, 4, colors.grip);
    fillBox(grid, 0, 0, 5, 2, 0, 5, (x) => (x === 1 ? colors.guard : colors.guardTips));
    fillBox(grid, 1, 0, 6, 1, 0, 5 + blade, (_x, _y, z) => (z === 5 + blade ? colors.tip : colors.blade));
    return grid;
  }, [1.5, 0.25, 2.5]);
}

// A haft with a head at the far end: `head` paints the head's voxels,
// `rows` tall with the haft on row `haftRow`.
function hafted(length: number, rows: number, haftRow: number, head: (y: number, z: number) => number) {
  return held(() => {
    const grid = createGrid([1, rows, length]);
    fillBox(grid, 0, 0, 0, 0, rows - 1, length - 1, (_x, y, z) => head(y, z) || (y === haftRow ? (z <= 2 ? c.grip : c.wood) : 0));
    return grid;
  }, [0.5, haftRow + 0.25, 1.5]);
}

// A long pole held in the middle, a voxel outside the hand.
function pole(length: number, end: (z: number) => number, grip: number) {
  return held(() => {
    const grid = createGrid([1, 1, length]);
    fillBox(grid, 0, 0, 0, 0, 0, length - 1, (_x, _y, z) => end(z) || c.wood);
    return grid;
  }, [1.5, 0.25, grip]);
}

// A thick 3x3 head (painted by `head`, z 7-11) on a thin wrapped handle.
function cudgel(head: (x: number, y: number, z: number) => number) {
  return held(() => {
    const grid = createGrid([3, 3, 12]);
    fillBox(grid, 1, 1, 0, 1, 1, 6, (_x, _y, z) => (z <= 2 ? c.grip : c.wood));
    fillBox(grid, 0, 0, 7, 2, 2, 11, head);
    return grid;
  }, [1.5, 1.25, 1.5]);
}

export const MAIN_HAND_MODELS: Record<keyof typeof MAIN_HAND_ITEMS, ItemModel> = {
  armingSword: sword(11, { pommel: c.brass, grip: c.grip, guard: c.brass, guardTips: c.edge, blade: c.steel, tip: c.edge }),
  shortSword: sword(7, { pommel: c.edge, grip: c.grip, guard: c.edge, guardTips: c.edge, blade: c.steel, tip: c.edge }),
  woodenSword: sword(8, { pommel: c.woodDark, grip: c.grip, guard: c.woodDark, guardTips: c.woodDark, blade: c.woodLight, tip: c.wood }),
  // A short blade with a small guard, the pommel inside the fist.
  dagger: held(() => {
    const grid = createGrid([3, 1, 8]);
    setColor(grid, 1, 0, 0, c.edge);
    fillBox(grid, 1, 0, 1, 1, 0, 2, c.grip);
    fillBox(grid, 0, 0, 3, 2, 0, 3, c.edge);
    fillBox(grid, 1, 0, 4, 1, 0, 7, (_x, _y, z) => (z === 7 ? c.edge : c.steel));
    return grid;
  }, [1.5, 0.25, 0.5]),
  // An iron head at the far end, its bright edge facing down.
  hatchet: hafted(10, 4, 3, (y, z) => (z >= 7 ? (y === 0 ? c.steel : c.dark) : 0)),
  // A double-bitted head, both edges bright.
  battleAxe: hafted(13, 7, 3, (y, z) => {
    if (z < 8 || z > 11) return 0;
    if (y === 3) return c.dark; // the eye round the haft
    if (z === 8) return 0; // the bits flare out past the eye
    return y === 0 || y === 6 ? c.steel : c.edge;
  }),
  // A block of a head across the haft, flat face down, spike up.
  warHammer: hafted(12, 5, 2, (y, z) => (z >= 10 ? (y === 0 ? c.steel : y === 4 ? c.dark : c.edge) : 0)),
  // A thick branch, square in section and chunkier in the middle, knotted.
  club: cudgel((x, y, z) => {
    const cross = x === 1 || y === 1;
    if (!cross && (z < 8 || z > 10)) return 0;
    if (x === 1 && y === 1) return c.wood;
    return mod(x + y + z, 3) === 0 ? c.knot : c.woodDark;
  }),
  // Flanges in a cross around an iron core, a knob on top.
  mace: cudgel((x, y, z) => {
    const cross = x === 1 || y === 1;
    if (z === 11) return x === 1 && y === 1 ? c.edge : 0;
    if (z === 7) return x === 1 && y === 1 ? c.dark : 0;
    return cross ? (x === 1 && y === 1 ? c.dark : c.steel) : 0;
  }),
  // An ash shaft with an iron head.
  spear: pole(26, (z) => (z >= 23 ? (z === 25 ? c.edge : c.steel) : z === 22 ? c.dark : 0), 6.5),
  // A long staff shod with iron at both ends, wrapped where it's held.
  quarterstaff: pole(24, (z) => (z === 0 || z === 23 ? c.dark : z >= 10 && z <= 13 ? c.grip : 0), 11.5),
};
