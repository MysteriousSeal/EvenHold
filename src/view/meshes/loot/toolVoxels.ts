// Tools' voxels (model/loot/tools.ts), as bag icons and on the ground: a bedroll, a blanket rolled tight and tied
// with two leather straps, its inner side a paler linen showing at the ends; a fishing rod, a long thin shaft of
// pale ash with a cork grip and a dark butt cap, a brass reel slung under it, red whipping at the tip; pickaxes, a
// long haft and a head across its end, pointed both ways (the smith's copper, a forged iron one's dark grey, steel's
// bright, star-iron's blue-black and glittering).
import type { ToolId } from '../../../model/loot/tools';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

// A pickaxe lying flat: its haft along x (wood 1, a leather grip 2 at the butt), a band 5 where the head's set on, the
// head across z at the far end (iron 3, its points 4, thinning to them), `glint` voxels of 4 along it, if any.
const pickaxe = (palette: number[], glint = false): LootModel =>
  model(palette, [13, 2, 9], (g) => {
    fillBox(g, 0, 0, 4, 10, 0, 4, (x) => (x <= 2 ? 2 : 1)); // the haft, its grip
    setColor(g, 10, 1, 4, 5); // the band
    fillBox(g, 11, 0, 1, 12, 1, 7, (_x, y, z) => (z === 4 ? 3 : z === 1 || z === 7 ? (y === 0 ? 4 : 0) : y === 1 && (z === 2 || z === 6) ? 0 : 3)); // the head, thinning to its points
    fillBox(g, 11, 0, 0, 11, 0, 0, 4); // its points' tips
    fillBox(g, 11, 0, 8, 11, 0, 8, 4);
    if (glint) for (const z of [2, 5]) setColor(g, 12, 1, z, 4);
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
  copperPick: pickaxe([0xa8845a, 0x5a3a22, 0xb8733a, 0xe0a070, 0x4a4a50]),
  ironPick: pickaxe([0x8a5a35, 0x3e2a1a, 0x4a4a54, 0xb8bcc4, 0xc89a3a]),
  steelPick: pickaxe([0x7a5034, 0x2e2018, 0x9aa0a8, 0xf0f2f4, 0x3a3a40]),
  starIronPick: pickaxe([0x6e2a1a, 0x2a1a12, 0x2a3048, 0xa8d0f0, 0xc8d0dc], true),
};
