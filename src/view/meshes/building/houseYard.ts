// What stands round a house, varied by its trim (so the same few models
// carry it, no more of them): where its chimney rises, and what's left
// about its door and yard. Each prop keeps inside the tile, clear of the
// door and its step.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { fillBox } from '../voxel/voxelShapes';
import { C } from './housePalette';
import { MID, masonry, onWall, put, wallsOf, type Box } from './houseParts';

export type ChimneyPlace = 'back' | 'front' | 'gable';

// The chimney: through the back slope (as the inn's), the front slope, or
// a stack of its own built up against the -X gable from the ground.
export function chimneyAt(grid: VoxelGrid, b: Box, ridge: number, place: ChimneyPlace): void {
  if (place === 'gable') {
    const x = b.x0 - 2;
    fillBox(grid, x, 0, MID - 1, x + 1, ridge + 2, MID + 1, masonry);
    fillBox(grid, x - 1, 0, MID - 2, x + 1, 2, MID + 2, masonry); // its broad foot
    fillBox(grid, x - 1, ridge + 3, MID - 2, x + 2, ridge + 3, MID + 2, C.stoneDark); // cap
    fillBox(grid, x, ridge + 4, MID, x, ridge + 5, MID, C.clayPot);
    return;
  }
  const x = place === 'back' ? b.x1 - 3 : b.x0 + 3;
  const z = place === 'back' ? MID + 4 : MID - 4;
  fillBox(grid, x - 1, b.y1 + 1, z - 1, x + 1, ridge + 3, z + 1, masonry);
  fillBox(grid, x - 2, ridge + 4, z - 2, x + 2, ridge + 4, z + 2, C.stoneDark); // cap
  fillBox(grid, x, ridge + 5, z, x, ridge + 6, z, C.clayPot);
}

// A banded barrel, rounded (no corners), three voxels high.
function barrel(grid: VoxelGrid, bx: number, bz: number): void {
  for (let y = 0; y <= 2; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) if (Math.abs(dx) + Math.abs(dz) < 2) put(grid, [bx + dx, y, bz + dz], y === 1 ? C.iron : C.barrel);
    }
  }
}

// Firewood stacked along X, pale cut ends out.
function woodpile(grid: VoxelGrid, x0: number, x1: number, z: number): void {
  for (const [dz, y] of [
    [0, 0],
    [1, 0],
    [0, 1],
  ]) {
    for (let x = x0; x <= x1; x++) put(grid, [x, y, z + dz], x === x0 || x === x1 ? C.endGrain : C.bark);
  }
}

// A plank bench against the front wall, on two legs.
function bench(grid: VoxelGrid, u0: number, u1: number, z: number): void {
  for (const x of [u0, u1]) fillBox(grid, x, 0, z, x, 3, z, C.timber);
  fillBox(grid, u0, 4, z - 1, u1, 4, z, C.timberLight);
}

// A clay pot of flowers.
function pot(grid: VoxelGrid, x: number, z: number, flower: number): void {
  fillBox(grid, x, 0, z, x, 1, z, C.clayPot);
  put(grid, [x, 2, z], C.leaf);
  put(grid, [x, 3, z], flower);
}

// A cartwheel leaned on the -X wall: a five-voxel rim, spokes and an iron hub.
function cartwheel(grid: VoxelGrid, x: number, zc: number): void {
  for (let dz = -2; dz <= 2; dz++) {
    for (let dy = -2; dy <= 2; dy++) {
      const rim = Math.max(Math.abs(dz), Math.abs(dy)) === 2 && Math.abs(dz) + Math.abs(dy) < 4;
      const spoke = dz === 0 || dy === 0;
      if (rim || spoke) put(grid, [x, 2 + dy, zc + dz], dz === 0 && dy === 0 ? C.iron : rim ? C.timberLight : C.timber);
    }
  }
}

// A hay bale, its binding darker.
function hayBale(grid: VoxelGrid, x: number, z: number): void {
  fillBox(grid, x, 0, z, x + 3, 1, z + 1, (bx) => (bx === x + 1 ? C.hayDark : C.hay));
}

// The yard: a trim's own few things, the two-storey houses' shop sign
// always (hung from an iron bracket on the jetty).
export function yard(grid: VoxelGrid, ground: Box, upper: Box, doorU: number, twoStorey: boolean, trim: number): void {
  const front = ground.z0 - 3;
  const back = ground.z1 + 2;
  const flowers = [C.flowerRed, C.flowerYellow, C.flowerPurple];
  switch (trim % 5) {
    case 0:
      barrel(grid, doorU + 5, front);
      woodpile(grid, ground.x0 + 2, ground.x0 + 6, back);
      break;
    case 1:
      bench(grid, doorU + 4, doorU + 8, ground.z0 - 2);
      pot(grid, doorU - 3, ground.z0 - 3, flowers[0]);
      pot(grid, doorU + 3, ground.z0 - 3, flowers[1]);
      break;
    case 2:
      barrel(grid, doorU + 5, front);
      cartwheel(grid, ground.x0 - 2, MID + 4);
      break;
    case 3:
      hayBale(grid, ground.x1 - 5, back);
      pot(grid, doorU + 3, ground.z0 - 3, flowers[2]);
      woodpile(grid, ground.x0 + 2, ground.x0 + 6, back);
      break;
    default:
      bench(grid, doorU + 4, doorU + 8, ground.z0 - 2);
      barrel(grid, ground.x1 - 2, back);
  }

  if (twoStorey) {
    const u = upper.x1 - 2;
    for (let d = -1; d >= -4; d--) put(grid, onWall(wallsOf(upper).front, u, upper.y0 + 4, d), C.iron);
    fillBox(grid, u, upper.y0 + 1, upper.z0 - 4, u, upper.y0 + 3, upper.z0 - 2, C.sign);
  }
}

// Where a trim puts its chimney (its yard in step with it: the cartwheel's
// trim never has the gable stack).
export const CHIMNEYS: readonly ChimneyPlace[] = ['back', 'gable', 'front', 'gable', 'back'];
export const chimneyOf = (trim: number): ChimneyPlace => CHIMNEYS[trim % CHIMNEYS.length];
