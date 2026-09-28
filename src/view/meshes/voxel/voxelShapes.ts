// Building blocks for procedural voxel models (bushes, trees): fill a
// shape, nibble its outline. Colors are palette
// index + 1 (0 = empty), as the greedy mesher expects.

import { voxelIndex, type VoxelGrid } from './greedyMesh';

export function createGrid(size: [number, number, number]): VoxelGrid {
  return { size, cells: new Uint8Array(size[0] * size[1] * size[2]) };
}

export function colorAt(grid: VoxelGrid, x: number, y: number, z: number): number {
  const [sx, sy, sz] = grid.size;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return 0;
  return grid.cells[voxelIndex(grid, x, y, z)];
}

export function setColor(grid: VoxelGrid, x: number, y: number, z: number, color: number): void {
  grid.cells[voxelIndex(grid, x, y, z)] = color;
}

export function forEachVoxel(grid: VoxelGrid, fn: (x: number, y: number, z: number) => void): void {
  const [sx, sy, sz] = grid.size;
  for (let z = 0; z < sz; z++) for (let y = 0; y < sy; y++) for (let x = 0; x < sx; x++) fn(x, y, z);
}

// Fills the inclusive box [x0..x1] x [y0..y1] x [z0..z1] (clipped to the grid).
export function fillBox(
  grid: VoxelGrid,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  color: number | ((x: number, y: number, z: number) => number),
): void {
  const [sx, sy, sz] = grid.size;
  for (let z = Math.max(0, z0); z <= Math.min(sz - 1, z1); z++) {
    for (let y = Math.max(0, y0); y <= Math.min(sy - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(sx - 1, x1); x++) {
        setColor(grid, x, y, z, typeof color === 'number' ? color : color(x, y, z));
      }
    }
  }
}

// One-voxel-thick straight line between two voxels (inclusive), e.g. a brace.
export function voxelLine(grid: VoxelGrid, from: [number, number, number], to: [number, number, number], color: number): void {
  const steps = Math.max(Math.abs(to[0] - from[0]), Math.abs(to[1] - from[1]), Math.abs(to[2] - from[2]), 1);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const [x, y, z] = [0, 1, 2].map((a) => Math.round(from[a] + (to[a] - from[a]) * t));
    if (x >= 0 && y >= 0 && z >= 0 && x < grid.size[0] && y < grid.size[1] && z < grid.size[2]) setColor(grid, x, y, z, color);
  }
}

// Exposed on any side except straight down (bottoms rest on the ground or trunk).
export function isSurface(grid: VoxelGrid, x: number, y: number, z: number): boolean {
  return (
    colorAt(grid, x + 1, y, z) === 0 ||
    colorAt(grid, x - 1, y, z) === 0 ||
    colorAt(grid, x, y + 1, z) === 0 ||
    colorAt(grid, x, y, z + 1) === 0 ||
    colorAt(grid, x, y, z - 1) === 0
  );
}

export interface Ellipsoid {
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  ry: number;
  rz: number;
}

export function insideEllipsoid(e: Ellipsoid, x: number, y: number, z: number): boolean {
  const dx = (x + 0.5 - e.cx) / e.rx;
  const dy = (y + 0.5 - e.cy) / e.ry;
  const dz = (z + 0.5 - e.cz) / e.rz;
  return dx * dx + dy * dy + dz * dz <= 1;
}

// Knocks out a fraction of exposed voxels at or above minY, so outlines
// read as organic rather than perfect geometric shapes. Only voxels of the
// given color are eligible (e.g. foliage, never the trunk).
export function nibble(grid: VoxelGrid, rng: () => number, chance: number, minY: number, color: number): void {
  const doomed: Array<[number, number, number]> = [];
  forEachVoxel(grid, (x, y, z) => {
    if (y >= minY && colorAt(grid, x, y, z) === color && isSurface(grid, x, y, z) && rng() < chance) doomed.push([x, y, z]);
  });
  for (const [x, y, z] of doomed) setColor(grid, x, y, z, 0);
}
