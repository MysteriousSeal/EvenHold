// The village well as a voxel model at the world's 0.04 scale, palette
// first (warm sandstone to sit on the squares, lake turquoise for the
// water, the houses' clay tiles and timber), then shape:
// - a square stone well-head in running-bond courses, mortar recessed a
//   voxel, a pale overhanging coping and moss creeping up the base;
// - turquoise water inside with crest and glint voxels, like the lakes;
// - two timber posts, a windlass axle wrapped in rope with an iron crank,
//   and a banded bucket hanging over the water;
// - a stepped clay-tile gable roof with a timber ridge;
// - a lantern on an iron bracket, its glass meshed with the glowing material.
// Square and grid-aligned throughout, no diagonals.

import { mulberry32 } from '../../../util/random';
import { HOUSE_ROOF_COLORS, HOUSE_WINDOW_COLOR, IRON_COLOR, WATER_COLORS } from '../../constants';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { colorAt, createGrid, fillBox, setColor } from '../voxel/voxelShapes';

export const WELL_VOXEL_SIZE = 0.04;
const W = 21; // voxels across (0.84), centered on the tile
export const WELL_GRID: [number, number, number] = [W, 34, W];

const ENTRIES = {
  stone: 0xc9ad85,
  stoneLight: 0xdcc49c,
  stoneDark: 0xa88c66,
  mortar: 0x8d7254,
  coping: 0xe3cfa8,
  moss: 0x6f9148,
  mossLight: 0x88a955,
  water: WATER_COLORS.deep,
  waterMid: WATER_COLORS.mid,
  crest: WATER_COLORS.crest,
  glint: 0xf4fbf5,
  timber: 0x5a3a22,
  timberLight: 0x76502f,
  timberDark: 0x3e2818,
  rope: 0xc2a26b,
  ropeDark: 0x9c804f,
  iron: IRON_COLOR,
  bucket: 0x8a6238,
  roof: HOUSE_ROOF_COLORS[0],
  roofLight: 0xb65c3c,
  roofDark: 0x7a3826,
  glass: HOUSE_WINDOW_COLOR,
} as const;

export const WELL_PALETTE: number[] = Object.values(ENTRIES);
const C = Object.fromEntries(Object.keys(ENTRIES).map((name, i) => [name, i + 1])) as Record<keyof typeof ENTRIES, number>;
export const WELL_GLOWING = new Set([C.glass]);

const WALL_OUT = [2, 18]; // stone well-head, inclusive
const WALL_IN = [5, 15]; // open shaft
const WALL_TOP = 8;
const POST_X = [
  [2, 3],
  [17, 18],
];
const POST_Z = [9, 10];
const AXLE_Y = 22;
const EAVE_Y = 27;

export function buildWellVoxels(): VoxelGrid {
  const grid = createGrid(WELL_GRID);
  const rng = mulberry32(0x3e11);
  const [o0, o1] = WALL_OUT;
  const [i0, i1] = WALL_IN;

  // Well-head: courses two voxels high, stones 3-5 long, alternate courses
  // offset (running bond). Mortar joints on the outer face are recessed.
  for (let y = 0; y <= WALL_TOP; y++) {
    const course = Math.floor(y / 2);
    const bed = y % 2 === 1 && y < WALL_TOP; // top voxel row of a course is followed by a mortar line
    for (let x = o0; x <= o1; x++) {
      for (let z = o0; z <= o1; z++) {
        const inShaft = x >= i0 && x <= i1 && z >= i0 && z <= i1;
        if (inShaft) continue;
        const outer = x === o0 || x === o1 || z === o0 || z === o1;
        const along = x === o0 || x === o1 ? z : x;
        const joint = (along + course * 2) % 4 === 0;
        if (outer && (joint || (bed && (along + course) % 5 === 0))) continue; // recessed mortar
        const tone = (along * 7 + course * 13) % 5;
        let color = tone === 0 ? C.stoneDark : tone === 1 ? C.stoneLight : C.stone;
        if (!outer) color = C.mortar;
        if (outer && y <= 1 + Math.floor(rng() * 3) && rng() < 0.45) color = rng() < 0.5 ? C.moss : C.mossLight;
        setColor(grid, x, y, z, color);
      }
    }
  }
  // Recessed joints: fill one voxel in with mortar so they read as grooves, not holes.
  for (let y = 0; y <= WALL_TOP; y++) {
    for (let x = o0 + 1; x < o1; x++) {
      for (const [a, b] of [
        [x, o0 + 1],
        [x, o1 - 1],
        [o0 + 1, x],
        [o1 - 1, x],
      ]) {
        if (colorAt(grid, a, y, b) === 0 && !(a >= i0 && a <= i1 && b >= i0 && b <= i1)) setColor(grid, a, y, b, C.mortar);
      }
    }
  }
  // Coping: a pale cap one voxel proud all round, with moss in a corner.
  for (let x = o0 - 1; x <= o1 + 1; x++) {
    for (let z = o0 - 1; z <= o1 + 1; z++) {
      if (x >= i0 && x <= i1 && z >= i0 && z <= i1) continue;
      setColor(grid, x, WALL_TOP + 1, z, (x + z) % 6 === 0 ? C.stoneLight : C.coping);
    }
  }
  fillBox(grid, o0 - 1, WALL_TOP + 1, o0 - 1, o0, WALL_TOP + 1, o0 + 1, C.moss);

  // Water a few voxels below the rim: deep teal with crests and a glint.
  for (let x = i0; x <= i1; x++) {
    for (let z = i0; z <= i1; z++) {
      const roll = rng();
      setColor(grid, x, 5, z, roll < 0.12 ? C.crest : roll < 0.4 ? C.waterMid : C.water);
    }
  }
  setColor(grid, i0 + 2, 5, i0 + 3, C.glint);
  setColor(grid, i1 - 3, 5, i1 - 1, C.glint);

  // Posts, standing on the coping, with a darker foot and lighter sunward faces.
  for (const [x0, x1] of POST_X) {
    for (let y = WALL_TOP + 2; y < EAVE_Y; y++) {
      for (let x = x0; x <= x1; x++) {
        for (let z = POST_Z[0]; z <= POST_Z[1]; z++) {
          const sunward = x === x1 || z === POST_Z[1];
          setColor(grid, x, y, z, y === WALL_TOP + 2 ? C.timberDark : sunward ? C.timberLight : C.timber);
        }
      }
    }
  }
  // Windlass axle between the posts, rope wound around its middle, and a
  // crank sticking out past the right post (an L of iron).
  for (let x = POST_X[0][1] + 1; x < POST_X[1][0]; x++) setColor(grid, x, AXLE_Y, 10, C.timberLight);
  for (let x = 8; x <= 12; x++) {
    for (const [y, z] of [
      [AXLE_Y + 1, 10],
      [AXLE_Y - 1, 10],
      [AXLE_Y, 9],
      [AXLE_Y, 11],
    ]) {
      setColor(grid, x, y, z, x % 2 === 0 ? C.rope : C.ropeDark);
    }
  }
  setColor(grid, 19, AXLE_Y, 10, C.iron);
  setColor(grid, 20, AXLE_Y, 10, C.iron);
  setColor(grid, 20, AXLE_Y - 1, 10, C.iron);
  setColor(grid, 20, AXLE_Y - 2, 10, C.iron);

  // Rope down to a banded bucket hanging over the water.
  for (let y = 15; y < AXLE_Y - 1; y++) setColor(grid, 10, y, 10, y % 2 === 0 ? C.rope : C.ropeDark);
  fillBox(grid, 9, 11, 9, 11, 14, 11, C.bucket);
  fillBox(grid, 9, 12, 9, 11, 12, 11, C.iron);
  setColor(grid, 10, 14, 10, C.water); // water in the bucket
  setColor(grid, 10, 15, 9, C.iron); // handle
  setColor(grid, 10, 15, 11, C.iron);

  // Roof: a stepped gable, ridge running along X. Each course steps in two
  // voxels and up one; courses alternate light and base tiles, the eave
  // course is dark, and a timber ridge caps it.
  for (let s = 0; s <= 5; s++) {
    const y = EAVE_Y + s;
    const zLo = s * 2 - 1;
    const zHi = W - s * 2;
    for (let x = 0; x < W; x++) {
      for (let z = Math.max(0, zLo); z <= Math.min(W - 1, zHi); z++) {
        const edge = z <= zLo + 1 || z >= zHi - 1 || s === 5;
        if (!edge && s < 5) continue; // shell only, open underneath
        const tile = s === 0 ? C.roofDark : (s + (x % 4 < 2 ? 0 : 1)) % 2 === 0 ? C.roofLight : C.roof;
        setColor(grid, x, y, z, tile);
      }
    }
  }
  for (let x = 0; x < W; x++) setColor(grid, x, EAVE_Y + 6, 10, C.timber);
  // Gable-end beams under the roof, on top of the posts.
  for (let z = 3; z <= 17; z++) {
    setColor(grid, 2, EAVE_Y - 1, z, C.timberDark);
    setColor(grid, 18, EAVE_Y - 1, z, C.timberDark);
  }

  // Lantern on an iron bracket off the left post's front face.
  setColor(grid, 2, 24, 11, C.iron);
  setColor(grid, 2, 24, 12, C.iron);
  setColor(grid, 2, 23, 13, C.iron);
  fillBox(grid, 2, 20, 13, 3, 22, 14, C.glass);
  fillBox(grid, 2, 19, 13, 3, 19, 14, C.iron);
  setColor(grid, 2, 23, 14, C.iron);
  return grid;
}
