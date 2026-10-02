// The daylight falling through the crack in a cave's nest wall onto its floor
// (caveLife.ts, once she's slain), in the floor's own voxels (0.04): a pool of
// light the shape light takes through a tall cleft, narrow at the rock and
// fanning out into the nest, fading as it goes. Pixel art, not a smooth
// gradient: its brightness stepped into a few warm bands (a pale gold heart,
// amber, a dim umber halo melting into the dark), the steps dithered (a 4 x 4
// ordered pattern) where one gives onto the next; faint rays along it, where
// the cleft's jagged lips break the light. Drawn adding its light to the floor
// under it (so the earth shows through, lit), its colours its brightness.

import type { VoxelGrid } from '../meshes/voxel/greedyMesh';
import { createGrid, setColor } from '../meshes/voxel/voxelShapes';
import { TILE } from './cavePalette';

// Its bands, dimmest first (added to the floor: dark adds little).
export const SUN_PALETTE = [0x1c140a, 0x3a2a14, 0x66482a, 0x9c7a48, 0xd8b878];
const LONG = Math.round(TILE * 2.8); // voxels it reaches out from the rock
const WIDE = Math.round(TILE * 1.7); // voxels across, at most
export const SUN_GRID: [number, number, number] = [WIDE, 1, LONG];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((b) => (b + 0.5) / 16);

// The pool: across x (its middle the cleft's), out along z from the rock (z 0 at the rock's face).
export function sunPool(): VoxelGrid {
  const g = createGrid(SUN_GRID);
  const mid = (WIDE - 1) / 2;
  for (let z = 0; z < LONG; z++) {
    const out = z / LONG; // 0 at the rock, 1 at its far reach
    const half = TILE * (0.22 + 0.62 * out); // (fanning out)
    for (let x = 0; x < WIDE; x++) {
      const across = Math.abs(x - mid) / half;
      if (across > 1.25) continue;
      const fall = Math.max(0, 1 - out) ** 1.15 * Math.max(0, 1 - across ** 2.2); // (bright at the rock and its middle)
      const rays = 1 + 0.16 * Math.sin((x - mid) * 0.55 + z * 0.06) * Math.min(1, out * 3); // (the cleft's lips breaking it)
      const halo = Math.max(0, 1 - Math.abs(across - 1) / 0.25) * (1 - out) * 0.18; // (a dim rim past its edge)
      const level = Math.min(1, fall * rays * 1.1 + halo) * SUN_PALETTE.length;
      const band = Math.floor(level + (BAYER[(x % 4) + (z % 4) * 4] - 0.5)); // (dithered between bands)
      if (band >= 1) setColor(g, x, 0, z, Math.min(SUN_PALETTE.length, band));
    }
  }
  return g;
}
