// Pictures for the jobs posted on an inn's notice board that no item of the game's stands for (controller/jobs/
// jobPanel.ts), in voxels drawn by row as the blessings' are (blessingVoxels.ts): a red rose for a pleasure worker,
// its bloom in three reds (a lighter petal, darker folds), on a green stem with two leaves.
import type { VoxelModel } from '../ui/voxelIcon';
import { fromRows } from './blessingVoxels';

export const roseModel = (): VoxelModel =>
  fromRows(
    [
      '....rRRr....',
      '...RRPRRr...',
      '..RRPRrRRr..',
      '..RPRRRrRR..',
      '..RRrRRRRr..',
      '..rRRrRRr...',
      '...rRRRr....',
      '....gGg.....',
      '.....G..GG..',
      '.....G.GGg..',
      '..GG.GGg....',
      '.gGGGG......',
      '.....G......',
      '.....G......',
    ],
    3,
    { R: 1, r: 2, P: 3, G: 4, g: 5 },
    [0xc02a3c, 0x8a1828, 0xe8707c, 0x4c8a3a, 0x356428],
  );
