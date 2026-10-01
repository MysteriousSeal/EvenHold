// A crypt's lord (model/crypts/cryptLord.ts): the skeleton's body
// (skeletonVoxels.ts) made royal, on the same joints, drawn half again as
// big as his guards. Palette first: bone; gold and its shade; a deep plum
// mantle and its folds; dark iron; a red glow in his sockets. Shapes for the
// camera's distance: a gold crown on the skull, its spikes standing up, a red
// stone in its band; a tattered mantle down his back and over his shoulders,
// open at the chest (the ribs showing), a gold clasp; heavy iron pauldrons
// rimmed in gold; and a greatsword in his right hand, its blade rusted.

import * as THREE from 'three';
import type { BodyPart } from '../human/bodyVoxels';
import { BODIES, HELD_VOXEL_SIZE, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import type { Frame } from '../human/humanRig';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { PARTS, SKELETON_PALETTE } from './skeletonVoxels';

// The skeleton's four (bone, shade, cracks, dark), then the lord's own.
export const LORD_PALETTE = [...SKELETON_PALETTE, 0xe0b040, 0x9a6e1c, 0x5a2440, 0x3a1428, 0x6e7276, 0x45484c, 0xff5a32, 0xc8202a];
const [GOLD, GOLD_DARK, MANTLE, FOLD, IRON, IRON_DARK, EYE, JEWEL] = [5, 6, 7, 8, 9, 10, 11, 12];

// The skeleton's part, painted into a bigger grid `by` voxels in from its corner.
function boneIn(part: BodyPart, grid: VoxelGrid, by: [number, number, number]): void {
  const bones = createGrid(BODIES.male.grid[part]);
  PARTS[part](bones);
  const [sx, sy, sz] = bones.size;
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) {
    const c = bones.cells[x + sx * (y + sy * z)];
    if (c) fillBox(grid, x + by[0], y + by[1], z + by[2], x + by[0], y + by[1], z + by[2], c);
  }
}

const LORD_PARTS: Record<BodyPart, { size: [number, number, number]; by: [number, number, number]; paint(g: VoxelGrid): void }> = {
  // The skull, crowned: a gold band round its top, spikes standing up, a red stone in front; its sockets glowing.
  head: {
    size: [11, 15, 11],
    by: [0, 0, 0],
    paint: (g) => {
      fillBox(g, 2, 5, 9, 3, 6, 9, EYE);
      fillBox(g, 6, 5, 9, 7, 6, 9, EYE);
      for (let x = 1; x <= 9; x++) for (let z = 1; z <= 9; z++) {
        const rim = x === 1 || x === 9 || z === 1 || z === 9;
        if (!rim) continue;
        fillBox(g, x, 10, z, x, 11, z, (x + z) % 4 === 0 ? GOLD_DARK : GOLD);
        if ((x + z) % 4 === 2) fillBox(g, x, 12, z, x, 13 + ((x * 3 + z) % 2), z, GOLD); // a spike
      }
      fillBox(g, 4, 10, 9, 6, 11, 9, JEWEL);
    },
  },
  // The ribs under a mantle: down the back (its hem ragged), over the shoulders, open at the front, a clasp.
  torso: {
    size: [11, 9, 7],
    by: [1, 0, 1],
    paint: (g) => {
      for (let x = 0; x <= 10; x++) {
        const hem = Math.floor(hashUnit(x, 0, 181) * 3); // (tattered)
        fillBox(g, x, hem, 0, x, 8, 0, x % 3 === 0 ? FOLD : MANTLE);
      }
      fillBox(g, 0, 8, 0, 10, 8, 6, MANTLE); // over the shoulders
      fillBox(g, 0, 5, 0, 0, 8, 5, FOLD); // down the sides
      fillBox(g, 10, 5, 0, 10, 8, 5, FOLD);
      fillBox(g, 3, 8, 6, 7, 8, 6, 0); // (open at the front)
      fillBox(g, 4, 7, 6, 6, 7, 6, GOLD); // the clasp
    },
  },
  // An arm under a heavy pauldron, rimmed in gold.
  arm: {
    size: [5, 9, 5],
    by: [1, 0, 1],
    paint: (g) => {
      fillBox(g, 0, 6, 0, 4, 8, 4, IRON);
      fillBox(g, 0, 6, 0, 4, 6, 4, GOLD); // its rim
      fillBox(g, 1, 8, 1, 3, 8, 3, IRON_DARK);
    },
  },
  leg: { size: [4, 7, 5], by: [0, 0, 0], paint: () => {} },
};

const made = new Map<BodyPart, THREE.BufferGeometry>();

// The lord's body, as a frame for the human rig.
export const LORD_FRAME: Frame = {
  part(part) {
    let geometry = made.get(part);
    if (!geometry) {
      const { size, by, paint } = LORD_PARTS[part];
      const grid = createGrid(size);
      boneIn(part, grid, by);
      paint(grid);
      const V = HUMAN_VOXEL_SIZE;
      const pivot = BODIES.male.pivot[part];
      geometry = greedyMesh(grid, LORD_PALETTE, V, new THREE.Vector3(-(pivot[0] + by[0]) * V, -(pivot[1] + by[1]) * V, -(pivot[2] + by[2]) * V));
      made.set(part, geometry);
    }
    return geometry;
  },
  palette: LORD_PALETTE,
};

// His crowned skull alone (the target's portrait).
export function buildCrownedSkull(): VoxelGrid {
  const grid = createGrid(LORD_PARTS.head.size);
  boneIn('head', grid, [0, 0, 0]);
  LORD_PARTS.head.paint(grid);
  return grid;
}

// The greatsword, held forward (+Z) from the hand: a gold pommel and guard, a long blade, rust on it.
export function greatswordGeometry(): THREE.BufferGeometry {
  const grid = createGrid([7, 2, 30]);
  fillBox(grid, 2, 0, 0, 4, 1, 1, GOLD); // the pommel
  fillBox(grid, 3, 0, 2, 3, 1, 5, FOLD); // the grip, bound
  fillBox(grid, 0, 0, 6, 6, 1, 6, GOLD); // the guard
  fillBox(grid, 0, 0, 6, 0, 1, 6, GOLD_DARK);
  fillBox(grid, 6, 0, 6, 6, 1, 6, GOLD_DARK);
  for (let z = 7; z <= 28; z++) fillBox(grid, 2, 0, z, 4, 1, z, hashUnit(z, 0, 182) < 0.2 ? IRON_DARK : z % 9 === 4 ? GOLD_DARK : IRON);
  fillBox(grid, 3, 0, 29, 3, 1, 29, IRON); // the point
  return greedyMesh(grid, LORD_PALETTE, HELD_VOXEL_SIZE, new THREE.Vector3(-3.5 * HELD_VOXEL_SIZE, -1 * HELD_VOXEL_SIZE, -3.5 * HELD_VOXEL_SIZE));
}
