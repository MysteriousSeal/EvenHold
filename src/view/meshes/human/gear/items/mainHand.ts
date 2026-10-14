// How everything held in the main (right) hand looks: weapons, each lying
// along +Z from the end in the hand. Grips follow the rules in itemModel.ts;
// blades have their crossguard at z 5 with the grip at 2.5, so the guard
// sits half a voxel clear of a glove and of the armor at the hips. Long
// shafts held in the middle sit a voxel outside the hand, so what runs back
// past the fist clears the hips.
//
// The new weapons (each a STAND-IN below till it's drawn, in metal's colours; drawn, each its set's: setPalettes.ts):
// - headsmansAxe (headsman): a long two-handed haft, a broad bearded head with a straight edge (a headsman's, not a
//   woodsman's), black-iron with a bright edge, the haft wound in black leather, a dark stain on the bit. Iron 5a5e66 /
//   7d838c, edge c3c9d1, haft 3e2a22, wrap 1c1a1c, stain 3a0e10.
// - barrowBlade (barrow): a broad old sword, its blade pitted rust with notches bitten out of the edge, a verdigris
//   bronze guard and a grave-gold pommel. Rust 8a4a22 / 5e2e16, pitted 7d7a72, verdigris 4e7a64, pommel a89048.
// - flensingKnife (flayer): a short curved skinning knife, a wide belly to the blade, a bone grip bound in raw hide,
//   dark at the edge. Blade c3c9d1 / 8d939c, blood 5a1818, grip tooth efe6cc, binding 9a5a4a.
// - pilgrimsStaff (palmer): a tall plain staff, a gourd bottle tied below the top with a red cord, a scallop shell
//   hung under it, an iron foot. Wood 8a6a42, gourd c89a4a, cord 9a2a2a, shell f0e4cc.
// - watchGlaive (watch): a long ash pole, a broad single-edged glaive blade with a back spike, a teal tassel and brass
//   collar where blade meets pole. Steel b4bac2 / d2d6dc, teal 2f9c9a, brass d4b060, pole 7a5a3a.
// - courtSword (velvet): a slim sword with a swept gold hilt (a ring guard and curling quillons), a pearl pommel, a
//   burgundy grip. Blade d2d6dc, gold d4b060, pearl f6f2ea, grip 6e1a2a.
// - blackbannerFalchion (blackbanner): a short heavy falchion, the blade widening to a clipped point, blackened all but
//   the edge, a plain iron cross and a white cloth knotted on the grip. Iron 3e4046 / 5a5e66, edge c3c9d1, band e8e2d4.

import type { MAIN_HAND_ITEMS } from '../../../../../model/human/items/held';
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
  // A felling axe: a long haft, a narrow head set high, its edge bright; a broad axe: a wide, deep bit, bright all down its edge.
  fellingAxe: hafted(14, 5, 3, (y, z) => (z >= 10 ? (y === 1 ? c.edge : y === 0 || y === 2 ? c.steel : 0) : 0)),
  broadAxe: hafted(13, 7, 3, (y, z) => (z >= 8 ? (y === 0 ? c.edge : y <= 4 ? c.steel : y === 5 ? c.dark : 0) : 0)),
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
  // An inn's bouncer's: a straight hardwood cudgel bound with two iron bands
  // and capped with iron (to settle a quarrel, not to kill).
  bandedCudgel: cudgel((x, y, z) => {
    const cross = x === 1 || y === 1;
    if (!cross) return 0;
    if (z === 8 || z === 10) return c.dark; // the bands
    if (z === 11) return x === 1 && y === 1 ? c.edge : 0; // the cap
    return x === 1 && y === 1 ? c.wood : c.woodDark;
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
  // STAND-IN: long black-wrapped haft, broad bearded straight-edged headsman's bit, black iron, bright edge, a stain
  headsmansAxe: hafted(13, 7, 3, (y, z) => (z >= 8 ? (y === 0 ? c.edge : y <= 4 ? c.dark : y === 5 ? c.steel : 0) : 0)),
  // STAND-IN: broad old sword pitted with rust, notched edge, verdigris bronze guard, grave-gold pommel
  barrowBlade: sword(10, { pommel: c.brass, grip: c.grip, guard: c.dark, guardTips: c.dark, blade: c.edge, tip: c.dark }),
  // STAND-IN: short curved skinning knife, wide-bellied blade, bone grip bound in raw hide
  flensingKnife: held(() => {
    const grid = createGrid([3, 1, 7]);
    fillBox(grid, 1, 0, 0, 1, 0, 2, c.woodLight);
    fillBox(grid, 1, 0, 3, 1, 0, 6, (_x, _y, z) => (z === 6 ? c.edge : c.steel));
    return grid;
  }, [1.5, 0.25, 0.5]),
  // STAND-IN: tall plain staff, a gourd tied below the top with red cord, a scallop shell hung under it, iron foot
  pilgrimsStaff: pole(24, (z) => (z === 0 ? c.dark : z >= 19 && z <= 20 ? c.woodLight : z >= 10 && z <= 13 ? c.grip : 0), 11.5),
  // STAND-IN: long ash pole, broad glaive blade with a back spike, teal tassel and brass collar
  watchGlaive: pole(26, (z) => (z >= 22 ? (z === 25 ? c.edge : c.steel) : z === 21 ? c.brass : 0), 6.5),
  // STAND-IN: slim sword, swept gold hilt with ring guard and curling quillons, pearl pommel, burgundy grip
  courtSword: sword(12, { pommel: c.steel, grip: c.grip, guard: c.brass, guardTips: c.brass, blade: c.steel, tip: c.edge }),
  // STAND-IN: short heavy falchion widening to a clipped point, blackened but the edge, white cloth on the grip
  blackbannerFalchion: sword(8, { pommel: c.dark, grip: c.grip, guard: c.dark, guardTips: c.dark, blade: c.dark, tip: c.edge }),
};
