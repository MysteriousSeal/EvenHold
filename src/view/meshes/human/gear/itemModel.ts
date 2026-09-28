// How an item looks. A worn piece paints a shell on each body part it
// covers (armorShell.ts); a held one is a small voxel model gripped in
// the hand.
//
// Held items must never lay a face on the same plane as an armor face (it
// would flicker), so their grips follow three rules:
// - Height: armor faces lie on whole voxels (the torso's shells) or half
//   voxels (the arms'), so the grip's y ends in .25 or .75.
// - Depth: the hand's and arms' faces lie on whole voxels, so the grip's z
//   ends in .5; things carried in front of the hand (shields, a torch)
//   start at least 3 voxels ahead, clear of the chest's armor.
// - Width: odd widths centered on the hand keep side faces on whole voxels.
// The no-flicker test (tests/equipment.test.ts) checks every pair of items.

import type { VoxelGrid } from '../../voxel/greedyMesh';
import type { BodyPart } from '../bodyVoxels';
import type { Painter } from './armorShell';

export interface ItemModel {
  palette: number[];
  worn?: Partial<Record<BodyPart, Painter>>;
  jewel?: { build(): VoxelGrid }; // jewelry: not on the body, just its own model (for icons)
  held?: {
    build(): VoxelGrid;
    // The point (in voxels within the grid) that sits in the middle of the hand.
    grip: [number, number, number];
  };
}
