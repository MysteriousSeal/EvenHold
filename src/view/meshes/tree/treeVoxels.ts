// Voxel tree models, at the same voxel scale as the bushes. Built
// silhouette-first: oaks are several separate leaf puffs on visible
// branches over a flared, slightly leaning trunk; pines are lobed, drooping
// tiers. The key to making them read as volumes is shading each puff/tier
// on its own — dark underside, warm highlight on the side facing the sun —
// rather than one gradient over the whole tree.

import type { TreeKind } from '../../../model/types';
import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, forEachVoxel, nibble, setColor } from '../voxel/voxelShapes';

export const TREE_VOXEL_SIZE = 0.04; // matches the bushes, so the world reads at one voxel scale
export const TREE_GRID: [number, number, number] = [31, 38, 31]; // up to ~1.24 wide, ~1.5 tall

// Palette (index + 1 is stored in the grid; 0 = empty).
export const TREE_PALETTE = [
  0x5c4030, // 1 bark
  0x3f2b1e, // 2 bark in shadow / roots
  0x76553b, // 3 bark in sunlight
  0x234427, // 4 oak deep shadow
  0x2f5d33, // 5 oak shadow
  0x42783f, // 6 oak mid
  0x5d964a, // 7 oak light
  0x86b95a, // 8 oak sunlit highlight
  0x17392e, // 9 pine deep shadow
  0x21503d, // 10 pine shadow
  0x2c654b, // 11 pine mid
  0x3b7c5a, // 12 pine light
  0x559a6c, // 13 pine sunlit tips
];
const BARK = 1;
const BARK_DARK = 2;
const BARK_LIGHT = 3;
const OAK_BANDS = [4, 5, 6, 7, 8];
const PINE_BANDS = [9, 10, 11, 12, 13];
// Temporary per-puff / per-tier markers while building (never left in the grid).
const MARKER = 40;

// Direction the scene's sun comes from (see lighting.ts), normalized.
const SUN = (() => {
  const [x, y, z] = [20, 30, 10];
  const len = Math.hypot(x, y, z);
  return [x / len, y / len, z / len];
})();

const CENTER = TREE_GRID[0] / 2;

interface Volume {
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
function lighting(v: Volume, x: number, y: number, z: number): number {
  const nx = (x + 0.5 - v.cx) / v.rx;
  const ny = (y + 0.5 - v.cy) / v.ry;
  const nz = (z + 0.5 - v.cz) / v.rz;
  const len = Math.hypot(nx, ny, nz) || 1;
  const sunFacing = (nx * SUN[0] + ny * SUN[1] + nz * SUN[2]) / len;
  return Math.max(-1, Math.min(1, 0.6 * ny + 0.5 * sunFacing));
}

function band(bands: readonly number[], value: number): number {
  return bands[Math.min(bands.length - 1, Math.max(0, Math.floor(((value + 1) / 2) * bands.length)))];
}

// Thick line of voxels (a branch), stamped as small spheres along the way.
function branch(grid: VoxelGrid, from: [number, number, number], to: [number, number, number], radius: number): void {
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
function trunk(grid: VoxelGrid, top: number, lean: [number, number]): [number, number] {
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

function oak(shape: number): VoxelGrid {
  const grid = createGrid(TREE_GRID);
  const rng = mulberry32(0x0a4 + shape * 7919);
  const leanDirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const trunkTop = 13 + (shape % 3);
  const [tx, tz] = trunk(grid, trunkTop, leanDirs[Math.floor(rng() * 4)]);

  // One crown puff above the trunk, and a ring of side puffs, each at the
  // end of a visible branch. Puffs sit at different heights so gaps between
  // them show the branches and give the canopy depth.
  const puffs: Volume[] = [{ cx: tx + 0.5, cy: trunkTop + 12, cz: tz + 0.5, rx: 6.5, ry: 5.2, rz: 6.5 }];
  const sideCount = 4 + Math.floor(rng() * 2);
  for (let i = 0; i < sideCount; i++) {
    const angle = (i / sideCount) * Math.PI * 2 + rng() * 0.7;
    const reach = 6.5 + rng() * 1.8;
    const r = 4.6 + rng() * 1.4;
    puffs.push({
      cx: tx + 0.5 + Math.cos(angle) * reach,
      cy: trunkTop + 4 + rng() * 5,
      cz: tz + 0.5 + Math.sin(angle) * reach,
      rx: r,
      ry: r * 0.8,
      rz: r,
    });
  }
  for (const p of puffs.slice(1)) {
    branch(grid, [tx + 0.5, trunkTop - 1, tz + 0.5], [tx + 0.5 + (p.cx - tx - 0.5) * 0.75, p.cy - 1, tz + 0.5 + (p.cz - tz - 0.5) * 0.75], 1.1);
  }

  // Each foliage voxel belongs to the puff it's most deeply inside.
  const owner = new Map<number, number>();
  forEachVoxel(grid, (x, y, z) => {
    let best = -1;
    let bestDepth = 1;
    puffs.forEach((p, i) => {
      const d = Math.hypot((x + 0.5 - p.cx) / p.rx, (y + 0.5 - p.cy) / p.ry, (z + 0.5 - p.cz) / p.rz);
      if (d <= bestDepth) {
        bestDepth = d;
        best = i;
      }
    });
    if (best >= 0) {
      setColor(grid, x, y, z, MARKER + best);
      owner.set(x + grid.size[0] * (y + grid.size[1] * z), best);
    }
  });

  puffs.forEach((p, i) => nibble(grid, rng, 0.06, Math.floor(p.cy - p.ry * 0.5), MARKER + i));
  forEachVoxel(grid, (x, y, z) => {
    const c = colorAt(grid, x, y, z);
    if (c >= MARKER) setColor(grid, x, y, z, band(OAK_BANDS, lighting(puffs[c - MARKER], x, y, z)));
  });
  return grid;
}

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
];

function pine(shape: number): VoxelGrid {
  const grid = createGrid(TREE_GRID);
  const rng = mulberry32(0x914e + shape * 104729);
  const tiers = PINE_TIERS[shape % PINE_TIERS.length];
  const [lastBase, lastHeight] = tiers[tiers.length - 1];
  const crown = lastBase + lastHeight - 1;
  const [tx, tz] = trunk(grid, crown - 3, [0, 0]);
  const cx = tx + 0.5;
  const cz = tz + 0.5;

  // Each tier is a cone whose outline is lobed (like clumps of branches)
  // rather than a perfect circle, with branch tips drooping a voxel below
  // its base. Higher tiers overwrite the top of the one below, so each
  // tier's dark skirt sits over the lighter top of the next tier down.
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
      const x = Math.floor(cx + Math.cos(angle) * radius * 1.02);
      const z = Math.floor(cz + Math.sin(angle) * radius * 1.02);
      if (base >= 1 && x >= 0 && z >= 0 && x < grid.size[0] && z < grid.size[2]) setColor(grid, x, base - 1, z, MARKER + i);
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
    setColor(grid, x, y, z, band(PINE_BANDS, lighting(tier, x, y, z)));
  });
  return grid;
}

export function buildTreeVoxels(kind: TreeKind, shape: number): VoxelGrid {
  return kind === 'oak' ? oak(shape) : pine(shape);
}
