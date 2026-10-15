// Surface patterns shared by gear painters, all grid-aligned. Shell
// coordinates go down to -1, so every pattern wraps with a true modulo.

import type { VoxelGrid } from '../../voxel/greedyMesh';
import { createGrid, fillBox } from '../../voxel/voxelShapes';

export const mod = (n: number, m: number): number => ((n % m) + m) % m;

// Chain mail: rings alternating in two shades, like a checkerboard.
export const mail = (x: number, y: number, z: number, ring: number, gap: number): number => (mod(x + y + z, 2) === 0 ? ring : gap);

// Shaggy fur: three shades in a staggered repeat.
export const fur = (x: number, y: number, z: number, shades: [light: number, mid: number, dark: number]): number => shades[mod(x + y * 2 + z, 3)];

// A weave (straw, wicker): two shades in a checker of the two axes given.
export const weave = (a: number, b: number, light: number, dark: number): number => (mod(a + b, 2) === 0 ? light : dark);

// A flat model drawn in rows (the top row first, '.' empty), `depth` voxels deep, standing facing +Z (or `lying` on
// the ground, its top row the farthest: a garment laid out, its whole shape seen from above): each character's colour
// from `colors` (a colour, or one by where it is). For an icon's own model (itemModel.ts `icon`).
export function drawn(rows: readonly string[], depth: number, colors: Record<string, number | ((x: number, y: number) => number)>, lying = false): VoxelGrid {
  const [w, h] = [rows[0].length, rows.length];
  const grid = createGrid(lying ? [w, depth, h] : [w, h, depth]);
  fillBox(grid, 0, 0, 0, w - 1, lying ? depth - 1 : h - 1, lying ? h - 1 : depth - 1, (x, y, z) => {
    const row = lying ? z : h - 1 - y;
    const color = colors[rows[row][x]];
    return typeof color === 'function' ? color(x, h - 1 - row) : color ?? 0;
  });
  return grid;
}
