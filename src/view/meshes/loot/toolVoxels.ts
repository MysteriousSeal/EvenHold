// Tools' voxels (model/loot/tools.ts), as bag icons and on the ground: a bedroll, a blanket rolled tight and tied
// with two leather straps, its inner side a paler linen showing at the ends; a fishing rod, a long thin shaft of
// pale ash with a cork grip and a dark butt cap, a brass reel slung under it, red whipping at the tip; a miner's
// picks, an ash haft with the head across its end, curved to two points, in the metal of its tier.
import type { ToolId } from '../../../model/loot/tools';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

// A pickaxe: its haft of ash 1 along x, a darker grip 2 at its butt; across its far end the head, in its metal (its
// shadow 3, body 4, edge 5), dipping to a point either way.
const pick = (metal: [number, number, number]): LootModel =>
  model([0xb08a5a, 0x6a4a2a, ...metal], [9, 3, 7], (g) => {
    fillBox(g, 0, 1, 3, 7, 1, 3, 1); // the haft
    fillBox(g, 0, 1, 3, 1, 1, 3, 2); // its grip
    fillBox(g, 7, 1, 1, 8, 2, 5, (x, y, z) => (y === 2 && (z === 1 || z === 5) ? 0 : x === 7 ? 3 : 4)); // the head across it
    for (const z of [0, 6]) setColor(g, 8, 1, z, 5); // its two points, dipping
  });

export const TOOL_MODELS: Record<ToolId, LootModel> = {
  // Wool 1 (dark green), its fold's shadow 2, linen within 3, the straps 4.
  bedroll: model([0x4e6a42, 0x3a5232, 0xe6dcc0, 0x7a4a2a], [8, 3, 4], (g) => {
    fillBox(g, 0, 0, 0, 7, 2, 3, (_x, y, z) => (y === 1 && (z === 0 || z === 3) ? 1 : y === 2 && z >= 1 && z <= 2 ? 1 : y === 0 && z >= 1 && z <= 2 ? 1 : y === 1 && z >= 1 && z <= 2 ? 1 : 0)); // the roll, its corners cut round
    for (const x of [0, 7]) for (const z of [1, 2]) setColor(g, x, 1, z, 3); // the linen at the ends, within
    for (const x of [2, 5]) fillBox(g, x, 0, 0, x, 2, 3, (_x, y, z) => (y === 2 && z >= 1 && z <= 2) || (y === 1 && (z === 0 || z === 3)) ? 4 : 0); // the straps round it
    setColor(g, 4, 2, 1, 2);
    setColor(g, 3, 2, 2, 2);
  }),
  // Ash 1, the butt cap 2, cork 3, brass 4, the red whipping 5: a single voxel thick but at the grip (its silhouette
  // is the thing: long and thin), the reel under it before the grip.
  fishingRod: model([0xb08a5a, 0x4a2e1a, 0xc8a070, 0xc89a3a, 0xa83a2a], [16, 3, 3], (g) => {
    fillBox(g, 0, 1, 0, 1, 2, 1, 2); // the butt cap
    fillBox(g, 2, 1, 0, 4, 2, 1, 3); // the cork grip, two voxels thick
    fillBox(g, 5, 1, 1, 15, 1, 1, 1); // the shaft, thinning to one
    fillBox(g, 5, 0, 1, 6, 0, 2, 4); // the reel, slung under it
    setColor(g, 6, 0, 0, 4);
    setColor(g, 10, 2, 1, 4); // a line guide, a ring along the shaft
    fillBox(g, 14, 1, 1, 15, 1, 1, 5); // red whipping at the tip
  }),
  copperPick: pick([0x8a4a22, 0xc8703a, 0xf0a070]),
  ironPick: pick([0x4a4e56, 0x6e747e, 0xa8b0ba]),
  steelPick: pick([0x56667a, 0x8a9cae, 0xdce6f0]),
  starIronPick: pick([0x1e2440, 0x3a4878, 0x9ab8ff]),
};
