// How everything held in the main (right) hand looks: weapons, each lying
// along +Z from the end in the hand. Grips follow the rules in itemModel.ts;
// blades have their crossguard at z 5 with the grip at 2.5, so the guard
// sits half a voxel clear of a glove and of the armor at the hips. Long
// shafts (a spear, a staff, a glaive) are held low, near their foot, as a
// blade is by its grip, a voxel outside the hand: only a hand's breadth runs
// back past the fist, clear of the legs as they stride.
//
// The sets' weapons, each in its set's colours (setPalettes.ts), drawn from these notes:
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
import { SET_PALETTES } from '../setPalettes';
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

// A long pole held low, a voxel outside the hand (`grip`: how far up it from its foot).
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

// A set's weapon in its own colours (`colors`, from its set's: setPalettes.ts).
function own<T extends Record<string, number>>(colors: T, grip: [number, number, number], build: (c: Record<keyof T, number>) => ReturnType<typeof createGrid>): ItemModel {
  const { palette, c } = namedPalette(colors);
  return { palette, held: { build: () => build(c), grip } };
}
const { headsman, barrow, flayer, palmer, watch, velvet, blackbanner } = SET_PALETTES;

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
  spear: pole(26, (z) => (z >= 23 ? (z === 25 ? c.edge : c.steel) : z === 22 ? c.dark : 0), 2.5),
  // A long staff shod with iron at both ends, wrapped where it's held, low.
  quarterstaff: pole(24, (z) => (z === 0 || z === 23 ? c.dark : z >= 1 && z <= 4 ? c.grip : 0), 2.5),
  headsmansAxe: own({ iron: headsman.iron, ironLight: headsman.ironLight, edge: 0xc3c9d1, haft: headsman.leather, wrap: headsman.black, wrapLight: headsman.blackLight, stain: headsman.stain }, [0.5, 4.25, 1.5], (c) => {
    // A headsman's: a long haft wound in black leather for two hands, a broad bit of black iron hung below it, its
    // straight bright edge bearded back toward the hands, a dark stain run down it.
    const grid = createGrid([1, 6, 14]);
    const head = (y: number, z: number) => {
      if (y === 0) return z >= 7 ? c.edge : 0;
      if (y <= 3) return z >= 6 + y && z <= 12 + (y === 1 ? 1 : 0) ? (z === 11 && y >= 2 ? c.stain : y === 1 ? c.ironLight : c.iron) : 0;
      if (y === 4) return z >= 10 ? c.iron : 0; // the eye round the haft, and its end
      return z >= 10 && z <= 12 ? c.ironLight : 0;
    };
    fillBox(grid, 0, 0, 0, 0, 5, 13, (_x, y, z) => head(y, z) || (y === 4 ? (z <= 5 ? (mod(z, 2) ? c.wrap : c.wrapLight) : c.haft) : 0));
    return grid;
  }),
  barrowBlade: own({ rust: barrow.rust, rustDark: barrow.rustDark, pitted: barrow.pitted, steel: 0xc3c9d1, verdigrisLight: barrow.verdigrisLight, gold: barrow.graveGold, mould: barrow.mould }, [1.5, 0.25, 2.5], (c) => {
    // Out of a barrow: a broad old sword, two patches of rust down its pitted middle, its edges still bright but
    // notched, its point broken off; a grave-gold guard and pommel gone green at the ends, the grip's leather mould.
    const grid = createGrid([3, 1, 18]);
    setColor(grid, 1, 0, 0, c.gold);
    fillBox(grid, 1, 0, 1, 1, 0, 4, c.mould);
    fillBox(grid, 0, 0, 5, 2, 0, 5, (x) => (x === 1 ? c.gold : c.verdigrisLight)); // (grave-gold gone green at its ends)
    fillBox(grid, 0, 0, 6, 2, 0, 17, (x, _y, z) => {
      if (x !== 1 && (z > 12 || (x === 0 && z === 8) || (x === 2 && z === 10))) return 0; // (its edges notched, narrowing to the point)
      if (x !== 1) return c.steel; // (its edges, still bright)
      return z === 7 || z === 10 ? c.rustDark : z === 8 || z === 11 ? c.rust : c.pitted; // (two patches of rust down its middle)
    });
    return grid;
  }),
  flensingKnife: own({ blade: 0xc3c9d1, bladeDark: 0x8d939c, blood: flayer.blood, tooth: flayer.tooth, raw: flayer.raw }, [0.5, 1.25, 0.5], (c) => {
    // A skinner's: a bone grip bound in raw hide, a short blade bellied below and turned up at its point, dark with
    // blood along the edge.
    const grid = createGrid([1, 3, 8]);
    fillBox(grid, 0, 1, 0, 0, 1, 2, (_x, _y, z) => (z === 1 ? c.raw : c.tooth));
    fillBox(grid, 0, 1, 3, 0, 1, 7, (_x, _y, z) => (z === 3 ? c.bladeDark : c.blade));
    fillBox(grid, 0, 0, 4, 0, 0, 6, (_x, _y, z) => (z === 4 ? c.bladeDark : c.blood));
    setColor(grid, 0, 2, 7, c.bladeDark);
    return grid;
  }),
  pilgrimsStaff: own({ wood: 0x8a6a42, foot: palmer.leather, cord: palmer.cross, gourd: palmer.gourd, gourdShade: 0xa87a36, shell: palmer.shell, shellShade: palmer.shellShade }, [1.5, 3.25, 2.5], (c) => {
    // A palmer's: a tall plain staff, shod at its foot, a gourd bottle tied on below its top with red cord, a
    // scallop shell hung beneath it. (Held low, a voxel outside the hand, as the quarterstaff.)
    const grid = createGrid([1, 4, 24]);
    fillBox(grid, 0, 3, 0, 0, 3, 23, (_x, _y, z) => (z === 0 ? c.foot : z === 20 || z === 16 ? c.cord : c.wood));
    setColor(grid, 0, 2, 20, c.gourd); // its neck
    fillBox(grid, 0, 0, 19, 0, 1, 21, (_x, y, z) => (y === 1 && z !== 20 ? c.gourdShade : c.gourd));
    setColor(grid, 0, 2, 16, c.shellShade);
    fillBox(grid, 0, 0, 15, 0, 1, 17, (_x, y, z) => (y === 1 ? (z === 16 ? c.shellShade : c.shell) : z === 16 ? c.shell : 0));
    return grid;
  }),
  watchGlaive: own({ pole: 0x7a5a3a, steel: watch.steel, steelLight: watch.steelLight, steelDark: watch.steelDark, brass: watch.brass, teal: watch.teal, tealDark: watch.tealDark }, [1.5, 2.25, 2.5], (c) => {
    // The watch's: an ash pole, a brass collar where it meets a broad single-edged blade bellied below, a spike
    // off its back, a teal tassel hung from the collar.
    const grid = createGrid([1, 5, 27]);
    fillBox(grid, 0, 2, 0, 0, 2, 18, (_x, _y, z) => (z === 0 ? c.steelDark : c.pole));
    fillBox(grid, 0, 1, 19, 0, 3, 19, c.brass);
    setColor(grid, 0, 1, 18, c.teal);
    setColor(grid, 0, 0, 18, c.tealDark);
    fillBox(grid, 0, 2, 20, 0, 2, 26, (_x, _y, z) => (z === 26 ? c.steelLight : c.steel));
    fillBox(grid, 0, 1, 21, 0, 1, 25, c.steel);
    fillBox(grid, 0, 0, 22, 0, 0, 24, c.steelLight);
    setColor(grid, 0, 3, 22, c.steelDark);
    setColor(grid, 0, 4, 23, c.steelDark);
    return grid;
  }),
  courtSword: own({ blade: 0xd2d6dc, tip: 0xa8aeb6, gold: velvet.gold, pearl: velvet.pearl, grip: velvet.velvet }, [1.5, 0.25, 2.5], (c) => {
    // A courtier's: a slim blade, a gold hilt with its quillons swept forward, a burgundy grip, a pearl pommel.
    const grid = createGrid([3, 1, 18]);
    setColor(grid, 1, 0, 0, c.pearl);
    fillBox(grid, 1, 0, 1, 1, 0, 4, c.grip);
    fillBox(grid, 0, 0, 5, 2, 0, 6, (x, _y, z) => (z === 5 || x !== 1 ? c.gold : 0)); // (the quillons swept forward)
    fillBox(grid, 1, 0, 6, 1, 0, 17, (_x, _y, z) => (z === 17 ? c.tip : c.blade));
    return grid;
  }),
  blackbannerFalchion: own({ iron: blackbanner.iron, ironLight: blackbanner.ironLight, edge: 0xc3c9d1, grip: blackbanner.leather, band: blackbanner.band }, [1.5, 0.25, 2.5], (c) => {
    // The blackbanner's: a short heavy blade, blackened, widening on its edge side to a clipped point, nothing bright
    // but that edge; a plain iron cross, a white cloth knotted on the grip's end.
    const grid = createGrid([3, 1, 14]);
    setColor(grid, 1, 0, 0, c.band);
    fillBox(grid, 1, 0, 1, 1, 0, 4, c.grip);
    fillBox(grid, 0, 0, 5, 2, 0, 5, c.ironLight);
    fillBox(grid, 1, 0, 6, 1, 0, 12, c.iron);
    fillBox(grid, 2, 0, 9, 2, 0, 13, c.edge);
    return grid;
  }),
};
