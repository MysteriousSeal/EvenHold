// A voxel model at half its detail (each 2x2x2 block of it one voxel twice the size, filled where most of the block
// is, in its commonest colour): what's drawn of it far off at a lower graphics quality (render/graphics.ts), a
// fraction of its faces, its outline and colours kept.

import { voxelIndex, type VoxelGrid } from './greedyMesh';
import { colorAt, createGrid } from './voxelShapes';

const FILLED = 3; // of a block's 8, for it to count as filled (a little under half: thin branches and tips kept)

export function coarseGrid(grid: VoxelGrid): VoxelGrid {
  const [sx, sy, sz] = grid.size;
  const out = createGrid([Math.ceil(sx / 2), Math.ceil(sy / 2), Math.ceil(sz / 2)]);
  const counts = new Map<number, number>();
  for (let x = 0; x < out.size[0]; x++)
    for (let y = 0; y < out.size[1]; y++)
      for (let z = 0; z < out.size[2]; z++) {
        counts.clear();
        let filled = 0;
        for (let i = 0; i < 8; i++) {
          const c = colorAt(grid, x * 2 + (i & 1), y * 2 + ((i >> 1) & 1), z * 2 + (i >> 2));
          if (c === 0) continue;
          filled++;
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
        if (filled < FILLED) continue;
        let best = 0;
        for (const [c, n] of counts) if (n > (counts.get(best) ?? 0)) best = c;
        out.cells[voxelIndex(out, x, y, z)] = best;
      }
  return out;
}
