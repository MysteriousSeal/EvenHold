// What a bandit stronghold's people carry in their hands (who carries what: strongholdOutfits.ts): each a small
// voxel model lying along +Z from the end in the hand, in the held things' own voxels (bodyVoxels.ts
// HELD_VOXEL_SIZE), gripped as the items are (itemModel.ts: a grip's height ending in .25, its depth in .5, an odd
// width centred on the hand: so no face of it ever lies on a plane the body's or its shells' do). Never items: looks
// only, as their costumes are. Palette first, two between them: iron and wood (a blade's bright edge, a haft's
// wrapped grip, brass, old blood); and fire (fired clay, a wick alight, slow match and its ember).
// - a maul: a long haft, a block of iron across its end, banded: two hands' work;
// - a crossbow: a stock, a steel prod across its end, strung, a bolt laid in it, a stirrup;
// - a fire pot: a round clay pot, stoppered, its wick alight;
// - a bone saw: a bow frame, its blade toothed and bloody;
// - a dirk: a short blade, a small guard;
// - a whip: a short stock, the lash falling away from it to the ground, a cracker at its tip;
// - a linstock: a pole held at its middle, a forked iron head, slow match wound on it, its end alight;
// - a butcher's cleaver: a broad square blade, a hole in its corner, blood along its edge;
// - a hook on a chain (the off hand's): hung from the fist;
// - a sabre: a curved blade, a brass guard;
// - a great axe: a long haft, two crescent bits either side of its eye, a spike beyond them.
import type { VoxelGrid } from '../../../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../../../voxel/voxelShapes';
import { namedPalette } from '../armorShell';
import type { ItemModel } from '../itemModel';

const arms = namedPalette({ steel: 0xc8ced6, edge: 0xe6eaee, dark: 0x5e646c, brass: 0xd4b060, grip: 0x4a3222, wood: 0x7a5a3a, woodDark: 0x5e4630, blood: 0x9a1f1a, cord: 0xd9cfb6 });
const fire = namedPalette({ clay: 0xc4622e, clayDark: 0x94441e, stopper: 0x3a2a1e, wick: 0xffd060, cord: 0xb09468, ember: 0xff7a2a, wood: 0x7a5a3a, grip: 0x4a3222, iron: 0x5e646c });
const { c } = arms;

type Held = NonNullable<ItemModel['held']>;
const held = (palette: number[], size: [number, number, number], grip: [number, number, number], paint: (g: VoxelGrid) => void): ItemModel & { held: Held } => ({
  palette,
  held: {
    build: () => {
      const g = createGrid(size);
      paint(g);
      return g;
    },
    grip,
  },
});
// A haft along row `row`, `long` voxels, wrapped where it's held.
const haft = (g: VoxelGrid, x: number, row: number, long: number): void => fillBox(g, x, row, 0, x, row, long - 1, (_x, _y, z) => (z <= 3 ? c.grip : z % 6 === 5 ? c.woodDark : c.wood));

export const STRONGHOLD_HELD = {
  maul: held(arms.palette, [3, 5, 17], [1.5, 2.25, 1.5], (g) => {
    haft(g, 1, 2, 12);
    fillBox(g, 0, 0, 12, 2, 4, 16, (x, y, z) => (z === 12 || z === 16 ? (x === 1 && y >= 1 && y <= 3 ? c.steel : c.dark) : y === 0 || y === 4 ? c.steel : z === 14 ? c.brass : c.dark));
  }),
  crossbow: held(arms.palette, [9, 2, 11], [4.5, 0.25, 2.5], (g) => {
    fillBox(g, 4, 0, 0, 4, 0, 10, (_x, _y, z) => (z <= 2 ? c.grip : c.wood)); // the stock
    fillBox(g, 4, 1, 3, 4, 1, 9, (_x, _y, z) => (z === 9 ? c.steel : z >= 6 ? c.cord : c.woodDark)); // the bolt laid in it
    for (let x = 0; x <= 8; x++) setColor(g, x, 0, x === 0 || x === 8 ? 8 : 9, x === 4 ? c.dark : c.steel); // the prod, its ends bent back
    for (const [x, z] of [[1, 7], [2, 6], [3, 5], [5, 5], [6, 6], [7, 7]]) setColor(g, x, 0, z, c.cord); // the string, drawn
    for (const x of [3, 5]) setColor(g, x, 0, 10, c.dark); // the stirrup
  }),
  firePot: held(fire.palette, [3, 5, 3], [1.5, 0.25, 1.5], (g) => {
    fillBox(g, 0, 0, 0, 2, 2, 2, (x, y, z) => ((y === 0 || y === 2) && x !== 1 && z !== 1 ? 0 : y === 1 && (x + z) % 2 === 1 ? fire.c.clayDark : fire.c.clay));
    setColor(g, 1, 3, 1, fire.c.stopper);
    setColor(g, 1, 4, 1, fire.c.wick);
  }),
  boneSaw: held(arms.palette, [1, 4, 12], [0.5, 1.25, 1.5], (g) => {
    fillBox(g, 0, 1, 0, 0, 1, 2, c.grip);
    fillBox(g, 0, 0, 3, 0, 3, 3, c.wood); // the frame: its near post, its back, its far post
    fillBox(g, 0, 3, 4, 0, 3, 11, c.dark);
    fillBox(g, 0, 0, 11, 0, 2, 11, c.dark);
    fillBox(g, 0, 0, 4, 0, 0, 10, (_x, _y, z) => (z >= 6 && z <= 8 ? c.blood : z % 2 ? c.edge : c.steel)); // the blade
  }),
  dirk: held(arms.palette, [3, 1, 9], [1.5, 0.25, 0.5], (g) => {
    setColor(g, 1, 0, 0, c.brass);
    fillBox(g, 1, 0, 1, 1, 0, 2, c.grip);
    fillBox(g, 0, 0, 3, 2, 0, 3, c.dark);
    fillBox(g, 1, 0, 4, 1, 0, 8, (_x, _y, z) => (z === 8 ? c.edge : c.steel));
  }),
  whip: held(arms.palette, [1, 5, 17], [0.5, 4.25, 1.5], (g) => {
    fillBox(g, 0, 4, 0, 0, 4, 3, (_x, _y, z) => (z === 0 ? c.brass : c.grip));
    // The lash: out, and falling away a row at a time.
    for (const [row, from, to] of [[4, 4, 6], [3, 7, 9], [2, 10, 12], [1, 13, 14], [0, 15, 16]]) fillBox(g, 0, row, from, 0, row, to, (_x, _y, z) => (z === 16 ? c.cord : z % 3 === 0 ? c.woodDark : c.wood));
  }),
  linstock: held(fire.palette, [1, 3, 22], [1.5, 1.25, 7.5], (g) => {
    fillBox(g, 0, 1, 0, 0, 1, 18, (_x, _y, z) => (z >= 6 && z <= 9 ? fire.c.grip : z >= 15 ? fire.c.cord : fire.c.wood)); // (the match wound round its end)
    for (const row of [0, 2]) fillBox(g, 0, row, 18, 0, row, 21, fire.c.iron); // the fork
    setColor(g, 0, 1, 18, fire.c.iron);
    fillBox(g, 0, 1, 19, 0, 1, 21, (_x, _y, z) => (z === 21 ? fire.c.wick : z === 20 ? fire.c.ember : fire.c.cord)); // the match's end, alight
  }),
  cleaver: held(arms.palette, [1, 5, 9], [0.5, 3.25, 1.5], (g) => {
    fillBox(g, 0, 3, 0, 0, 3, 2, c.grip);
    fillBox(g, 0, 0, 3, 0, 4, 8, (_x, y, z) => (y === 4 && z === 8 ? 0 : y === 3 && z === 7 ? 0 : y === 0 ? (z >= 5 ? c.blood : c.edge) : y === 4 ? c.dark : c.steel)); // (a hole in its corner, to hang it by)
  }),
  hook: held(arms.palette, [1, 5, 3], [0.5, 4.25, 0.5], (g) => {
    fillBox(g, 0, 2, 0, 0, 4, 0, (_x, y) => (y % 2 ? c.steel : c.dark)); // the chain
    fillBox(g, 0, 0, 0, 0, 1, 0, c.steel); // the hook: down, forward, its point up
    fillBox(g, 0, 0, 1, 0, 0, 2, c.steel);
    setColor(g, 0, 1, 2, c.edge);
  }),
  sabre: held(arms.palette, [3, 3, 17], [1.5, 0.25, 2.5], (g) => {
    setColor(g, 1, 0, 0, c.brass);
    fillBox(g, 1, 0, 1, 1, 0, 4, c.grip);
    fillBox(g, 0, 0, 5, 2, 0, 5, c.brass);
    for (const [row, from, to] of [[0, 6, 11], [1, 11, 15], [2, 15, 16]]) fillBox(g, 1, row, from, 1, row, to, (_x, _y, z) => (z === 16 ? c.edge : c.steel)); // the blade, curving up to its point
  }),
  greatAxe: held(arms.palette, [1, 9, 20], [0.5, 4.25, 1.5], (g) => {
    haft(g, 0, 4, 19);
    for (let z = 12; z <= 17; z++) for (let y = 0; y <= 8; y++) {
      const out = Math.abs(y - 4);
      if (out === 0) setColor(g, 0, y, z, c.dark); // its eye, round the haft
      else if (z >= 13 && z <= 16 ? out <= 4 : out >= 3) setColor(g, 0, y, z, out === 4 ? c.edge : out === 1 ? c.dark : c.steel); // the bits, flaring to their horns
    }
    setColor(g, 0, 4, 19, c.steel); // the spike
  }),
} satisfies Record<string, ItemModel>;
export type StrongholdHeldId = keyof typeof STRONGHOLD_HELD;
