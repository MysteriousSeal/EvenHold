// Tools' voxels (model/loot/tools.ts), as bag icons and on the ground: a bedroll, a blanket rolled tight and tied
// with two leather straps, its inner side a paler linen showing at the ends.
import type { ToolId } from '../../../model/loot/tools';
import { fillBox, setColor } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

export const TOOL_MODELS: Record<ToolId, LootModel> = {
  // Wool 1 (dark green), its fold's shadow 2, linen within 3, the straps 4.
  bedroll: model([0x4e6a42, 0x3a5232, 0xe6dcc0, 0x7a4a2a], [8, 3, 4], (g) => {
    fillBox(g, 0, 0, 0, 7, 2, 3, (_x, y, z) => (y === 1 && (z === 0 || z === 3) ? 1 : y === 2 && z >= 1 && z <= 2 ? 1 : y === 0 && z >= 1 && z <= 2 ? 1 : y === 1 && z >= 1 && z <= 2 ? 1 : 0)); // the roll, its corners cut round
    for (const x of [0, 7]) for (const z of [1, 2]) setColor(g, x, 1, z, 3); // the linen at the ends, within
    for (const x of [2, 5]) fillBox(g, x, 0, 0, x, 2, 3, (_x, y, z) => (y === 2 && z >= 1 && z <= 2) || (y === 1 && (z === 0 || z === 3)) ? 4 : 0); // the straps round it
    setColor(g, 4, 2, 1, 2);
    setColor(g, 3, 2, 2, 2);
  }),
};
