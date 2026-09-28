// Voxel bush models, built palette-first and silhouette-first. A bush is a
// few overlapping ellipsoid lumps (a lumpy, clearly bush-shaped outline)
// with some surface voxels knocked out so the edge isn't a perfect blob.
// Leaves are shaded like the trees: per lump, by height and how much each
// voxel faces the sun, dithered per voxel so they read as texture, lit where
// open to the sky and dark on the underside. Berry bushes carry small bunches
// of berries; flowering bushes have blossoms with a bright heart.

import type { BushKind } from '../../../model/types';
import { mulberry32 } from '../../../util/random';
import { SUN_DIRECTION } from '../../constants';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, forEachVoxel, insideEllipsoid, isSurface, nibble, setColor, type Ellipsoid } from '../voxel/voxelShapes';

// Palette (index + 1 is stored in the grid; 0 = empty).
export const BUSH_PALETTE = [
  0x1f4a33, // 1 deep shadow, cool
  0x2a6039, // 2 shadow
  0x387840, // 3 mid
  0x4b9049, // 4 mid-light
  0x66a954, // 5 light
  0x94c96a, // 6 sunlit, warm
  0xc23b32, // 7 berry
  0xe25a45, // 8 berry, lit
  0xf3eee2, // 9 white blossom
  0xea9bb8, // 10 pink blossom
  0xffd35c, // 11 blossom heart
];
const LEAF_BANDS = [1, 2, 3, 4, 5, 6];
const BERRIES = [7, 8];
const BLOSSOMS = [9, 10];
const HEART = 11;
const DITHER = 0.22;
const SUN = SUN_DIRECTION.toArray(); // baked shading matches the scene's sun
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

  // Accents are chosen before shading replaces the marker color: berry
  // bunches (a berry and a lit one above it) on the sides and top, blossoms
  // on upward-facing voxels with a heart sitting on top.
  const accents = mulberry32(0xacc + shape * 104729 + kind.length * 31);
  const accented: Array<[number, number, number, number]> = [];
  forEachVoxel(grid, (x, y, z) => {
    if (colorAt(grid, x, y, z) !== FOLIAGE || !isSurface(grid, x, y, z)) return;
    if (kind === 'berry' && y >= top * 0.3 && accents() < 0.06) {
      accented.push([x, y, z, BERRIES[0]]);
      if (colorAt(grid, x, y + 1, z) === FOLIAGE) accented.push([x, y + 1, z, BERRIES[1]]);
    }
    if (kind === 'flowering' && colorAt(grid, x, y + 1, z) === 0 && accents() < 0.12) {
      accented.push([x, y, z, BLOSSOMS[accents() < 0.5 ? 0 : 1]]);
      if (y + 1 < BUSH_GRID[1] && accents() < 0.5) accented.push([x, y + 1, z, HEART]);
    }
  });

  // Each leaf voxel is lit by the lump it's most deeply inside.
  forEachVoxel(grid, (x, y, z) => {
    if (colorAt(grid, x, y, z) !== FOLIAGE) return;
    let lump = shapeLumps[0];
    let depth = Infinity;
    for (const l of shapeLumps) {
      const d = Math.hypot((x + 0.5 - l.cx) / l.rx, (y + 0.5 - l.cy) / l.ry, (z + 0.5 - l.cz) / l.rz);
      if (d < depth) [lump, depth] = [l, d];
    }
    const nx = (x + 0.5 - lump.cx) / lump.rx;
    const ny = (y + 0.5 - lump.cy) / lump.ry;
    const nz = (z + 0.5 - lump.cz) / lump.rz;
    const len = Math.hypot(nx, ny, nz) || 1;
    let shade = 0.6 * ny + (0.5 * (nx * SUN[0] + ny * SUN[1] + nz * SUN[2])) / len + (accents() - 0.5) * DITHER;
    if (colorAt(grid, x, y + 1, z) === 0) shade += 0.35; // open to the sky
    if (y > 0 && colorAt(grid, x, y - 1, z) === 0) shade = Math.min(shade, -0.6); // underside
    const band = Math.floor(((Math.max(-1, Math.min(1, shade)) + 1) / 2) * LEAF_BANDS.length);
    setColor(grid, x, y, z, LEAF_BANDS[Math.min(LEAF_BANDS.length - 1, band)]);
  });
  for (const [x, y, z, color] of accented) setColor(grid, x, y, z, color);
  return grid;
}
