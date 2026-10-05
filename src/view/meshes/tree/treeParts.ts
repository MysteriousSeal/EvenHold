// What every voxel tree is made of and with (treeVoxels.ts: the oaks and birches, and which is built; pineVoxels.ts:
// the pines): the scale and grid, the palette and its bands, and the shared ways of building one (a branch, a trunk
// on its root flare) and of shading it (each puff or tier lit on its own: dark underside, warm highlight sunward).

import { SUN_DIRECTION } from '../../constants';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, forEachVoxel, setColor } from '../voxel/voxelShapes';

export const TREE_VOXEL_SIZE = 0.04; // matches the bushes, so the world reads at one voxel scale
export const TREE_GRID: [number, number, number] = [31, 38, 31]; // up to ~1.24 wide, ~1.5 tall

// Palette (index + 1 is stored in the grid; 0 = empty).
export const TREE_PALETTE = [
  0x5c4030, // 1 bark
  0x3f2b1e, // 2 bark in shadow / roots
  0x76553b, // 3 bark in sunlight
  0x1e4430, // 4 oak deep shadow, cool
  0x285a34, // 5 oak shadow
  0x35703a, // 6 oak mid
  0x468744, // 7 oak mid-light
  0x5c9f4c, // 8 oak light
  0x173f3a, // 9 pine deep shadow, cool teal
  0x1f5446, // 10 pine shadow
  0x286a50, // 11 pine mid
  0x33805a, // 12 pine mid-light
  0x459865, // 13 pine light
  0x62b170, // 14 pine sunlit
  0x8fcb7f, // 15 pine sunlit highlight, warm
  0x74bd72, // 16 fresh branch tips
  0x7a4e2c, // 17 pine cone
  0x7cb85a, // 18 oak sunlit
  0xa5d06c, // 19 oak sunlit highlight, warm
  0xece6d6, // 20 birch bark
  0xc7c0ae, // 21 birch bark, shaded
  0x2f2b27, // 22 birch bark marks
  0x4d7d33, // 23 birch leaves, shadow
  0x5f933b, // 24 birch leaves
  0x76aa46, // 25 birch leaves, mid
  0x90bf55, // 26 birch leaves, light
  0xadd46a, // 27 birch leaves, sunlit
  0xcde487, // 28 birch leaves, highlight
];
const BARK = 1;
const BARK_DARK = 2;
const BARK_LIGHT = 3;
export const OAK_BANDS = [4, 5, 6, 7, 8, 18, 19];
export const BIRCH_BARK = 20;
export const BIRCH_BARK_SHADE = 21;
export const BIRCH_MARK = 22;
export const BIRCH_BANDS = [23, 24, 25, 26, 27, 28];
const LEAF_DITHER = 0.2;
export const PINE_BANDS = [9, 10, 11, 12, 13, 14, 15];
export const PINE_TIP = 16;
export const PINE_CONE = 17;
export const PINE_DITHER = 0.22; // per-voxel jitter of the shade, so needles read as texture
// Temporary per-puff / per-tier markers while building (never left in the grid).
export const MARKER = 40;

// Direction the scene's sun comes from, so baked shading matches the lighting.
const SUN = SUN_DIRECTION.toArray();

export const CENTER = TREE_GRID[0] / 2;

export interface Volume {
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  ry: number;
  rz: number;
}

// Shade value in [-1, 1] for a voxel on a rounded volume: mostly "how high
// up the volume" (dark underside, light top), plus how directly it faces
// the sun, so the lit side of each puff gets the warm highlight.
export function lighting(v: Volume, x: number, y: number, z: number): number {
  const nx = (x + 0.5 - v.cx) / v.rx;
  const ny = (y + 0.5 - v.cy) / v.ry;
  const nz = (z + 0.5 - v.cz) / v.rz;
  const len = Math.hypot(nx, ny, nz) || 1;
  const sunFacing = (nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) / len;
  return Math.max(-1, Math.min(1, 0.6 * ny + 0.5 * sunFacing));
}

export function band(bands: readonly number[], value: number): number {
  return bands[Math.min(bands.length - 1, Math.max(0, Math.floor(((value + 1) / 2) * bands.length)))];
}

// Thick line of voxels (a branch), stamped as small spheres along the way.
export function branch(grid: VoxelGrid, from: [number, number, number], to: [number, number, number], radius: number): void {
  const steps = Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1], to[2] - from[2]) * 2);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const px = from[0] + (to[0] - from[0]) * t;
    const py = from[1] + (to[1] - from[1]) * t;
    const pz = from[2] + (to[2] - from[2]) * t;
    for (let x = Math.floor(px - radius); x <= Math.ceil(px + radius); x++) {
      for (let y = Math.floor(py - radius); y <= Math.ceil(py + radius); y++) {
        for (let z = Math.floor(pz - radius); z <= Math.ceil(pz + radius); z++) {
          if (Math.hypot(x + 0.5 - px, y + 0.5 - py, z + 0.5 - pz) <= radius && colorAt(grid, x, y, z) === 0) {
            if (x >= 0 && y >= 0 && z >= 0 && x < grid.size[0] && y < grid.size[1] && z < grid.size[2]) setColor(grid, x, y, z, BARK);
          }
        }
      }
    }
  }
}

// Trunk: a 3x3 column that shifts one voxel toward `lean` halfway up (a
// gentle bend), on a root flare. Its sunward faces get the lighter bark.
export function trunk(grid: VoxelGrid, top: number, lean: [number, number]): [number, number] {
  const base = Math.floor(CENTER) - 1;
  let offset: [number, number] = [0, 0];
  for (let y = 0; y <= top; y++) {
    if (y === Math.floor(top * 0.55)) offset = lean;
    for (let dx = 0; dx < 3; dx++) {
      for (let dz = 0; dz < 3; dz++) {
        const sunward = dx === 2 || dz === 2; // +x / +z sides face the sun
        setColor(grid, base + dx + offset[0], y, base + dz + offset[1], y <= 1 ? BARK_DARK : sunward ? BARK_LIGHT : BARK);
      }
    }
  }
  // Root flare: a wider cross at the base, plus diagonal root tips.
  for (let d = -2; d <= 4; d++) {
    for (const [x, z] of [
      [base + d, base + 1],
      [base + 1, base + d],
    ]) {
      setColor(grid, x, 0, z, BARK_DARK);
      if (d >= -1 && d <= 3) setColor(grid, x, 1, z, BARK_DARK);
    }
  }
  for (const [x, z] of [
    [base - 1, base - 1],
    [base + 3, base - 1],
    [base - 1, base + 3],
    [base + 3, base + 3],
  ]) {
    setColor(grid, x, 0, z, BARK_DARK);
  }
  return [base + 1 + offset[0], base + 1 + offset[1]]; // trunk top center
}

// Colors every marked foliage voxel by its puff's lighting, dithered, lit
// where open to the sky and darkened on the underside.
export function shadeFoliage(grid: VoxelGrid, rng: () => number, puffs: Volume[], bands: readonly number[]): void {
  forEachVoxel(grid, (x, y, z) => {
    const c = colorAt(grid, x, y, z);
    if (c < MARKER) return;
    const p = puffs[c - MARKER];
    let shade = lighting(p, x, y, z) + (rng() - 0.5) * LEAF_DITHER;
    if (colorAt(grid, x, y + 1, z) === 0) shade += 0.35;
    if (y + 0.5 < p.cy && colorAt(grid, x, y - 1, z) === 0) shade = Math.min(shade, -0.55);
    setColor(grid, x, y, z, band(bands, shade));
  });
}
