// A crypt's floor (cryptVoxels.ts the rest of it), a tile at a time, 25 x 25
// voxels and FLOOR_DEEP thick, its top at the floor's level: old flagstones
// worn by the years. Each of the four patterns lays its own rows of stones of
// uneven lengths, the joints never where the next row's are; mortar runs only
// between stones within a tile, never along its edges, so a tile's stones run
// on into the next one's and no grid of tiles shows. The joints are sunk (a
// groove, dark), some stones have sunk a voxel, each stone's edge a shade
// darker (a bevel, by colour) and its middle worn lighter; here and there a
// jagged crack (across, never up the screen), moss in the joints, dust.

import { createGrid } from '../meshes/voxel/voxelShapes';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { hashUnit, mulberry32 } from '../../util/random';
import { C, TILE } from './cryptVoxels';

export const FLOOR_DEEP = 2; // voxels: the top layer the stones, under it what the joints and sunk stones show

export function floorTile(variant: number): VoxelGrid {
  const grid = createGrid([TILE, FLOOR_DEEP, TILE]);
  const rng = mulberry32(9100 + variant * 31);
  const stone = new Int16Array(TILE * TILE).fill(-1); // which stone each voxel column is
  const joint = new Uint8Array(TILE * TILE); // mortar between stones
  // Rows of uneven depth, each split into stones of uneven length from an offset of its own.
  let id = 0;
  for (let v0 = 0; v0 < TILE; ) {
    const deep = Math.min(TILE - v0, 6 + Math.floor(rng() * 6));
    let u0 = -Math.floor(rng() * 8); // (the row's first stone runs on in from the tile before)
    while (u0 < TILE) {
      const long = 7 + Math.floor(rng() * 8);
      for (let u = Math.max(0, u0); u < Math.min(TILE, u0 + long); u++) for (let v = v0; v < v0 + deep; v++) stone[u * TILE + v] = id;
      // The joint at its end and along its far side (within the tile only).
      for (let v = v0; v < v0 + deep; v++) if (u0 + long - 1 < TILE - 1 && u0 + long - 1 >= 0) joint[(u0 + long - 1) * TILE + v] = 1;
      id++;
      u0 += long;
    }
    v0 += deep;
    if (v0 < TILE - 1) for (let u = 0; u < TILE; u++) joint[u * TILE + v0 - 1] = 1;
  }
  const sunk = (s: number) => hashUnit(s, variant, 91) < 0.2; // stones that have sunk a voxel
  const set = (u: number, y: number, v: number, color: number) => (grid.cells[u + TILE * (y + FLOOR_DEEP * v)] = color);
  for (let u = 0; u < TILE; u++) {
    for (let v = 0; v < TILE; v++) {
      const s = stone[u * TILE + v];
      const tone = hashUnit(s, variant, 90) < 0.5 ? C.flag : C.flagDark;
      if (joint[u * TILE + v]) {
        set(u, 0, v, variant === 3 && hashUnit(u, v, 92) < 0.35 ? C.moss : C.flagMortar); // a groove of mortar (moss in it, in one pattern)
        continue;
      }
      set(u, 0, v, C.flagEdge);
      if (sunk(s)) {
        set(u, 0, v, tone); // sunk a voxel: its face down where the joints are
        continue;
      }
      // A stone at the floor's level: its edge (next to a joint) bevelled dark, its middle worn light, specks of dust.
      const nearJoint = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([du, dv]) => {
        const [nu, nv] = [u + du, v + dv];
        return nu >= 0 && nv >= 0 && nu < TILE && nv < TILE && joint[nu * TILE + nv] === 1;
      });
      const worn = !nearJoint && hashUnit(s * 7 + Math.floor(u / 3), Math.floor(v / 3), 93 + variant) < 0.25;
      const crack = variant === 2 && s === 2 && v === 3 + Math.round(Math.sin(u * 1.1) * 1.3) + (s % 3) * 7;
      set(u, 1, v, crack ? C.flagMortar : nearJoint ? C.flagEdge : hashUnit(u, v, 94 + variant) < 0.03 ? C.dust : worn ? C.flagLight : tone);
    }
  }
  return grid;
}

