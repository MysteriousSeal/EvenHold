// Food and drink in voxels (provisions.ts), grid-aligned only: anything
// round is stepped, its corners cut. Each has a palette of its own (a ramp
// of three to five tones) and a silhouette that tells it apart at a glance:
// a long low loaf, a sloping wedge, a round apple, a meaty bulb on a bone, a
// flat pie, a tankard crowned with foam, a pot-bellied jug, a tall slim bottle.

import type { PROVISIONS } from '../../../model/loot/provisions';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

// A disc (a square with its corners cut) `size` across at height y, painted by `color`.
function disc(g: VoxelGrid, x0: number, y: number, z0: number, size: number, color: (x: number, z: number) => number): void {
  for (let x = 0; x < size; x++) {
    for (let z = 0; z < size; z++) {
      const corner = (x === 0 || x === size - 1) && (z === 0 || z === size - 1);
      if (!corner) setColor(g, x0 + x, y, z0 + z, color(x, z));
    }
  }
}

export const PROVISION_MODELS: Record<keyof typeof PROVISIONS, LootModel> = {
  // A long crusty loaf, rising to a lighter top scored across twice.
  bread: model([0xc98a3c, 0xa86a28, 0xe8b46a, 0xf2dcae], [6, 3, 4], (g) => {
    fillBox(g, 0, 0, 0, 5, 0, 3, 2);
    fillBox(g, 0, 1, 0, 5, 1, 3, 1);
    fillBox(g, 1, 2, 1, 4, 2, 2, (x) => (x === 2 || x === 4 ? 4 : 3));
  }),
  // A wedge of cheese, stepping down from its rind, with holes in its sides.
  cheese: model([0xf0c850, 0xc89a30, 0xfbe08a, 0x9a7420], [5, 4, 4], (g) => {
    for (let x = 0; x < 5; x++) {
      const h = Math.max(1, 4 - x);
      fillBox(g, x, 0, 0, x, h - 1, 3, (_x, y) => (x === 0 ? 2 : y === h - 1 ? 3 : 1));
    }
    for (const [x, y, z] of [[1, 1, 0], [2, 0, 3], [1, 2, 3]]) setColor(g, x, y, z, 4);
  }),
  // A red apple, stepped round, a stem and a leaf on top.
  apple: model([0xc8302a, 0x8e1e1a, 0xe86050, 0x5a3a20, 0x5a9a30], [4, 5, 4], (g) => {
    fillBox(g, 1, 0, 1, 2, 0, 2, 2);
    for (const y of [1, 2]) disc(g, 0, y, 0, 4, (x, z) => (x + z <= 1 ? 3 : x + z >= 5 ? 2 : 1));
    fillBox(g, 1, 3, 1, 2, 3, 2, 1);
    setColor(g, 1, 4, 1, 4); // stem
    setColor(g, 2, 4, 1, 5); // leaf
  }),
  // A roast leg: a browned, meaty bulb with a bone sticking out, knobbed at the end.
  roastLeg: model([0x8a4a22, 0x6a3418, 0xb06a38, 0xf0e6cc, 0xd6c79a], [7, 3, 4], (g) => {
    for (let y = 0; y < 3; y++) disc(g, 0, y, 0, 4, (x, z) => (y === 2 ? (x + z <= 2 ? 3 : 1) : y === 0 ? 2 : 1));
    fillBox(g, 4, 1, 1, 5, 1, 2, 4); // the bone
    fillBox(g, 6, 0, 1, 6, 2, 2, (_x, y) => (y === 2 ? 4 : 5)); // its knob
  }),
  // A round pie: a crimped rim, a golden top, dark filling showing at the vent.
  meatPie: model([0xd49a50, 0xa87038, 0xf0c078, 0x6a2a18], [6, 2, 6], (g) => {
    disc(g, 0, 0, 0, 6, () => 2);
    disc(g, 0, 1, 0, 6, (x, z) => (x === 0 || z === 0 || x === 5 || z === 5 ? ((x + z) % 2 === 0 ? 2 : 1) : 3));
    fillBox(g, 2, 1, 2, 3, 1, 3, (x, _y, z) => ((x + z) % 2 === 0 ? 4 : 1)); // the vent
  }),
  // A wooden tankard of ale, iron-hooped, crowned with foam spilling over its rim.
  ale: model([0x8a5a35, 0x5e3f28, 0x5a5e66, 0xf6efdc, 0xe0d4b4], [4, 6, 3], (g) => {
    fillBox(g, 0, 0, 0, 2, 4, 2, (x, y) => (y === 0 || y === 3 ? 3 : x === 0 ? 2 : 1));
    fillBox(g, 0, 5, 0, 2, 5, 2, 4); // the foam
    setColor(g, 1, 4, 2, 4); // spilling over at the front
    fillBox(g, 3, 1, 1, 3, 3, 1, 2); // the handle
  }),
  // A clay jug of mead: a round belly, a narrow neck stoppered with a cork, a handle.
  mead: model([0xb87a40, 0x8a5428, 0xd89a5a, 0xc8a070], [5, 7, 4], (g) => {
    fillBox(g, 1, 0, 1, 2, 0, 2, 2);
    for (const y of [1, 2, 3]) disc(g, 0, y, 0, 4, (x, z) => (x + z <= 1 ? 3 : x + z >= 5 ? 2 : 1));
    fillBox(g, 1, 4, 1, 2, 5, 2, (_x, y) => (y === 4 ? 2 : 1)); // the neck
    fillBox(g, 1, 6, 1, 2, 6, 2, 4); // the cork
    fillBox(g, 4, 2, 1, 4, 4, 1, 2); // the handle
  }),
  // A tall bottle of wine in dark green glass, a parchment label, sealed with red wax.
  wine: model([0x2e5a34, 0x1e3a22, 0x4a8a50, 0xe8dcc0, 0x9a2a24], [3, 8, 3], (g) => {
    fillBox(g, 0, 0, 0, 2, 4, 2, (x, y, z) => (y === 2 && z === 2 ? 4 : x === 0 && z === 2 ? 3 : x === 2 ? 2 : 1));
    fillBox(g, 1, 5, 1, 1, 6, 1, 1); // the neck
    setColor(g, 1, 7, 1, 5); // the wax seal
  }),
};

// A glass of wine in hand (a villager at the bar, or the barmaid bringing
// it): a clear foot and stem, the bowl dark with wine, a bright glint, a clear rim.
export const WINE_GLASS_MODEL: LootModel = model([0xa4d0c6, 0xd8f0ea, 0x6a1e2e, 0xa83a48], [3, 6, 3], (g) => {
  disc(g, 0, 0, 0, 3, () => 1); // the foot
  fillBox(g, 1, 1, 1, 1, 2, 1, 1); // the stem
  disc(g, 0, 3, 0, 3, () => 3); // the bowl
  disc(g, 0, 4, 0, 3, (x, z) => (x === 0 && z === 1 ? 4 : 3)); // its belly, a glint
  disc(g, 0, 5, 0, 3, (x, z) => (x === 1 && z === 1 ? 3 : 2)); // the rim, the wine's top in it
});
