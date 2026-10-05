// Voxel tree models, at the same voxel scale as the bushes. Built
// silhouette-first: oaks are several separate leaf puffs on visible
// branches over a flared, slightly leaning trunk; pines are lobed, drooping
// tiers; birches are slender white trunks with small airy puffs climbing
// them. Six shapes of each (TREE_SHAPES), each of the last three its own
// outline: a spreading oak, a tall narrow one, a lopsided one; a spruce, a
// broad fir, a windswept pine; a twin-stemmed birch, a tall bare one, a young
// bushy one. Foliage is dithered per voxel (so leaves read as texture), lit
// where open to the sky and kept dark on the undersides. The key to making them read as volumes is shading each puff/tier
// on its own — dark underside, warm highlight on the side facing the sun —
// rather than one gradient over the whole tree.

import type { TreeKind } from '../../../model/types';
import { mulberry32 } from '../../../util/random';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, forEachVoxel, nibble, setColor } from '../voxel/voxelShapes';
import { BIRCH_BANDS, BIRCH_BARK, BIRCH_BARK_SHADE, BIRCH_MARK, CENTER, MARKER, OAK_BANDS, TREE_GRID, branch, shadeFoliage, trunk, type Volume } from './treeParts';
import { pine } from './pineVoxels';

export { TREE_GRID, TREE_PALETTE, TREE_VOXEL_SIZE } from './treeParts';

// Oaks past the first three (OAK_FORMS[shape - 3]), each its own outline at a glance: broad and spreading (a short
// trunk under a low crown far wider than it's tall), tall and narrow (puffs stacked up a long trunk), and lopsided
// (the crown thrown out to one side, reaching for the light). `arc`: how much of the way round the side puffs go,
// centred on the trunk's lean; `shift`: the top puff moved that way too.
interface OakForm {
  trunk: number;
  crown: { up: number; rx: number; ry: number; shift: number };
  sides: [number, number]; // how many: at least, and how many more at most
  reach: [number, number]; // out from the trunk: at least, and how much more
  r: [number, number];
  rise: [number, number]; // over the trunk's top
  flat: number; // a side puff's height to its width
  arc: number;
}
const OAK_FORMS: OakForm[] = [
  { trunk: 10, crown: { up: 10, rx: 7.2, ry: 4.4, shift: 0 }, sides: [6, 2], reach: [7.6, 0.8], r: [4, 0.8], rise: [2, 3], flat: 0.6, arc: 1 },
  { trunk: 16, crown: { up: 13, rx: 4.4, ry: 5, shift: 0 }, sides: [4, 2], reach: [3.4, 0.8], r: [3.8, 0.8], rise: [-2, 12], flat: 0.95, arc: 1 },
  { trunk: 12, crown: { up: 10, rx: 5.4, ry: 4.6, shift: 3 }, sides: [4, 1], reach: [6.2, 1.6], r: [4.2, 1], rise: [2, 6], flat: 0.8, arc: 0.45 },
];

function oak(shape: number): VoxelGrid {
  if (shape >= 3) return formedOak(OAK_FORMS[(shape - 3) % OAK_FORMS.length], shape);
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
  return leafOak(grid, rng, puffs, tx, tz, trunkTop);
}

// An oak of one of OAK_FORMS.
function formedOak(form: OakForm, shape: number): VoxelGrid {
  const grid = createGrid(TREE_GRID);
  const rng = mulberry32(0x0a4 + shape * 7919);
  const leanDirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const lean = leanDirs[Math.floor(rng() * 4)];
  const [tx, tz] = trunk(grid, form.trunk, lean);
  const toward = Math.atan2(lean[1], lean[0]); // (the way it leans: a lopsided crown thrown that way)
  const { crown } = form;
  const puffs: Volume[] = [{ cx: tx + 0.5 + lean[0] * crown.shift, cy: form.trunk + crown.up, cz: tz + 0.5 + lean[1] * crown.shift, rx: crown.rx, ry: crown.ry, rz: crown.rx }];
  const count = form.sides[0] + Math.floor(rng() * (form.sides[1] + 1));
  for (let i = 0; i < count; i++) {
    const angle = toward + ((i + 0.5) / count - 0.5) * form.arc * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const reach = form.reach[0] + rng() * form.reach[1];
    const r = form.r[0] + rng() * form.r[1];
    puffs.push({ cx: tx + 0.5 + Math.cos(angle) * reach, cy: form.trunk + form.rise[0] + rng() * form.rise[1], cz: tz + 0.5 + Math.sin(angle) * reach, rx: r, ry: r * form.flat, rz: r });
  }
  return leafOak(grid, rng, puffs, tx, tz, form.trunk);
}

// An oak's leaves: each side puff on a branch out from the trunk's top, then every foliage voxel its puff's (the one
// it's most deeply inside), nibbled, and shaded puff by puff.
function leafOak(grid: VoxelGrid, rng: () => number, puffs: Volume[], tx: number, tz: number, trunkTop: number): VoxelGrid {
  for (const p of puffs.slice(1)) {
    branch(grid, [tx + 0.5, trunkTop - 1, tz + 0.5], [tx + 0.5 + (p.cx - tx - 0.5) * 0.75, p.cy - 1, tz + 0.5 + (p.cz - tz - 0.5) * 0.75], 1.1);
  }
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
    if (best >= 0) setColor(grid, x, y, z, MARKER + best);
  });

  puffs.forEach((p, i) => nibble(grid, rng, 0.06, Math.floor(p.cy - p.ry * 0.5), MARKER + i));
  shadeFoliage(grid, rng, puffs, OAK_BANDS);
  return grid;
}

// Birch: a slender 2x2 white trunk with dark bark marks and a gentle kink,
// small leaf puffs climbing it on alternating sides, and one on top.
function birch(shape: number): VoxelGrid {
  if (shape >= 3) return formedBirch(shape);
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

// Birches past the first three, each its own outline: twin-stemmed (two trunks forking from one foot, each with its
// own crown), tall with its leaves only up top (a long bare white trunk), and young and bushy (short, leafy from low).
// Each stem: where its foot is (off the grid's middle), how tall, which way it kinks, and its puffs (how many, from how
// high up it, how far out, how big).
interface BirchStem {
  at: [number, number];
  height: number;
  kink: [number, number];
  puffs: number;
  from: number; // a share of its height
  reach: [number, number];
  r: [number, number];
}
const BIRCH_FORMS: BirchStem[][] = [
  [
    { at: [-4, -1], height: 26, kink: [-1, 0], puffs: 4, from: 0.45, reach: [2.6, 1.2], r: [2.8, 0.9] },
    { at: [3, 2], height: 21, kink: [1, 1], puffs: 3, from: 0.45, reach: [2.6, 1.2], r: [2.8, 0.9] },
  ],
  [{ at: [0, 0], height: 31, kink: [0, 1], puffs: 5, from: 0.62, reach: [2.6, 1], r: [3.4, 1] }],
  [{ at: [0, 0], height: 18, kink: [1, 0], puffs: 6, from: 0.3, reach: [2.6, 1.4], r: [3.2, 1] }],
];

// A birch of one of BIRCH_FORMS: each stem a slender 2x2 white trunk with dark marks and its kink, its puffs climbing
// it on alternating sides (from `from` of its height up), one on its top.
function formedBirch(shape: number): VoxelGrid {
  const grid = createGrid(TREE_GRID);
  const rng = mulberry32(0xb1c4 + shape * 15485863);
  const base = Math.floor(CENTER) - 1;
  const puffs: Volume[] = [];
  for (const stem of BIRCH_FORMS[(shape - 3) % BIRCH_FORMS.length]) {
    const [x0, z0] = [base + stem.at[0], base + stem.at[1]];
    let [ox, oz] = [0, 0];
    for (let y = 0; y <= stem.height; y++) {
      if (y === Math.floor(stem.height * 0.6)) [ox, oz] = stem.kink;
      const markRow = rng() < 0.28;
      for (let dx = 0; dx < 2; dx++) {
        for (let dz = 0; dz < 2; dz++) {
          const sunward = dx === 1 || dz === 1;
          setColor(grid, x0 + dx + ox, y, z0 + dz + oz, y === 0 || (markRow && rng() < 0.6) ? BIRCH_MARK : sunward ? BIRCH_BARK : BIRCH_BARK_SHADE);
        }
      }
    }
    const [tx, tz] = [x0 + 1 + ox, z0 + 1 + oz];
    puffs.push({ cx: tx, cy: stem.height + 2, cz: tz, rx: 4, ry: 4.2, rz: 4 });
    const low = stem.height * stem.from;
    for (let i = 0; i < stem.puffs; i++) {
      const angle = i * 2.4 + rng() * 0.5; // golden-angle spiral around the trunk
      const reach = stem.reach[0] + rng() * stem.reach[1];
      const r = stem.r[0] + rng() * stem.r[1];
      const cy = low + ((stem.height - low) * i) / stem.puffs + rng() * 2;
      const p = { cx: tx + Math.cos(angle) * reach, cy, cz: tz + Math.sin(angle) * reach, rx: r, ry: r * 1.15, rz: r };
      puffs.push(p);
      branch(grid, [tx, cy - 3, tz], [p.cx, p.cy - 1, p.cz], 0.6);
    }
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

export function buildTreeVoxels(kind: TreeKind, shape: number): VoxelGrid {
  return kind === 'oak' ? oak(shape) : kind === 'birch' ? birch(shape) : pine(shape);
}
