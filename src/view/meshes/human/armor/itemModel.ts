// How an item looks. A worn piece paints a shell on each body part it
// covers (armorShell.ts); a held one is a small voxel model gripped in
// the hand.

import type { VoxelGrid } from '../../voxel/greedyMesh';
import type { BodyPart } from '../bodyVoxels';
import type { Painter } from './armorShell';

export interface ItemModel {
  palette: number[];
  worn?: Partial<Record<BodyPart, Painter>>;
  held?: {
    build(): VoxelGrid;
    // The point (in voxels within the grid) that sits in the middle of the
    // hand. Held items keep their faces half a voxel off the hand's and a
    // glove's, so nothing flickers where they meet.
    grip: [number, number, number];
  };
}
