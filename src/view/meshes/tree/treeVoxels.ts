// Voxel tree models, at the same voxel scale as the bushes. Built
// silhouette-first: oaks are several separate leaf puffs on visible
// branches over a flared, slightly leaning trunk; pines are lobed, drooping
// tiers; birches are slender white trunks with small airy puffs climbing
// them. Foliage is dithered per voxel (so leaves read as texture), lit
// where open to the sky and kept dark on the undersides. The key to making them read as volumes is shading each puff/tier
// on its own — dark underside, warm highlight on the side facing the sun —
// rather than one gradient over the whole tree.

import type { TreeKind } from '../../../model/types';
import { mulberry32 } from '../../../util/random';
import { SUN_DIRECTION } from '../../constants';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, forEachVoxel, nibble, setColor } from '../voxel/voxelShapes';

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
const OAK_BANDS = [4, 5, 6, 7, 8, 18, 19];
const BIRCH_BARK = 20;
const BIRCH_BARK_SHADE = 21;
const BIRCH_MARK = 22;
const BIRCH_BANDS = [23, 24, 25, 26, 27, 28];
const LEAF_DITHER = 0.2;
const PINE_BANDS = [9, 10, 11, 12, 13, 14, 15];
const PINE_TIP = 16;
const PINE_CONE = 17;
const PINE_DITHER = 0.22; // per-voxel jitter of the shade, so needles read as texture
// Temporary per-puff / per-tier markers while building (never left in the grid).
const MARKER = 40;

// Direction the scene's sun comes from, so baked shading matches the lighting.
const SUN = SUN_DIRECTION.toArray();

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
  shadeFoliage(grid, rng, puffs, OAK_BANDS);
  return grid;
}

// Colors every marked foliage voxel by its puff's lighting, dithered, lit
// where open to the sky and darkened on the underside.
function shadeFoliage(grid: VoxelGrid, rng: () => number, puffs: Volume[], bands: readonly number[]): void {
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

// Birch: a slender 2x2 white trunk with dark bark marks and a gentle kink,
// small leaf puffs climbing it on alternating sides, and one on top.
function birch(shape: number): VoxelGrid {
  const grid = createGrid(TREE_GRID);
  const rng = mulberry32(0xb1c4 + shape * 15485863);
  const height = 27 + (shape % 3) * 2;
  const base = Math.floor(CENTER) - 1;
  const kink: [number, number] = [[1, 0], [0, 1], [-1, 0]][shape % 3] as [number, number];
  let [ox, oz] = [0, 0];
  for (let y = 0; y <= height; y++) {
    if (y === Math.floor(height * 0.6)) [ox, oz] = kink;
    const markRow = rng() < 0.28;
    for (let dx = 0; dx < 2; dx++) {
      for (let dz = 0; dz < 2; dz++) {
        const sunward = dx === 1 || dz === 1;
        const mark = markRow && rng() < 0.6;
        setColor(grid, base + dx + ox, y, base + dz + oz, y === 0 || mark ? BIRCH_MARK : sunward ? BIRCH_BARK : BIRCH_BARK_SHADE);
      }
    }
  }
  const tx = base + 1 + ox;
  const tz = base + 1 + oz;

  const puffs: Volume[] = [{ cx: tx, cy: height + 2, cz: tz, rx: 4, ry: 4.2, rz: 4 }];
  const count = 5 + Math.floor(rng() * 2);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.4 + rng() * 0.5; // golden-angle spiral around the trunk
    const reach = 3 + rng() * 1.5;
    const r = 3 + rng() * 1.1;
    const cy = 13 + ((height - 12) * i) / count + rng() * 2;
    const p = { cx: tx + Math.cos(angle) * reach, cy, cz: tz + Math.sin(angle) * reach, rx: r, ry: r * 1.15, rz: r };
    puffs.push(p);
    branch(grid, [tx, cy - 3, tz], [p.cx, p.cy - 1, p.cz], 0.6);
  }
  forEachVoxel(grid, (x, y, z) => {
    if (colorAt(grid, x, y, z) !== 0) return;
    const i = puffs.findIndex((p) => Math.hypot((x + 0.5 - p.cx) / p.rx, (y + 0.5 - p.cy) / p.ry, (z + 0.5 - p.cz) / p.rz) <= 1);
    if (i >= 0) setColor(grid, x, y, z, MARKER + i);
  });
  puffs.forEach((p, i) => nibble(grid, rng, 0.12, Math.floor(p.cy - p.ry), MARKER + i)); // airy, see-through crowns
  shadeFoliage(grid, rng, puffs, BIRCH_BANDS);
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

export function buildTreeVoxels(kind: TreeKind, shape: number): VoxelGrid {
  return kind === 'oak' ? oak(shape) : kind === 'birch' ? birch(shape) : pine(shape);
}
