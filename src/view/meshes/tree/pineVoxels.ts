// Voxel pines (treeParts.ts: their palette and the ways trees are built): lobed, drooping tiers stacked up a trunk,
// each its own cone with its dark skirt over the lighter top of the next down; branch tips fresh and light, cones
// hanging half-hidden under the lower tiers. Six layouts (PINE_TIERS), the last three each their own outline: a tall
// narrow spruce, a short broad fir, a sparse windswept pine.

import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, forEachVoxel, nibble, setColor } from '../voxel/voxelShapes';
import { MARKER, PINE_BANDS, PINE_CONE, PINE_DITHER, PINE_TIP, TREE_GRID, band, lighting, trunk, type Volume } from './treeParts';

// Tier layout per pine shape: [base y, height, radius at the base].
const PINE_TIERS: Array<Array<[number, number, number]>> = [
  [
    [6, 9, 11],
    [11, 9, 9.5],
    [16, 9, 8],
    [21, 8, 6],
    [26, 8, 4.2],
  ],
  [
    [5, 10, 12],
    [12, 10, 9.5],
    [19, 9, 7],
    [25, 9, 4.5],
  ],
  [
    [7, 8, 10],
    [12, 8, 8.5],
    [17, 8, 7],
    [22, 7, 5.5],
    [26, 7, 4],
  ],
  // A tall, narrow spruce: six slim tiers, up to the top of the grid.
  [
    [4, 8, 7.5],
    [9, 8, 6.8],
    [14, 7, 6],
    [19, 7, 5],
    [24, 6, 4],
    [28, 6, 2.8],
  ],
  // A short, broad fir: three wide tiers, low.
  [
    [4, 9, 13],
    [10, 9, 10],
    [16, 9, 6.5],
  ],
  // A sparse, windswept pine: its tiers set apart, the trunk showing between them.
  [
    [7, 5, 8.5],
    [14, 5, 6.5],
    [20, 5, 4.8],
    [25, 5, 3],
  ],
];

export function pine(shape: number): VoxelGrid {
  const grid = createGrid(TREE_GRID);
  const rng = mulberry32(0x914e + shape * 104729);
  const tiers = PINE_TIERS[shape % PINE_TIERS.length];
  const [lastBase, lastHeight] = tiers[tiers.length - 1];
  const crown = lastBase + lastHeight - 1;
  const [tx, tz] = trunk(grid, crown - 3, [0, 0]);
  const cx = tx + 0.5;
  const cz = tz + 0.5;

  // Each tier is a cone whose outline is lobed (like clumps of branches)
  // rather than a perfect circle, with branch tips drooping below its base
  // and further out. Higher tiers overwrite the top of the one below, so
  // each tier's dark skirt sits over the lighter top of the next tier down.
  const tips: Array<[number, number, number]> = [];
  const inGrid = (x: number, y: number, z: number) =>
    x >= 0 && y >= 0 && z >= 0 && x < grid.size[0] && y < grid.size[1] && z < grid.size[2];
  tiers.forEach(([base, height, radius], i) => {
    const lobes = 6 + Math.floor(rng() * 2);
    const phase = rng() * Math.PI * 2;
    forEachVoxel(grid, (x, y, z) => {
      if (y < base || y >= base + height) return;
      const t = (y - base) / (height - 1);
      const r = radius * Math.pow(1 - t, 0.9) + 0.8 * t;
      const dx = x + 0.5 - cx;
      const dz = z + 0.5 - cz;
      const lobe = 1 + 0.14 * Math.sin(lobes * Math.atan2(dz, dx) + phase);
      if (Math.hypot(dx, dz) <= r * lobe) setColor(grid, x, y, z, MARKER + i);
    });
    for (let l = 0; l < lobes; l++) {
      const angle = (l / lobes) * Math.PI * 2 + (Math.PI / 2 - phase) / lobes;
      const at = (reach: number): [number, number] => [
        Math.floor(cx + Math.cos(angle) * radius * reach),
        Math.floor(cz + Math.sin(angle) * radius * reach),
      ];
      const [x, z] = at(1.02);
      if (inGrid(x, base - 1, z)) {
        setColor(grid, x, base - 1, z, MARKER + i);
        tips.push([x, base - 1, z]); // a fresh, light branch tip
      }
    }
  });
  const spireX = Math.floor(cx);
  const spireZ = Math.floor(cz);
  for (let y = crown + 1; y <= crown + 3 && y < grid.size[1]; y++) setColor(grid, spireX, y, spireZ, MARKER + tiers.length - 1);

  tiers.forEach(([base], i) => nibble(grid, rng, 0.04, base + 1, MARKER + i));
  forEachVoxel(grid, (x, y, z) => {
    const c = colorAt(grid, x, y, z);
    if (c < MARKER) return;
    const [base, height, radius] = tiers[c - MARKER];
    const tier: Volume = { cx, cy: base + height * 0.35, cz, rx: radius, ry: height * 0.65, rz: radius };
    let shade = lighting(tier, x, y, z) + (rng() - 0.5) * PINE_DITHER;
    // Needles open to the sky catch the light; each tier's bottom edge
    // stays in deep shade, so the tiers stack clearly.
    if (colorAt(grid, x, y + 1, z) === 0) shade += 0.6;
    if (y < base + 1 && colorAt(grid, x, y - 1, z) === 0) shade = Math.min(shade, -0.7);
    setColor(grid, x, y, z, band(PINE_BANDS, shade));
  });
  for (const [x, y, z] of tips) setColor(grid, x, y, z, PINE_TIP);

  // A few cones hanging under the lower tiers, half-hidden near the trunk.
  tiers.slice(0, -1).forEach(([base, , radius]) => {
    for (let n = 0; n < 2; n++) {
      const angle = rng() * Math.PI * 2;
      const x = Math.floor(cx + Math.cos(angle) * radius * 0.55);
      const z = Math.floor(cz + Math.sin(angle) * radius * 0.55);
      if (inGrid(x, base - 1, z) && colorAt(grid, x, base - 1, z) === 0 && colorAt(grid, x, base, z) !== 0) {
        setColor(grid, x, base - 1, z, PINE_CONE);
      }
    }
  });
  return grid;
}
