// Building blocks for procedural voxel models (bushes, trees): fill a
// shape, nibble its outline, shade it in height bands. Colors are palette
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

// Recolors voxels of `from` into `bands` (darkest first) by height between
// bottom and top, with a small `jitter` chance of landing one band off.
// Keep jitter low: greedy meshing only merges faces of the same color, so
// every speckle costs triangles.
export function shadeBands(
  grid: VoxelGrid,
  from: number,
  bands: readonly number[],
  bottom: number,
  top: number,
  rng: () => number,
  jitter: number,
): void {
  forEachVoxel(grid, (x, y, z) => {
    if (colorAt(grid, x, y, z) !== from) return;
    const t = (y - bottom) / Math.max(1, top - bottom + 1);
    let band = Math.min(bands.length - 1, Math.max(0, Math.floor(t * bands.length)));
    if (rng() < jitter) band = Math.min(bands.length - 1, Math.max(0, band + (rng() < 0.5 ? -1 : 1)));
    setColor(grid, x, y, z, bands[band]);
  });
}
