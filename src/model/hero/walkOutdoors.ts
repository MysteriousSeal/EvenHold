// A step of the hero's outdoors, (dx, dz) tiles, kept on the map; each axis
// on its own, so they slide along what's in the way (`free`: whether a spot's
// clear) instead of stopping dead when only one of them would run into it.

import { EDGE_MARGIN } from '../constants';
import type { MapSize } from '../map/grid';

export function stepOutdoors(hero: { x: number; z: number }, size: MapSize, dx: number, dz: number, free: (x: number, z: number) => boolean): void {
  const x = Math.min(size.width - 1 - EDGE_MARGIN, Math.max(EDGE_MARGIN, hero.x + dx));
  const z = Math.min(size.depth - 1 - EDGE_MARGIN, Math.max(EDGE_MARGIN, hero.z + dz));
  if (free(x, hero.z)) hero.x = x;
  if (free(hero.x, z)) hero.z = z;
}
