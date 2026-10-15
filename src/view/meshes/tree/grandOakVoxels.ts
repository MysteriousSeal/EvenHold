// The deep woods' oaks (treeMesh.ts: an oak standing in a forest, model/scenery/biomes.ts, drawn so; still an oak to
// chop): bigger and taller than the open country's, a thick trunk going up bare a good way, a broad, high, dark
// canopy of big puffs close together (crowns all but touching their neighbours'), in the woods' own three greens and a
// deep shadow under. Its own grid (wider and taller than TREE_GRID), at the same voxel size.

import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, forEachVoxel, nibble, setColor } from '../voxel/voxelShapes';
import { GRAND_BANDS, MARKER, branch, shadeFoliage, type Volume } from './treeParts';

export const GRAND_GRID: [number, number, number] = [41, 50, 41]; // ~1.64 wide, 2 tall
export const GRAND_SHAPES = 3;
const BARK = 1;
const BARK_DARK = 2;
const BARK_LIGHT = 3;
const M = Math.floor(GRAND_GRID[0] / 2);

export function grandOak(shape: number): VoxelGrid {
  const grid = createGrid(GRAND_GRID);
  const rng = mulberry32(0x6a4d + shape * 104729);
  const top = 22 + shape * 2; // the trunk's height, bare below the canopy
  const lean: [number, number] = [[1, 0], [0, 1], [-1, -1]][shape % 3] as [number, number];
  // A 4x4 trunk, shifting toward its lean as it goes up, on a broad root flare.
  for (let y = 0; y <= top; y++) {
    const [ox, oz] = y > top * 0.5 ? lean : [0, 0];
    for (let dx = -2; dx < 2; dx++) for (let dz = -2; dz < 2; dz++) setColor(grid, M + dx + ox, y, M + dz + oz, y <= 1 ? BARK_DARK : dx === 1 || dz === 1 ? BARK_LIGHT : BARK);
  }
  for (let d = -4; d <= 3; d++) for (const [x, z] of [[M + d, M], [M, M + d], [M + d, M - 1], [M - 1, M + d]]) setColor(grid, x, 0, z, BARK_DARK);
  const [tx, tz] = [M + lean[0], M + lean[1]];
  // The canopy: a broad crown puff and a ring of big ones about it, close enough to merge into one roof.
  const puffs: Volume[] = [{ cx: tx, cy: top + 14, cz: tz, rx: 10, ry: 7, rz: 10 }];
  const sides = 5 + Math.floor(rng() * 2);
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 + rng() * 0.5;
    const reach = 9 + rng() * 3;
    const r = 6 + rng() * 1.5;
    puffs.push({ cx: tx + Math.cos(angle) * reach, cy: top + 5 + rng() * 6, cz: tz + Math.sin(angle) * reach, rx: r, ry: r * 0.75, rz: r });
  }
  for (const p of puffs.slice(1)) branch(grid, [tx, top - 2, tz], [tx + (p.cx - tx) * 0.7, p.cy - 1, tz + (p.cz - tz) * 0.7], 1.3);
  forEachVoxel(grid, (x, y, z) => {
    let best = -1;
    let depth = 1;
    puffs.forEach((p, i) => {
      const d = Math.hypot((x + 0.5 - p.cx) / p.rx, (y + 0.5 - p.cy) / p.ry, (z + 0.5 - p.cz) / p.rz);
      if (d <= depth) [depth, best] = [d, i];
    });
    if (best >= 0) setColor(grid, x, y, z, MARKER + best);
  });
  puffs.forEach((p, i) => nibble(grid, rng, 0.06, Math.floor(p.cy - p.ry * 0.5), MARKER + i));
  shadeFoliage(grid, rng, puffs, GRAND_BANDS);
  return grid;
}
