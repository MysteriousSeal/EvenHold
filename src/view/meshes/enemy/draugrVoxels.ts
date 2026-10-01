// A draugr (the crypts' brutes: model/crypts/cryptFoes.ts, its breath
// frostBreath.ts) on the human rig's joints and in its parts' sizes, drawn a
// little bigger than a man. Palette first, ten: withered grey-green flesh and
// its shade, ice-blue eyes (they glow), a pale beard, iron and its shade,
// rusted mail, worn leather, dark cloth, a bright edge. Shapes for the
// camera's distance: a helm with a ridge and a nasal guard over a sunken face,
// the eyes lit in dark sockets, a long pale beard in a braid; mail over the
// chest and shoulders, a belt with its buckle, a ragged hem; withered
// forearms; legs wound in wrappings, dark boots. A big bearded axe in hand.

import * as THREE from 'three';
import type { BodyPart } from '../human/bodyVoxels';
import { BODIES, HELD_VOXEL_SIZE, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import type { Frame } from '../human/humanRig';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';

export const DRAUGR_PALETTE = [0x6f7c74, 0x4c5852, 0x8fe8ff, 0xc8c2b0, 0x7a7f84, 0x4a4e52, 0x6a5040, 0x3e2c1e, 0x2e2a2c, 0xc4ccd2];
const [FLESH, SHADE, EYE, BEARD, IRON, IRON_DARK, MAIL, LEATHER, CLOTH, EDGE] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const PARTS: Record<BodyPart, (g: VoxelGrid) => void> = {
  // The head, its face toward +Z: sunken cheeks, glowing eyes in dark hollows, a helm over, a beard under.
  head: (g) => {
    fillBox(g, 2, 1, 2, 8, 8, 9, FLESH);
    fillBox(g, 1, 3, 3, 9, 7, 8, FLESH);
    fillBox(g, 2, 2, 9, 8, 4, 9, SHADE); // the sunken cheeks
    fillBox(g, 2, 5, 9, 4, 6, 9, CLOTH); // the hollows
    fillBox(g, 6, 5, 9, 8, 6, 9, CLOTH);
    fillBox(g, 3, 5, 10, 3, 5, 10, EYE); // the eyes, glowing, out of them
    fillBox(g, 7, 5, 10, 7, 5, 10, EYE);
    // The helm: round over the top, a ridge front to back, the nasal guard down the face.
    fillBox(g, 1, 7, 1, 9, 9, 9, IRON);
    fillBox(g, 2, 10, 2, 8, 10, 8, IRON);
    fillBox(g, 5, 10, 1, 5, 10, 9, IRON_DARK); // its ridge
    fillBox(g, 1, 7, 1, 9, 7, 9, IRON_DARK); // its rim
    fillBox(g, 5, 3, 10, 5, 7, 10, IRON); // the nasal guard
    // The beard: long and pale, a braid down its middle.
    fillBox(g, 2, 0, 8, 8, 3, 10, BEARD);
    fillBox(g, 4, 0, 10, 6, 1, 10, SHADE);
    fillBox(g, 5, 0, 10, 5, 2, 10, BEARD);
  },
  // The chest in rusted mail, a belt and its buckle, a ragged hem of cloth under.
  torso: (g) => {
    fillBox(g, 0, 0, 0, 8, 8, 4, (x, y, z) => ((x + y + z) % 2 ? MAIL : IRON_DARK));
    for (let x = 0; x <= 8; x++) fillBox(g, x, 0, 0, x, Math.floor(hashUnit(x, 1, 191) * 2), 4, CLOTH); // (ragged)
    fillBox(g, 0, 2, 0, 8, 2, 4, LEATHER); // the belt
    fillBox(g, 4, 2, 4, 4, 2, 4, IRON); // its buckle
    fillBox(g, 0, 8, 0, 8, 8, 4, MAIL); // the mail over the shoulders
  },
  // An arm: mail to the elbow, a withered forearm, a grey hand.
  arm: (g) => {
    fillBox(g, 0, 5, 0, 2, 8, 2, MAIL);
    fillBox(g, 0, 1, 0, 2, 4, 2, FLESH);
    fillBox(g, 0, 2, 0, 2, 2, 2, SHADE); // (sinew)
    fillBox(g, 0, 0, 0, 2, 0, 2, SHADE); // the hand
  },
  // A leg: wound in wrappings, a dark boot, its toe forward.
  leg: (g) => {
    fillBox(g, 0, 2, 0, 3, 6, 3, (_x, y) => (y % 2 ? CLOTH : LEATHER));
    fillBox(g, 0, 0, 0, 3, 1, 4, LEATHER);
  },
};

const made = new Map<BodyPart, THREE.BufferGeometry>();

// A draugr's body, as a frame for the human rig.
export const DRAUGR_FRAME: Frame = {
  part(part) {
    let geometry = made.get(part);
    if (!geometry) {
      const { grid: sizes, pivot } = BODIES.male;
      const grid = createGrid(part === 'head' ? [11, 11, 11] : sizes[part]);
      PARTS[part](grid);
      const V = HUMAN_VOXEL_SIZE;
      geometry = greedyMesh(grid, DRAUGR_PALETTE, V, new THREE.Vector3(-pivot[part][0] * V, -pivot[part][1] * V, -pivot[part][2] * V));
      made.set(part, geometry);
    }
    return geometry;
  },
  palette: DRAUGR_PALETTE,
};

// A draugr's head alone (the target's portrait).
export function buildDraugrHead(): VoxelGrid {
  const grid = createGrid([11, 11, 11]);
  PARTS.head(grid);
  return grid;
}

// The axe, held forward (+Z) from the hand: a long haft bound in leather, a bearded iron head far out, its edge bright.
export function axeGeometry(): THREE.BufferGeometry {
  const grid = createGrid([3, 13, 30]);
  fillBox(grid, 1, 5, 0, 1, 6, 29, LEATHER); // the haft
  for (let z = 2; z <= 6; z += 2) fillBox(grid, 1, 5, z, 1, 6, z, CLOTH); // its binding
  // The head: up from the haft at its end, the beard sweeping down below, the edge along its front.
  for (let z = 21; z <= 28; z++) {
    const [low, high] = [z <= 24 ? 1 + (24 - z) : 1, 11 - Math.abs(z - 25)];
    fillBox(grid, 0, low, z, 2, high, z, IRON);
  }
  for (let y = 1; y <= 11; y++) fillBox(grid, 1, y, 28, 1, y, 28, EDGE); // the edge
  fillBox(grid, 0, 4, 21, 2, 7, 22, IRON_DARK); // where it's fixed
  return greedyMesh(grid, DRAUGR_PALETTE, HELD_VOXEL_SIZE, new THREE.Vector3(-1.5 * HELD_VOXEL_SIZE, -5.5 * HELD_VOXEL_SIZE, -2 * HELD_VOXEL_SIZE));
}
