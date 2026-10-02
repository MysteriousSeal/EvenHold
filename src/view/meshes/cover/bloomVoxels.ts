// Wildflowers of the meadow patches (groundCoverScatter.ts: blooms), a few
// voxels each at the ground cover's scale, swaying with the grass: poppies
// (a red cup round a dark heart), bluebells (bells nodding off an arched
// stem), oxeye daisies (white round a gold eye), buttercups (a small gold
// cup), foxgloves (a tall spike of pink bells, darker spots in them),
// lavender (a tuft of purple spikes), clover (a low trefoil, a pink-white
// head). Petal colours that sit with the grass greens; each in a few shapes.

import { createGrid, setColor } from '../voxel/voxelShapes';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { mulberry32 } from '../../../util/random';
import { BLOOMS, type BloomKind } from '../../../model/scenery/meadowPatches';

const ENTRIES = {
  stem: 0x4d7a3a,
  stemLight: 0x6e9a48,
  leaf: 0x3f6e33,
  poppy: 0xd8402e,
  poppyDeep: 0xa82a22,
  heartDark: 0x2a2220,
  bell: 0x5a6fd0,
  bellDeep: 0x4252a8,
  white: 0xf3efe2,
  gold: 0xf0c03a,
  buttercup: 0xf4d44a,
  buttercupDeep: 0xd6a92a,
  foxglove: 0xd88bc0,
  foxgloveDeep: 0xb0619a,
  fleck: 0x6a2e58,
  lavender: 0x9a7ad0,
  lavenderDeep: 0x7656ac,
  clover: 0xe8b8c8,
  cloverDeep: 0xc88aa4,
} as const;
export const BLOOM_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;

export const BLOOM_KINDS: readonly BloomKind[] = BLOOMS; // (where each grows: model/scenery/meadowPatches.ts)
export const BLOOM_SHAPES = 3; // shapes of each
export const BLOOM_GRID: [number, number, number] = [7, 14, 7];
const M = 3; // the grid's middle, across

// A stem from the ground up `high` voxels, kinked `lean` over at the top; where it ends.
function stem(g: VoxelGrid, high: number, lean: number, x = M, z = M): [number, number, number] {
  for (let y = 0; y < high; y++) setColor(g, x + (y >= high - 2 ? lean : 0), y, z, y < 2 ? C.stem : C.stemLight);
  return [x + lean, high - 1, z];
}
const leaf = (g: VoxelGrid, x: number, y: number, z: number) => setColor(g, x, y, z, C.leaf);

const BUILD: Record<BloomKind, (g: VoxelGrid, s: number, rng: () => number) => void> = {
  poppy: (g, s) => {
    const [x, y, z] = stem(g, 6 + s, s === 1 ? 1 : 0);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) setColor(g, x + dx, y + 1, z + dz, C.poppy);
    for (const [dx, dz] of [[-1, -1], [1, 1]]) setColor(g, x + dx, y + 1, z + dz, C.poppyDeep);
    setColor(g, x, y + 1, z, C.heartDark);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) setColor(g, x + dx, y + 2, z + dz, C.poppy); // its cup's rim
    leaf(g, M + 1, 1, M);
  },
  bluebell: (g, s) => {
    // An arched stem, the bells hanging down along its bend.
    const lean = s === 2 ? -1 : 1;
    for (let y = 0; y < 7; y++) setColor(g, M, y, M, C.stem);
    for (let i = 1; i <= 3; i++) setColor(g, M + lean * i, 7 - (i === 3 ? 1 : 0), M, C.stem);
    for (let i = 1; i <= 3; i++) {
      const bx = M + lean * i;
      setColor(g, bx, 5 - (i === 3 ? 1 : 0), M, C.bell);
      setColor(g, bx, 4 - (i === 3 ? 1 : 0), M, i % 2 ? C.bellDeep : C.bell);
    }
    leaf(g, M - lean, 1, M);
    leaf(g, M - lean, 2, M + 1);
  },
  daisy: (g, s) => {
    const [x, y, z] = stem(g, 4 + s, 0);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) setColor(g, x + dx, y + 1, z + dz, C.white);
    setColor(g, x, y + 1, z, C.gold);
    setColor(g, x, y + 2, z, C.gold);
  },
  buttercup: (g, s) => {
    const [x, y, z] = stem(g, 3 + s, s === 2 ? 1 : 0);
    setColor(g, x, y + 1, z, C.buttercupDeep);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) setColor(g, x + dx, y + 2, z + dz, C.buttercup);
    leaf(g, M - 1, 0, M);
  },
  foxglove: (g, s) => {
    // A tall spike, bells on one side of it down its upper half, smaller to its tip.
    const high = 10 + s;
    for (let y = 0; y < high; y++) setColor(g, M, y, M, C.stem);
    for (let y = Math.floor(high / 2); y < high - 1; y++) {
      const c = (y + s) % 3 === 0 ? C.foxgloveDeep : C.foxglove;
      setColor(g, M, y, M + 1, c);
      if (y < high - 3) setColor(g, M + ((y % 2) ? 1 : -1), y, M + 1, C.foxglove);
      if (y % 3 === 1) setColor(g, M, y, M + 2, C.fleck);
    }
    setColor(g, M, high, M, C.foxgloveDeep);
    for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1]]) leaf(g, M + dx, 0, M + dz);
  },
  lavender: (g, s, rng) => {
    // A tuft of thin stems, each topped with a short purple spike.
    const spikes = 3 + s;
    for (let i = 0; i < spikes; i++) {
      const [x, z] = [1 + Math.floor(rng() * 5), 1 + Math.floor(rng() * 5)];
      const high = 4 + Math.floor(rng() * 3);
      for (let y = 0; y < high; y++) setColor(g, x, y, z, C.stemLight);
      for (let y = high; y < high + 3; y++) setColor(g, x, y, z, y === high + 2 ? C.lavender : (y + i) % 2 ? C.lavenderDeep : C.lavender);
    }
  },
  clover: (g, s) => {
    // Low leaves in threes, a round pink head on a short stalk.
    for (const [dx, dz] of [[-1, 0], [0, -1], [-1, -1], [1, 1], [2, 1], [1, 2]]) leaf(g, M + dx, 0, M + dz);
    const [x, y, z] = stem(g, 2 + s, 0);
    for (const [dx, dz] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]]) setColor(g, x + dx, y + 1, z + dz, (dx + dz) % 2 ? C.cloverDeep : C.clover);
    setColor(g, x, y + 2, z, C.clover);
  },
};

export function buildBloom(kind: BloomKind, shape: number): VoxelGrid {
  const g = createGrid(BLOOM_GRID);
  BUILD[kind](g, shape, mulberry32(0xb100 + BLOOM_KINDS.indexOf(kind) * 97 + shape * 13));
  return g;
}
