// Voxel bush models, built palette-first and silhouette-first. A bush is a
// few overlapping ellipsoid lumps (a lumpy, clearly bush-shaped outline)
// with some surface voxels knocked out so the edge isn't a perfect blob.
// Leaves are shaded in height bands (shadowed base -> sunlit top), which
// both reads as form at a distance and keeps large same-color areas for the
// greedy mesher to merge. Berry and flowering bushes add accent voxels.

import type { BushKind } from '../../../model/types';
import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, forEachVoxel, insideEllipsoid, isSurface, nibble, setColor, shadeBands, type Ellipsoid } from '../voxel/voxelShapes';

// Palette (index + 1 is stored in the grid; 0 = empty).
export const BUSH_PALETTE = [
  0x2e5a32, // 1 shadowed base leaves
  0x3d7a3c, // 2 mid leaves
  0x559a48, // 3 upper leaves
  0x74b45a, // 4 sunlit top
  0xc23b32, // 5 berry
  0xf3eee2, // 6 white blossom
  0xea9bb8, // 7 pink blossom
];
const LEAF_BANDS = [1, 2, 3, 4];
const BERRY = 5;
const BLOSSOMS = [6, 7];
const FOLIAGE = 20; // temporary marker while building

export const BUSH_VOXEL_SIZE = 0.04; // ~3-4 screen pixels per voxel at gameplay zoom
export const BUSH_GRID: [number, number, number] = [13, 10, 13]; // ~0.52 wide, 0.4 tall

function lumps(rng: () => number): Ellipsoid[] {
  const [sx, , sz] = BUSH_GRID;
  const result: Ellipsoid[] = [{ cx: sx / 2, cy: 3.2, cz: sz / 2, rx: 5.6, ry: 4.2, rz: 5.6 }];
  const extra = 2 + Math.floor(rng() * 2);
  for (let i = 0; i < extra; i++) {
    const angle = rng() * Math.PI * 2;
    const r = 3 + rng() * 0.8;
    result.push({ cx: sx / 2 + Math.cos(angle) * 2.6, cy: 4 + rng() * 2.2, cz: sz / 2 + Math.sin(angle) * 2.6, rx: r, ry: r * 0.9, rz: r });
  }
  return result;
}

export function buildBushVoxels(kind: BushKind, shape: number): VoxelGrid {
  const grid = createGrid(BUSH_GRID);
  const rng = mulberry32(0xb05 + shape * 7919); // shape depends only on the variant, not the kind
  const shapeLumps = lumps(rng);

  let top = 0;
  forEachVoxel(grid, (x, y, z) => {
    if (shapeLumps.some((l) => insideEllipsoid(l, x, y, z))) {
      setColor(grid, x, y, z, FOLIAGE);
      top = Math.max(top, y);
    }
  });
  nibble(grid, rng, 0.12, 1, FOLIAGE);

  // Accents are chosen before shading replaces the marker color: berries on
  // the sides and top, blossoms only on upward-facing surface voxels.
  const accents = mulberry32(0xacc + shape * 104729 + kind.length * 31);
  const accented: Array<[number, number, number, number]> = [];
  forEachVoxel(grid, (x, y, z) => {
    if (colorAt(grid, x, y, z) !== FOLIAGE || !isSurface(grid, x, y, z)) return;
    if (kind === 'berry' && y >= top * 0.3 && accents() < 0.08) accented.push([x, y, z, BERRY]);
    if (kind === 'flowering' && colorAt(grid, x, y + 1, z) === 0 && accents() < 0.14) {
      accented.push([x, y, z, BLOSSOMS[accents() < 0.5 ? 0 : 1]]);
    }
  });

  shadeBands(grid, FOLIAGE, LEAF_BANDS, 0, top, accents, 0.1);
  for (const [x, y, z, color] of accented) setColor(grid, x, y, z, color);
  return grid;
}
