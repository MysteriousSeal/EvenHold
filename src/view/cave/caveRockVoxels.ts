// A cave's rock and its floor (cave/caveVoxels.ts the rest), a tile at a time.
// The rock: gnawed, not built: its faces lumpy (swelling out and sinking back
// in soft rounds, the hollows in shadow), its top ragged, sandy strata
// wandering through it, wet streaking down from the top, moss and earth at its
// foot; full height (any face may face the floor). The floor: packed earth in
// soft patches, pebbles; in one look a root breaking through it, in one a
// damp patch, in one moss.

import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { hashUnit, smoothNoise } from '../../util/random';
import { C, TALL, TILE } from './cavePalette';

export const FLOOR_DEEP = 2; // voxels: the floor's thickness (its top at the floor's level)
export const ROCK_HIGH = TALL + 4; // the rock grid's height (its ragged top within it)

export function rockTile(variant: number): VoxelGrid {
  const grid = createGrid([TILE, ROCK_HIGH, TILE]);
  const seed = 300 + variant * 17;
  for (let u = 0; u < TILE; u++) {
    for (let v = 0; v < TILE; v++) {
      const depth = Math.min(u, v, TILE - 1 - u, TILE - 1 - v);
      const along = Math.min(v, TILE - 1 - v) <= Math.min(u, TILE - 1 - u) ? u + (v < TILE / 2 ? 0 : 40) : v + (u < TILE / 2 ? 80 : 120); // (along whichever face is nearest; each face its own)
      const top = TALL - 3 + Math.round(smoothNoise(u, v, seed, 6) * 6);
      const wet = hashUnit(along, variant, seed + 1) < 0.14; // a wet streak down this face, here
      for (let y = 0; y < top; y++) {
        // Its face lumpy: how far in it's sunk here (0..3), in soft rounds over the face.
        const sunk = Math.round(smoothNoise(along, y, seed + 2, 5) * 3.4 - 0.4);
        if (depth < sunk) continue;
        if (depth > 3 && y < top - 3) continue; // (within: only its top ever seen)
        let color: number;
        if (y >= top - 1) color = C.cap;
        else if (depth === sunk && sunk >= 2) color = C.crevice; // (the hollows in shadow)
        else if (y <= 1) color = hashUnit(along, y, seed + 3) < 0.3 ? C.moss : C.earthDark; // its foot
        else if (wet && y > top - 6 - Math.floor(hashUnit(along, 1, seed + 4) * 20)) color = C.wet;
        else {
          const band = Math.floor((y + Math.round(smoothNoise(along, 0, seed + 5, 8) * 4)) / 5);
          const tone = smoothNoise(along, y, seed + 6, 3);
          color = band % 4 === 2 ? C.strata : tone < 0.35 ? C.rockDark : tone > 0.7 ? C.rockLight : C.rock;
        }
        setColor(grid, u, y, v, color);
      }
    }
  }
  return grid;
}

export function floorTile(variant: number): VoxelGrid {
  const grid = createGrid([TILE, FLOOR_DEEP, TILE]);
  const seed = 400 + variant * 13;
  for (let u = 0; u < TILE; u++) {
    for (let v = 0; v < TILE; v++) {
      setColor(grid, u, 0, v, C.earthDark);
      const patch = smoothNoise(u, v, seed, 6);
      const speck = hashUnit(u, v, seed + 1);
      let color: number = patch < 0.33 ? C.earthDark : patch > 0.68 ? C.earthLight : C.earth;
      if (speck < 0.025) color = speck < 0.012 ? C.pebble : C.pebbleDark;
      if (variant === 1 && Math.abs(v - (9 + Math.round(Math.sin(u * 0.35) * 3 + u * 0.2))) < 1) color = u % 5 === 0 ? C.rootLight : C.root; // a root breaking through
      if (variant === 2 && smoothNoise(u, v, seed + 2, 7) > 0.7) color = C.wet; // a damp patch
      if (variant === 3 && smoothNoise(u, v, seed + 3, 5) > 0.72) color = speck < 0.4 ? C.mossLight : C.moss; // moss
      setColor(grid, u, 1, v, color);
    }
  }
  return grid;
}
