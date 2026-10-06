// Materials in voxels (materials.ts): logs, each a short round length lying along x (four voxels across, its corners
// off), its bark round it and its cut end showing the grain, a heart ring at its middle. A birch's white, dashed
// black, its wood pale; a pine's red-brown and rough, a bead of resin, its wood amber; an oak's dark and furrowed, its
// wood warm tan with a darker ring.

import type { MaterialId } from '../../../model/loot/materials';
import { fillBox } from '../voxel/voxelShapes';
import { model, type LootModel } from './lootModel';

// A log: bark 1, a mark on it 2 (dashes, furrows, resin: by `marked`), its end grain 3, its heart 4.
const log = (palette: number[], marked: (x: number, y: number, z: number) => boolean): LootModel =>
  model(palette, [8, 4, 4], (g) =>
    fillBox(g, 0, 0, 0, 7, 3, 3, (x, y, z) => {
      const rim = y === 0 || y === 3 || z === 0 || z === 3;
      if ((y === 0 || y === 3) && (z === 0 || z === 3)) return 0; // (round: its corners off)
      if (x === 0 || x === 7) return rim ? 1 : (y + z) % 2 === 0 ? 4 : 3; // the cut ends: bark round the grain, the heart in it
      return rim && marked(x, y, z) ? 2 : rim ? 1 : 3;
    }),
  );

export const MATERIAL_MODELS: Record<MaterialId, LootModel> = {
  birchLog: log([0xe8e4da, 0x2a2826, 0xf0dcb0, 0xd8b880], (x, y, z) => (x * 3 + y * 5 + z * 7) % 6 === 0), // black dashes on white
  pineLog: log([0x8a4a2a, 0xffc040, 0xe8b870, 0xc8904a], (x, y, z) => x === 4 && y === 3 && z === 1), // a bead of resin
  oakLog: log([0x5e5246, 0x40382f, 0xd8a868, 0x8a5a30], (x, _y, z) => (x + z) % 3 === 0), // furrowed
};
