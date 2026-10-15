// A broadleaf tree's bare boughs, for winter (common/seasonLeaves.ts drops its leaves then): from the tree's own voxels,
// the limbs within its crown (there all along, under the leaves, never drawn) and a few twigs reaching out to just inside
// the crown's outline, so a bare tree still has its summer shape, light and see-through. Built alongside the tree's own
// model and drawn with it (treeMesh.ts: the one geometry, no draw more); hidden inside the leaves till they fall.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, forEachVoxel, setColor, voxelLine } from '../voxel/voxelShapes';
import { BIRCH_BANDS, GRAND_BANDS, OAK_BANDS } from './treeParts';
import { hashUnit } from '../../../util/random';

const LEAVES = new Set([...OAK_BANDS, ...BIRCH_BANDS, ...GRAND_BANDS]);
const BARK_DARK = 2;
const BIRCH_BARK_SHADE = 21;
const TWIGS = 6;
const REACH = 0.85; // of the way out to the crown's outline the twigs reach (inside the leaves while they're on)
const NEIGHBOURS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export function bareBoughs(tree: VoxelGrid, salt: number): VoxelGrid {
  const out = createGrid(tree.size);
  const leaf = (x: number, y: number, z: number) => LEAVES.has(colorAt(tree, x, y, z));
  let [sx, sy, sz, leaves] = [0, 0, 0, 0];
  let birch = false;
  const outline: Array<[number, number, number]> = [];
  const limbs: Array<[number, number, number]> = [];
  forEachVoxel(tree, (x, y, z) => {
    const c = colorAt(tree, x, y, z);
    if (c === 0) return;
    if (LEAVES.has(c)) {
      [sx, sy, sz, leaves] = [sx + x, sy + y, sz + z, leaves + 1];
      if (NEIGHBOURS.some(([dx, dy, dz]) => colorAt(tree, x + dx, y + dy, z + dz) === 0)) outline.push([x, y, z]);
      return;
    }
    if (c === BIRCH_BARK_SHADE) birch = true;
    // A limb within the crown: bark beside a leaf.
    if (NEIGHBOURS.some(([dx, dy, dz]) => leaf(x + dx, y + dy, z + dz))) {
      setColor(out, x, y, z, c);
      limbs.push([x, y, z]);
    }
  });
  if (leaves === 0 || limbs.length === 0) return out;
  const centre = [sx / leaves, sy / leaves, sz / leaves];
  const twig = birch ? BIRCH_BARK_SHADE : BARK_DARK;
  // Twigs from the nearest limb out toward a few points of the outline.
  for (let t = 0; t < TWIGS; t++) {
    const [ox, oy, oz] = outline[Math.floor(hashUnit(t, salt, 0xb0) * outline.length)];
    if (oy < centre[1] - 2) continue; // (none hanging down under the crown)
    const to: [number, number, number] = [0, 1, 2].map((a) => Math.round(centre[a] + ([ox, oy, oz][a] - centre[a]) * REACH)) as [number, number, number];
    let from = limbs[0];
    let best = Infinity;
    for (const l of limbs) {
      const d = (l[0] - to[0]) ** 2 + (l[1] - to[1]) ** 2 + (l[2] - to[2]) ** 2;
      if (d < best && l[1] <= to[1]) [best, from] = [d, l];
    }
    voxelLine(out, from, to, twig);
  }
  return out;
}
