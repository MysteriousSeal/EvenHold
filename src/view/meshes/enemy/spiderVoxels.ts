// The caves' spiders as voxel parts (model/caves/caveFoes.ts), palette first,
// silhouette first: what reads of a spider at the camera's distance is its
// legs, high-kneed and splayed, so they're thick (two voxels) and banded at
// their joints; then the round abdomen behind, the eyes burning in front.
// - a cave spider: plum-black chitin, a sheen along its back, ochre chevrons
//   down its abdomen, a cluster of ember eyes, pale fangs;
// - a hatchling: the same, soft and pale as a grub, its eyes dark beads;
// - the brood mother: near black, a crimson hourglass on her bloated abdomen,
//   pale egg-blisters bulging through its skin, bristles along its rim; long
//   legs banded red, tufted at the knees; a crown of gold eyes; great fangs
//   dripping green venom (her eyes and venom glow).
// The wolf's voxels (0.025), facing +Z; each part its own grid, to move on
// its joint: the head (cephalothorax), the abdomen behind it, a leg (built
// for the right side, out along +X: mirrored for the left), the fangs.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, setColor } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';

export const SPIDER_VOXEL = 0.025;
type Size = [number, number, number];

// Every spider's palette slots, in one order (their colours each kind's own).
const SLOTS = ['chitin', 'chitinMid', 'sheen', 'mark', 'band', 'hair', 'fang', 'eye', 'eyeDim', 'venom', 'blister'] as const;
type Slot = (typeof SLOTS)[number];
const C = Object.fromEntries(SLOTS.map((name, i) => [name, i + 1])) as Record<Slot, number>;
export const SPIDER_GLOW: ReadonlySet<number> = new Set([C.eye, C.eyeDim, C.venom]); // drawn unlit: they burn in the dark
const palette = (colors: Record<Slot, number>): number[] => SLOTS.map((s) => colors[s]);

export interface SpiderSpec {
  palette: number[];
  head: { size: Size; build: () => VoxelGrid };
  abdomen: { size: Size; build: () => VoxelGrid };
  leg: { size: Size; build: (pair: number) => VoxelGrid }; // pair 0 (front) .. 3 (back)
  fangs: { size: Size; build: () => VoxelGrid };
  hipY: number; // voxels up its leg the hip is (where the leg's built from)
  hips: Array<[number, number]>; // where each pair of legs joins the head, front first (voxels: across, along from its back)
  spread: [number, number, number, number]; // each pair's turn from straight out (radians, + toward the front)
}

// An ellipsoid filled into `g` about (cx, cy, cz), radii (rx, ry, rz), coloured by `paint` (0: left empty).
function blob(g: VoxelGrid, [cx, cy, cz]: Size, [rx, ry, rz]: Size, paint: (x: number, y: number, z: number, r: number) => number): void {
  const [sx, sy, sz] = g.size;
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) {
    const r = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + ((z + 0.5 - cz) / rz) ** 2;
    if (r > 1) continue;
    const color = paint(x, y, z, r);
    if (color) setColor(g, x, y, z, color);
  }
}

// A line of voxels from a to b (inclusive), `thick` across in z (1 or 2), coloured along it by `paint` (t: 0 at a .. 1 at b).
function limb(g: VoxelGrid, a: [number, number], b: [number, number], thick: number, paint: (t: number) => number): void {
  const steps = Math.max(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), 1);
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const [x, y] = [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t)];
    for (let z = 0; z < thick; z++) if (x >= 0 && y >= 0 && x < g.size[0] && y < g.size[1]) setColor(g, x, y, z, paint(t));
  }
}

// ---- the cave spider (and, pale, its young) ----

const HEAD: Size = [7, 5, 7];
const ABDOMEN: Size = [9, 8, 10];
const LEG: Size = [10, 7, 2];
const FANGS: Size = [5, 3, 2];

function spiderHead(): VoxelGrid {
  const g = createGrid(HEAD);
  blob(g, [3.5, 1.6, 3.5], [3.5, 3.1, 3.6], (x, y, z) => (y >= 3 && (x === 3 || z <= 2) ? C.sheen : y >= 3 ? C.chitinMid : C.chitin));
  setColor(g, 3, 3, 3, C.chitin); // the dimple on its back
  // Its eyes, on its brow: two great ones, four small round them.
  for (const [x, y] of [[2, 2], [4, 2]]) setColor(g, x, y, 6, C.eye);
  for (const [x, y, z] of [[1, 3, 5], [5, 3, 5], [2, 3, 6], [4, 3, 6]]) setColor(g, x, y, z, C.eyeDim);
  return g;
}

function spiderAbdomen(): VoxelGrid {
  const g = createGrid(ABDOMEN);
  blob(g, [4.5, 4, 5], [4.5, 4, 5], (x, y, z, r) => {
    const top = y >= 5;
    if (top && z >= 2 && z <= 8 && x !== 4 && (z + Math.abs(x - 4)) % 3 === 0) return C.mark; // a row of chevrons down its back, pointing to its head
    if (top && x === 4 && z >= 1 && z <= 8) return z % 3 === 0 ? C.mark : C.chitinMid; // its spine stripe
    if (y >= 7 && r < 0.75) return C.sheen;
    return y <= 2 ? C.chitin : C.chitinMid;
  });
  setColor(g, 4, 2, 0, C.mark); // its spinnerets, at the back (its front, toward the head, at its far z)
  return g;
}

function spiderLeg(): VoxelGrid {
  const g = createGrid(LEG);
  // Up from the hip to a high knee, along, then down to the foot: banded at its joints, a dark tip.
  limb(g, [0, 4], [3, 6], 2, (t) => (t > 0.85 ? C.band : C.chitinMid));
  limb(g, [4, 6], [5, 6], 2, () => C.chitin);
  limb(g, [6, 5], [9, 0], 1, (t) => (t < 0.15 ? C.band : t > 0.75 ? C.hair : C.chitin));
  return g;
}

function spiderFangs(): VoxelGrid {
  const g = createGrid(FANGS);
  for (const x of [0, 1, 3, 4]) {
    setColor(g, x, 2, 0, C.chitinMid);
    setColor(g, x, 2, 1, C.chitinMid);
  }
  for (const x of [1, 3]) setColor(g, x, 1, 1, C.chitin);
  for (const x of [1, 3]) setColor(g, x, 0, 1, C.fang);
  return g;
}

const SPIDER_PARTS = {
  head: { size: HEAD, build: spiderHead },
  abdomen: { size: ABDOMEN, build: spiderAbdomen },
  leg: { size: LEG, build: spiderLeg },
  fangs: { size: FANGS, build: spiderFangs },
  hipY: 4,
  hips: [[2.6, 5], [3, 3.8], [3, 2.6], [2.6, 1.4]] as Array<[number, number]>,
  spread: [0.75, 0.25, -0.25, -0.75] as [number, number, number, number],
};

export const CAVE_SPIDER: SpiderSpec = {
  ...SPIDER_PARTS,
  leg: { size: LEG, build: () => spiderLeg() },
  palette: palette({ chitin: 0x2e2430, chitinMid: 0x45363f, sheen: 0x6a5664, mark: 0xc8a060, band: 0x8a6a50, hair: 0x1e181e, fang: 0xe0d4b8, eye: 0xff6a3a, eyeDim: 0xd04a2a, venom: 0x9ad84a, blister: 0xe0d4b0 }),
};

// The young: soft, pale as a grub, the shell not yet dark; eyes like dark beads (not glowing: dim red).
export const HATCHLING: SpiderSpec = {
  ...SPIDER_PARTS,
  leg: { size: LEG, build: () => spiderLeg() },
  palette: palette({ chitin: 0xb8a68e, chitinMid: 0xcdbca2, sheen: 0xe6dac4, mark: 0xa08a70, band: 0x9a8468, hair: 0x8a7660, fang: 0xf0e8d8, eye: 0x7a1e1a, eyeDim: 0x5a1614, venom: 0x9ad84a, blister: 0xe0d4b0 }),
};

// ---- the brood mother ----

const M_HEAD: Size = [9, 7, 9];
const M_ABDOMEN: Size = [13, 12, 15];
const M_LEG: Size = [14, 10, 2];
const M_FANGS: Size = [7, 5, 3];

function motherHead(): VoxelGrid {
  const g = createGrid(M_HEAD);
  blob(g, [4.5, 2.4, 4.5], [4.5, 3.6, 4.6], (x, y, z) => (y >= 4 && (x === 4 || z <= 2) ? C.sheen : y >= 4 ? C.chitinMid : C.chitin));
  // Two horns of chitin over her brow, her crown of eyes under them: two great gold ones, six round them.
  for (const x of [2, 6]) [setColor(g, x, 5, 7, C.chitinMid), setColor(g, x, 6, 7, C.band)];
  for (const [x, y] of [[3, 3], [5, 3]]) [setColor(g, x, y, 8, C.eye), setColor(g, x, y + 1, 8, C.eye)];
  for (const [x, y, z] of [[2, 4, 8], [6, 4, 8], [1, 3, 7], [7, 3, 7], [4, 5, 8], [4, 2, 8]]) setColor(g, x, y, z, C.eyeDim);
  return g;
}

function motherAbdomen(): VoxelGrid {
  const g = createGrid(M_ABDOMEN);
  const [cx, cy, cz] = [6.5, 6.2, 7.5];
  blob(g, [cx, cy, cz], [6.5, 5.8, 7.5], (x, y, z, r) => {
    const top = y >= 8;
    // The crimson hourglass on her back: wide fore and aft, pinched in the middle.
    const half = 2.2 - 1.6 * Math.sin((Math.PI * (z - 3)) / 9);
    if (top && z >= 3 && z <= 12 && Math.abs(x + 0.5 - cx) <= Math.max(0.6, half)) return C.mark;
    // Egg-blisters bulging through the skin, pale, here and there on her flanks (the same every time).
    if (r > 0.72 && y >= 3 && hashUnit(x * 3 + Math.floor(z / 2), Math.floor(y / 2), 517) < 0.09) return C.blister;
    if (r > 0.85 && y === Math.round(cy) && (x + z) % 2 === 0) return C.hair; // bristles round her rim
    if (y >= 10 && r < 0.7) return C.sheen;
    return y <= 3 ? C.chitin : C.chitinMid;
  });
  // The blisters stand proud: a voxel more out from the skin where they are.
  for (let x = 0; x < M_ABDOMEN[0]; x++) for (let z = 0; z < M_ABDOMEN[2]; z++) {
    if (hashUnit(x, z, 518) > 0.06) continue;
    const y = 6 + Math.floor(hashUnit(z, x, 519) * 4);
    const out = x < cx ? -1 : 1;
    let edge = Math.round(cx);
    while (edge >= 0 && edge < M_ABDOMEN[0] && g.cells[edge + M_ABDOMEN[0] * (y + M_ABDOMEN[1] * z)]) edge += out;
    if (edge >= 0 && edge < M_ABDOMEN[0]) setColor(g, edge, y, z, C.blister);
  }
  setColor(g, 6, 3, 0, C.mark); // her spinnerets
  setColor(g, 7, 3, 0, C.mark);
  return g;
}

function motherLeg(pair: number): VoxelGrid {
  const g = createGrid(M_LEG);
  const reach = pair === 0 ? 13 : pair === 3 ? 12 : 11; // (her fore and hind legs the longest)
  limb(g, [0, 6], [5, 9], 2, (t) => (t > 0.85 ? C.band : C.chitinMid));
  limb(g, [6, 9], [7, 9], 2, () => C.band);
  limb(g, [8, 8], [reach, 0], 2, (t) => (t < 0.12 ? C.band : t > 0.55 && t < 0.62 ? C.band : t > 0.85 ? C.hair : C.chitin));
  // Tufts of bristles at her knees, over the bands.
  for (const x of [5, 8]) setColor(g, x, 9, 0, C.hair);
  return g;
}

function motherFangs(): VoxelGrid {
  const g = createGrid(M_FANGS);
  for (const x of [0, 1, 2, 4, 5, 6]) for (const z of [0, 1, 2]) setColor(g, x, 4, z, C.chitinMid);
  for (const x of [1, 5]) {
    setColor(g, x, 3, 2, C.chitin);
    setColor(g, x, 2, 2, C.fang);
    setColor(g, x, 1, 2, C.fang);
    setColor(g, x, 0, 2, C.venom); // a drop of venom, glowing, at each tip
  }
  return g;
}

export const BROOD_MOTHER: SpiderSpec = {
  palette: palette({ chitin: 0x241a22, chitinMid: 0x38242f, sheen: 0x5e3e52, mark: 0xc8322a, band: 0x9a3a30, hair: 0x140e12, fang: 0xece0c4, eye: 0xffc040, eyeDim: 0xe08a2a, venom: 0x9ae84a, blister: 0xe2d6b2 }),
  head: { size: M_HEAD, build: motherHead },
  abdomen: { size: M_ABDOMEN, build: motherAbdomen },
  leg: { size: M_LEG, build: motherLeg },
  fangs: { size: M_FANGS, build: motherFangs },
  hipY: 6,
  hips: [[3.4, 6.6], [3.9, 5], [3.9, 3.4], [3.4, 1.8]],
  spread: [0.8, 0.28, -0.28, -0.8],
};
