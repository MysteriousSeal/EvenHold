// A skeleton's body (the crypts' guards: model/crypts/cryptFoes.ts), on the
// human rig's joints and in its parts' sizes (human/bodyVoxels.ts), so it
// walks and swings as anyone does. Shapes first, for the camera's distance:
// the skull oversized and round, its sockets and nose dark, a row of teeth;
// the ribcage bars of bone with the dark showing between, the spine down its
// back, the pelvis under it; the limbs thin bones knobbed at the joints, the
// feet long. Bone in three tones: light on top, shade along, dark in the cracks.

import * as THREE from 'three';
import type { BodyPart } from '../human/bodyVoxels';
import { BODIES, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import type { Frame } from '../human/humanRig';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';

export const SKELETON_PALETTE = [0xdcd2b8, 0xb5aa90, 0x8a806b, 0x1c1612]; // bone, its shade, its cracks, the dark within
const [BONE, SHADE, CRACK, DARK] = [1, 2, 3, 4];

const PARTS: Record<BodyPart, (grid: VoxelGrid) => void> = {
  // The skull: round, big, the jaw narrower under it; its face toward +Z.
  head: (g) => {
    fillBox(g, 2, 3, 1, 8, 10, 9, BONE);
    fillBox(g, 1, 4, 2, 9, 9, 8, BONE);
    fillBox(g, 3, 10, 3, 7, 10, 7, SHADE); // its crown, in shade from the sides
    fillBox(g, 3, 0, 4, 7, 2, 9, SHADE); // the jaw
    fillBox(g, 2, 5, 9, 3, 6, 9, DARK); // the sockets (its right eye at -x)
    fillBox(g, 6, 5, 9, 7, 6, 9, DARK);
    fillBox(g, 5, 3, 9, 5, 4, 9, DARK); // the nose
    for (let x = 3; x <= 7; x++) fillBox(g, x, 2, 9, x, 2, 9, x % 2 ? BONE : CRACK); // the teeth
    fillBox(g, 8, 7, 3, 8, 9, 3, CRACK); // a crack across the crown
  },
  // The ribs: bars round an empty chest, the spine at the back, the collarbones across the top, the pelvis below.
  torso: (g) => {
    fillBox(g, 1, 0, 1, 7, 1, 3, SHADE); // the pelvis
    fillBox(g, 3, 0, 2, 5, 0, 2, DARK);
    fillBox(g, 4, 0, 0, 4, 8, 1, CRACK); // the spine, down the back
    for (const y of [3, 5, 7]) {
      fillBox(g, 1, y, 0, 7, y, 4, BONE);
      fillBox(g, 2, y, 1, 6, y, 3, 0); // (hollow)
    }
    fillBox(g, 4, 3, 4, 4, 7, 4, SHADE); // the breastbone
    fillBox(g, 0, 8, 2, 8, 8, 2, BONE); // the collarbones
  },
  // An arm: the upper bone, a knob at the elbow, the forearm, a bony hand.
  arm: (g) => {
    fillBox(g, 1, 5, 1, 1, 8, 1, BONE);
    fillBox(g, 0, 4, 0, 2, 4, 2, SHADE); // the elbow
    fillBox(g, 1, 1, 1, 1, 3, 1, BONE);
    fillBox(g, 0, 0, 1, 2, 0, 2, SHADE); // the hand
  },
  // A leg: the thigh bone, a knob at the knee, the shin, a long foot forward.
  leg: (g) => {
    fillBox(g, 1, 4, 2, 2, 6, 2, BONE);
    fillBox(g, 1, 3, 1, 2, 3, 3, SHADE); // the knee
    fillBox(g, 1, 1, 2, 2, 2, 2, BONE);
    fillBox(g, 1, 0, 1, 2, 0, 4, SHADE); // the foot
  },
};

// The skull alone (a portrait's).
export function buildSkull(): VoxelGrid {
  const grid = createGrid(BODIES.male.grid.head);
  PARTS.head(grid);
  return grid;
}

const made = new Map<BodyPart, THREE.BufferGeometry>();

// The skeleton's body, as a frame for the human rig.
export const SKELETON_FRAME: Frame = {
  part(part) {
    let geometry = made.get(part);
    if (!geometry) {
      const { grid: sizes, pivot } = BODIES.male;
      const grid = createGrid(sizes[part]);
      PARTS[part](grid);
      const V = HUMAN_VOXEL_SIZE;
      geometry = greedyMesh(grid, SKELETON_PALETTE, V, new THREE.Vector3(-pivot[part][0] * V, -pivot[part][1] * V, -pivot[part][2] * V));
      made.set(part, geometry);
    }
    return geometry;
  },
  palette: SKELETON_PALETTE,
};
