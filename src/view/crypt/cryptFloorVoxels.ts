// A crypt's floor (cryptVoxels.ts the rest of it), a tile at a time, 25 x 25
// voxels and FLOOR_DEEP thick, its top at the floor's level: old flagstones
// worn by the years, four patterns of them laid as flagstones are
// (meshes/voxel/flagstones.ts), no grid of tiles showing. The joints are sunk (a
// groove, dark), some stones have sunk a voxel, each stone's edge a shade
// darker (a bevel, by colour) and its middle worn lighter; here and there a
// jagged crack (across, never up the screen), moss in the joints, dust.

import { createGrid } from '../meshes/voxel/voxelShapes';
import { layFlagstones } from '../meshes/voxel/flagstones';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { hashUnit, mulberry32 } from '../../util/random';
import { C, TILE } from './cryptVoxels';

export const FLOOR_DEEP = 2; // voxels: the top layer the stones, under it what the joints and sunk stones show

export function floorTile(variant: number): VoxelGrid {
  const grid = createGrid([TILE, FLOOR_DEEP, TILE]);
  const flags = layFlagstones(mulberry32(9100 + variant * 31), { size: TILE, deep: [6, 6], long: [7, 8], lead: 8 });
  const sunk = (s: number) => hashUnit(s, variant, 91) < 0.2; // stones that have sunk a voxel
  const set = (u: number, y: number, v: number, color: number) => (grid.cells[u + TILE * (y + FLOOR_DEEP * v)] = color);
  for (let u = 0; u < TILE; u++) {
    for (let v = 0; v < TILE; v++) {
      const s = flags.stone(u, v);
      const tone = hashUnit(s, variant, 90) < 0.5 ? C.flag : C.flagDark;
      if (flags.joint(u, v)) {
        set(u, 0, v, variant === 3 && hashUnit(u, v, 92) < 0.35 ? C.moss : C.flagMortar); // a groove of mortar (moss in it, in one pattern)
        continue;
      }
      set(u, 0, v, C.flagEdge);
      if (sunk(s)) {
        set(u, 0, v, tone); // sunk a voxel: its face down where the joints are
        continue;
      }
      // A stone at the floor's level: its edge (next to a joint) bevelled dark, its middle worn light, specks of dust.
      const nearJoint = flags.byJoint(u, v);
      const worn = !nearJoint && hashUnit(s * 7 + Math.floor(u / 3), Math.floor(v / 3), 93 + variant) < 0.25;
      const crack = variant === 2 && s === 2 && v === 3 + Math.round(Math.sin(u * 1.1) * 1.3) + (s % 3) * 7;
      set(u, 1, v, crack ? C.flagMortar : nearJoint ? C.flagEdge : hashUnit(u, v, 94 + variant) < 0.03 ? C.dust : worn ? C.flagLight : tone);
    }
  }
  return grid;
}

