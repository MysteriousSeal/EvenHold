// Where the road surface is. A trail tile's dirt band covers a cross: the
// center square plus an arm toward each connected neighbor (another trail
// tile or a village square). Village square tiles are paved edge to edge.
// Shared by collision height (the hero walks on top of the road), ground
// cover (grass lines the road but never grows on it), and the road mesh.

import { ROAD_WIDTH } from './constants';
import { NEIGHBORS_4, inBounds, toCellX, toCellZ } from './grid';
import type { Surface } from './types';

// Which of the four neighbors a trail tile connects to, as a bitmask in
// NEIGHBORS_4 order (+x, -x, +z, -z).
export function roadConnections(surfaceMap: Surface[][], x: number, z: number): number {
  let mask = 0;
  NEIGHBORS_4.forEach(([dx, dz], i) => {
    if (inBounds(x + dx, z + dz) && surfaceMap[x + dx][z + dz] !== 'natural') mask |= 1 << i;
  });
  return mask;
}

// Is a point, offset (ox, oz) from its trail tile's center, on the dirt
// band? `clearance` widens the band (e.g. to keep grass off its edge).
export function onRoadBand(mask: number, ox: number, oz: number, clearance = 0): boolean {
  const half = ROAD_WIDTH / 2 + clearance;
  if (Math.abs(ox) <= half && Math.abs(oz) <= half) return true;
  return NEIGHBORS_4.some(([dx, dz], i) => {
    if (!(mask & (1 << i))) return false;
    return dx !== 0 ? Math.sign(ox) === dx && Math.abs(oz) <= half : Math.sign(oz) === dz && Math.abs(ox) <= half;
  });
}

// Is a world position on road or square paving (as opposed to grass)?
export function onPaving(surfaceMap: Surface[][], x: number, z: number): boolean {
  const cx = toCellX(x);
  const cz = toCellZ(z);
  const surface = surfaceMap[cx][cz];
  if (surface === 'plaza') return true;
  if (surface !== 'path') return false;
  return onRoadBand(roadConnections(surfaceMap, cx, cz), x - cx, z - cz);
}
