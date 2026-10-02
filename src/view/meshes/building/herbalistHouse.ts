// A herbalist's house (npcs.ts: one a village, at home in it), told from the
// others outside: its door and shutters painted green, a sign hung from an
// iron bracket beside the door, a red flask under a green leaf on both its
// faces, bundles of herbs drying under the front eaves (tied at the top,
// fresh green to dried gold), and two clay pots of herbs by the door. Laid
// over the house as built (houseVoxels.ts), in its own voxels: the door
// facing -Z, `ground` its ground floor, `upper` its top storey.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { C } from './housePalette';
import { FOUNDATION_TOP, put, type Box } from './houseParts';

export function herbalistDressing(grid: VoxelGrid, ground: Box, upper: Box, doorU: number): void {
  // The woodwork painted green: the door's and the shutters' boards.
  for (let i = 0; i < grid.cells.length; i++) {
    if (grid.cells[i] === C.door) grid.cells[i] = C.herbPaint;
    else if (grid.cells[i] === C.doorDark) grid.cells[i] = C.herbPaintDark;
  }
  const front = ground.z0; // the front wall's outer face

  // The sign: an iron bracket out from the wall over the door's height, the board hung under it, edge-on to the
  // door, its flask and leaf on both faces.
  const u = doorU - 4;
  const top = Math.min(FOUNDATION_TOP + 10, ground.y1 - 1);
  for (let d = 1; d <= 5; d++) put(grid, [u, top, front - d], C.iron);
  for (let y = top - 4; y <= top - 1; y++) {
    for (let z = front - 5; z <= front - 2; z++) {
      const [row, col] = [top - 1 - y, z - (front - 5)]; // (0, 0): its top, nearest the street
      const leaf = (row === 0 && (col === 1 || col === 2)) || (row === 1 && col === 2);
      const flask = (row === 2 && (col === 1 || col === 2)) || (row === 3 && col === 1);
      put(grid, [u, y, z], leaf ? C.leaf : flask ? C.flowerRed : C.sign);
    }
  }

  // Herbs drying under the eaves along the front: a bundle every third voxel, tied, hanging three voxels down.
  const eave = upper.y1;
  for (let x = upper.x0 + 2, i = 0; x <= upper.x1 - 2; x += 3, i++) {
    const herb = [C.herbFresh, C.herbSage, C.herbDry][i % 3]; // (each bundle along, the next of the three)
    put(grid, [x, eave, upper.z0 - 1], C.bark); // (the tie)
    put(grid, [x, eave - 1, upper.z0 - 1], herb);
    put(grid, [x, eave - 2, upper.z0 - 1], herb);
  }

  // Two clay pots of herbs, beside the door, a leafy top on each (one flowering).
  for (const [x, flower] of [[doorU - 3, false], [doorU - 6, true]] as const) {
    for (let y = 0; y <= 1; y++) put(grid, [x, y, front - 2], C.clayPot);
    put(grid, [x, 2, front - 2], C.leaf);
    put(grid, [x, 3, front - 2], flower ? C.flowerPurple : C.herbFresh);
  }
}
