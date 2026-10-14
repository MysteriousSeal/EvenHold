// A cook's meals in voxels (loot/meals.ts), grid-aligned only, each telling its kind by its silhouette at a glance:
// roasts on a spit or a stick, or seared on a board; fish browned on a plank, crusted in salt, or on a spit; stews
// in a wooden bowl; pies round and crimped (one with its fish looking out); a honey cake, a slice gone; and feasts
// heaped on a long board. Every palette a ramp of a few tones, the browns warm (fire-cooked), the char near black.

import type { MealId } from '../../../model/loot/meals';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';
import { disc } from './provisionVoxels';

// A browned lump `w`×`h`×`d` at (x0, y0, z0), its corners cut round: its crust 1, its underside 2, a char mark 3 now and
// then on top (by `charred`).
function lump(g: VoxelGrid, x0: number, y0: number, z0: number, w: number, h: number, d: number, charred = (_x: number, _z: number) => false, [crust, under, char] = [1, 2, 3]): void {
  fillBox(g, x0, y0, z0, x0 + w - 1, y0 + h - 1, z0 + d - 1, (x, y, z) => {
    const edgeX = x === x0 || x === x0 + w - 1;
    const edgeZ = z === z0 || z === z0 + d - 1;
    if (edgeX && edgeZ && (y === y0 + h - 1 || y === y0)) return 0; // (round: its corners off, top and bottom)
    return y === y0 + h - 1 && charred(x, z) ? char : y === y0 ? under : crust;
  });
}

// A wooden bowl of stew: its foot, its belly, its rim, the stew in it (broth 3, chunks 4 and 5, where `chunk` says).
const bowl = (palette: number[], chunk: (x: number, z: number) => number): LootModel =>
  model(palette, [5, 3, 5], (g) => {
    disc(g, 1, 0, 1, 3, () => 2); // its foot
    disc(g, 0, 1, 0, 5, () => 1); // its belly
    disc(g, 0, 2, 0, 5, (x, z) => (x === 0 || z === 0 || x === 4 || z === 4 ? 1 : chunk(x, z) || 3)); // its rim round the stew
  });

// A fish lying on its side along x (as caught: ingredientVoxels.ts), cooked: its back 1, its flank 2, its belly 3,
// its fins and tail 4, an eye 5; `char` lines across its flank 6.
function cookedFish(g: VoxelGrid, x0: number, y0: number, z0: number, long: number): void {
  const tail = x0 + long - 1;
  fillBox(g, x0 + 1, y0, z0 + 1, tail - 2, y0 + 2, z0 + 1, (x, y) => (y === y0 + 2 ? 1 : y === y0 + 1 ? ((x - x0) % 2 === 0 ? 6 : 2) : 3));
  fillBox(g, x0 + 2, y0 + 1, z0, tail - 3, y0 + 1, z0 + 2, (x) => ((x - x0) % 2 === 0 ? 6 : 2)); // fuller amidships, the grill's lines across it
  setColor(g, x0, y0 + 1, z0 + 1, 2); // its snout
  setColor(g, x0 + 1, y0 + 1, z0, 5); // its eye
  setColor(g, x0 + 1, y0 + 1, z0 + 2, 5);
  setColor(g, tail - 1, y0 + 1, z0 + 1, 4);
  fillBox(g, tail, y0, z0 + 1, tail, y0 + 2, z0 + 1, (_x, y) => (y === y0 + 1 ? 0 : 4)); // the tail, forked
}

// A long board, `w` along x and `d` deep: the plank 1 (with a darker grain 2 along it).
const board = (g: VoxelGrid, w: number, d: number, plank = 1, grain = 2) => fillBox(g, 0, 0, 0, w - 1, 0, d - 1, (x, _y, z) => (z % 2 === 1 && x % 3 === 0 ? grain : plank));

export const MEAL_MODELS: Record<MealId, LootModel> = {
  // Roasted small fry: three little fish strung by their heads on a green stick, browned, tails down.
  roastedFry: model([0x8a6a3a, 0xc8a060, 0xe8d0a0, 0x6a4a2a, 0x1a1a1a, 0x5a7a2a], [7, 4, 3], (g) => {
    fillBox(g, 0, 3, 1, 6, 3, 1, 6); // the stick
    for (const x of [1, 3, 5]) {
      fillBox(g, x, 1, 1, x, 2, 1, (_x, y) => (y === 2 ? 1 : 2)); // a fish, its head to the stick
      setColor(g, x, 2, 0, 5); // its eye
      setColor(g, x, 0, 0, 4); // its tail, forked
      setColor(g, x, 0, 2, 4);
    }
  }),
  // Roast boar: a round haunch, crackling brown, a spit run through it and out both ends.
  roastBoar: model([0x9a5a2a, 0x6a3a1a, 0x4a2412, 0xc89058, 0x8a8a90], [8, 4, 5], (g) => {
    lump(g, 1, 0, 0, 6, 4, 5, (x, z) => (x + z) % 3 === 0);
    fillBox(g, 2, 3, 1, 5, 3, 3, (x, _y, z) => ((x + z) % 3 === 0 ? 3 : (x + z) % 3 === 1 ? 4 : 1)); // its crackling, catching the light
    fillBox(g, 0, 2, 2, 7, 2, 2, 5); // the spit
  }),
  // A wolf skewer: three dark chunks on a long stick, its point out, a sliver of onion between.
  wolfSkewer: model([0x7a3a22, 0x5a2614, 0x2a1408, 0xe8e0c0, 0xa07848], [9, 3, 3], (g) => {
    fillBox(g, 0, 1, 1, 8, 1, 1, 5); // the stick
    for (const x of [0, 3, 6]) lump(g, x, 0, 0, 2, 3, 3, (cx, cz) => (cx + cz) % 2 === 0);
    setColor(g, 2, 1, 0, 4); // the onion, a pale sliver
    setColor(g, 5, 1, 2, 4);
  }),
  // Seared lynx: a lean cut laid on a little board, the grill's dark lines across it.
  searedLynx: model([0xa87a4a, 0x8a6038, 0xa0482e, 0x3a1a10, 0xd88a6a], [6, 3, 4], (g) => {
    board(g, 6, 4);
    fillBox(g, 1, 1, 1, 4, 1, 2, (x) => (x % 2 === 0 ? 4 : 3)); // the cut, seared in lines
    fillBox(g, 2, 2, 1, 3, 2, 2, (x, _y, z) => (x === 2 && z === 1 ? 5 : 3)); // its top, a pink glint where it's cut
  }),
  // Bear steak: a thick slab charred in a cross-hatch, its rim of fat browned gold.
  bearSteak: model([0x7a3018, 0x5a2010, 0x2a120a, 0xe8c070], [6, 2, 5], (g) => {
    lump(g, 0, 0, 0, 6, 2, 5, (x, z) => (x + z) % 2 === 0);
    fillBox(g, 5, 1, 1, 5, 1, 3, 4); // the fat along one edge
  }),
  // Grilled trout: a trout split and browned, lying on a plank.
  grilledTrout: model([0x7a5a2a, 0xc88a5a, 0xf0d8b0, 0x5a4020, 0x1a1a1a, 0x3a2412, 0xa87a4a, 0x8a6038], [7, 4, 4], (g) => {
    fillBox(g, 0, 0, 0, 6, 0, 3, (x, _y, z) => (z === 2 && x % 3 === 0 ? 8 : 7)); // the plank
    cookedFish(g, 0, 1, 0, 7);
  }),
  // Salt-baked perch: a fish-shaped crust of white salt, cracked open along its back to the pink flesh, its tail out.
  saltedPerch: model([0xf0ece4, 0xd8d0c4, 0xe89a7a, 0xc84a2a, 0xb8b0a4], [7, 3, 4], (g) => {
    fillBox(g, 0, 0, 0, 5, 1, 3, (x, y, z) => ((x === 0 || x === 5) && (z === 0 || z === 3) ? 0 : y === 0 ? 2 : (x + z) % 4 === 0 ? 5 : 1)); // the crust
    fillBox(g, 1, 2, 1, 4, 2, 2, (x, _y, z) => (z === 1 && x > 1 ? 3 : 1)); // its top, cracked open, the flesh showing
    fillBox(g, 6, 0, 1, 6, 1, 2, 4); // the tail out of the crust
  }),
  // Honey-glazed bear: a glossy joint on a pale plate, honey pooled round it and running down.
  honeyBear: model([0xe8e0d0, 0xc8bca8, 0xa8541e, 0xd88a2a, 0xffc850, 0x6a2a10], [6, 4, 6], (g) => {
    disc(g, 0, 0, 0, 6, (x, z) => (x === 0 || z === 0 || x === 5 || z === 5 ? 2 : (x + z) % 3 === 0 ? 5 : 1)); // the plate, honey on it
    lump(g, 1, 1, 1, 4, 2, 4, (x, z) => (x + z) % 2 === 0, [3, 6, 4]);
    fillBox(g, 2, 3, 2, 3, 3, 3, (x, _y, z) => (x === 2 && z === 2 ? 5 : 4)); // its glazed top, a glint
  }),
  // Roast pike: a long fish browned on a spit run through it, nose to tail.
  roastPike: model([0x6a5a2a, 0xa88a4a, 0xe8d8b0, 0x4a3a1a, 0x1a1a1a, 0x3a2a12, 0x8a8a90], [11, 3, 3], (g) => {
    cookedFish(g, 1, 0, 0, 9);
    setColor(g, 0, 1, 1, 7); // the spit, out at the nose
    setColor(g, 10, 1, 1, 7); // and past the tail
  }),
  // Hunter's pie: a deep round pie, a lattice of pastry over the dark meat.
  huntersPie: model([0xc88a48, 0x9a6230, 0xe8b070, 0x5a2414], [6, 3, 6], (g) => {
    disc(g, 0, 0, 0, 6, () => 2);
    disc(g, 0, 1, 0, 6, (x, z) => (x === 0 || z === 0 || x === 5 || z === 5 ? ((x + z) % 2 === 0 ? 2 : 1) : 4)); // the crimped rim round the filling
    disc(g, 0, 2, 0, 6, (x, z) => (x === 0 || z === 0 || x === 5 || z === 5 ? 0 : x % 2 === 1 || z % 2 === 1 ? 3 : 0)); // the lattice
  }),
  // Pike pie: a long oval pie, the pike's head looking out of the crust at one end and its tail at the other.
  pikePie: model([0xd09a50, 0xa87038, 0xf0c078, 0x4a6a3a, 0x1a1a1a, 0x7a9a4a], [9, 3, 5], (g) => {
    fillBox(g, 1, 0, 0, 6, 1, 4, (x, y, z) => ((x === 1 || x === 6) && (z === 0 || z === 4) ? 0 : y === 0 ? 2 : (x + z) % 2 === 0 ? 3 : 1)); // the pie
    fillBox(g, 0, 1, 2, 0, 2, 2, (_x, y) => (y === 2 ? 4 : 6)); // the head looking out
    setColor(g, 0, 2, 1, 5); // its eye
    fillBox(g, 7, 1, 2, 8, 2, 2, (x, y) => (x === 8 && y === 1 ? 0 : 4)); // its tail, the other end
    setColor(g, 3, 2, 2, 1); // a vent in the crust
  }),
  // Honey cake: a round golden cake, honey glazed over its top and running down, a slice cut out of it.
  honeyCake: model([0xd8a050, 0xa87030, 0xffc850, 0xe89a2a], [5, 3, 5], (g) => {
    disc(g, 0, 0, 0, 5, () => 2);
    disc(g, 0, 1, 0, 5, (x, z) => (z === 0 && x % 2 === 1 ? 4 : 1)); // its side, honey run down it
    disc(g, 0, 2, 0, 5, (x, z) => ((x + z) % 3 === 0 ? 4 : 3)); // the glazed top
    fillBox(g, 3, 0, 3, 4, 2, 4, 0); // a slice gone
  }),
  // Hunter's feast: a long board heaped with a roast leg, a boar's haunch and a skewer.
  huntersFeast: model([0x9a6a3a, 0x7a5028, 0x8a4a22, 0x6a3418, 0xf0e6cc, 0x3a1a0a], [9, 4, 6], (g) => {
    board(g, 9, 6);
    lump(g, 0, 1, 0, 4, 3, 4, (x, z) => (x + z) % 3 === 0, [3, 4, 6]); // the haunch
    fillBox(g, 5, 1, 0, 7, 2, 2, (x, y) => (y === 2 && x === 6 ? 6 : 3)); // the leg
    setColor(g, 8, 1, 1, 5); // its bone
    fillBox(g, 1, 1, 5, 8, 1, 5, 2); // the skewer's stick
    for (const x of [3, 6]) fillBox(g, x, 1, 4, x + 1, 2, 5, (cx, y) => (y === 2 && cx === x ? 6 : 4)); // its chunks
  }),
  // River feast: a long platter, a whole trout browned along it, small fry beside, and a loaf to mop up.
  riverFeast: model([0x6a5a2a, 0xc8a060, 0xf0e4c8, 0x5a4020, 0x1a1a1a, 0x3a2a12, 0xd8d0c0, 0xb0a890, 0xc98a3c], [9, 4, 6], (g) => {
    fillBox(g, 0, 0, 0, 8, 0, 5, (x, _y, z) => (x === 0 || z === 0 || x === 8 || z === 5 ? 8 : 7)); // the platter
    cookedFish(g, 1, 1, 0, 7);
    fillBox(g, 1, 1, 4, 3, 2, 5, (x, y) => (y === 2 && x === 2 ? 3 : 9)); // the loaf
    for (const x of [5, 7]) fillBox(g, x, 1, 4, x, 1, 5, (_x, _y, z) => (z === 4 ? 2 : 4)); // small fry
  }),
  // Lord's feast: a dark board edged in gold, a whole bear roast glazed in honey dome-high, a loaf beside it.
  lordsFeast: model([0x5a3a22, 0x3a2414, 0xa8541e, 0x6a2a10, 0xffc850, 0xd4a030, 0xc98a3c, 0xf2dcae], [9, 5, 6], (g) => {
    fillBox(g, 0, 0, 0, 8, 0, 5, (x, _y, z) => (x === 0 || z === 0 || x === 8 || z === 5 ? 6 : 1)); // the board, its gold rim
    lump(g, 1, 1, 1, 5, 3, 4, (x, z) => (x + z) % 3 === 0, [3, 4, 5]); // the roast, glazed
    fillBox(g, 2, 4, 2, 4, 4, 3, (x) => (x === 3 ? 5 : 3)); // its dome
    fillBox(g, 6, 1, 3, 7, 2, 4, (_x, y) => (y === 2 ? 8 : 7)); // the loaf
  }),
  // Boar stew: brown broth, chunks of meat and carrot.
  boarStew: bowl([0x9a6a3a, 0x6a4628, 0x7a4a24, 0x5a2a14, 0xe0782a], (x, z) => ((x + z) % 3 === 0 ? 4 : x === 2 && z === 1 ? 5 : 0)),
  // Fisherman's stew: a pale golden broth, white flakes of fish and green herbs.
  fishStew: bowl([0x9a6a3a, 0x6a4628, 0xd8b868, 0xf4ece0, 0x5a9a3a], (x, z) => ((x + z) % 3 === 0 ? 4 : x === 3 && z === 2 ? 5 : 0)),
};
