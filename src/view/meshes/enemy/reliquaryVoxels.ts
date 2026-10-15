// The reliquary's dead (model/reliquary/), each the skeleton's body (skeletonVoxels.ts) dressed on the same joints, so
// they walk and swing as anyone does. Palette first, one for all three: bone in its four tones; gilt, its light and
// its dark; red silk and its folds; undyed wool and its folds; a rope belt; rock crystal; candle-glow in the sockets.
// Shapes for the camera's distance:
// - an Unquiet Brother: a monk's deep hood over a skull (two candle-lit sockets in the dark of it), a wool habit to
//   the feet, wide sleeves, a rope belt;
// - a gilded saint: the bones gilt all over, red silk rags over the ribs and round the hips, a gilt halo ring over its
//   skull;
// - the Gilded Deacon: a gilt skull, a red silk dalmatic with gilt bands down it and across, gilt arm-reliquaries for
//   forearms; the reliquaries he's made of hung on him apart (DEACON_RELICS: they break off him, turn by turn), and
//   a processional cross for a weapon.

import * as THREE from 'three';
import type { BodyPart } from '../human/bodyVoxels';
import { BODIES, HELD_VOXEL_SIZE, HUMAN_VOXEL_SIZE } from '../human/bodyVoxels';
import type { Frame } from '../human/humanRig';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox } from '../voxel/voxelShapes';
import { hashUnit } from '../../../util/random';
import { PARTS, SKELETON_PALETTE } from './skeletonVoxels';

export const RELIQUARY_FOE_PALETTE = [...SKELETON_PALETTE, 0xd8a838, 0xf2d070, 0x9a6e1e, 0x9a1c24, 0x5e1018, 0x5e5448, 0x433b32, 0xa08a5c, 0xcfe8f0, 0xffc860];
const [BONE, SHADE, CRACK, DARK, GILT, GILT_LIGHT, GILT_DARK, SILK, SILK_DARK, WOOL, WOOL_DARK, ROPE, CRYSTAL, CANDLE] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
const GILDED: Record<number, number> = { [BONE]: GILT, [SHADE]: GILT_DARK, [CRACK]: GILT_DARK }; // (a saint's bones, gilt)

type Dress = Record<BodyPart, { size: [number, number, number]; by: [number, number, number]; paint(g: VoxelGrid): void }>;

// The skeleton's part, painted into a bigger grid `by` voxels in from its corner (its colours `as`, if given).
function bonesIn(part: BodyPart, grid: VoxelGrid, by: [number, number, number], as: Record<number, number> = {}): void {
  const bones = createGrid(BODIES.male.grid[part]);
  PARTS[part](bones);
  const [sx, sy, sz] = bones.size;
  for (let x = 0; x < sx; x++) for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) {
    const c = bones.cells[x + sx * (y + sy * z)];
    if (c) fillBox(grid, x + by[0], y + by[1], z + by[2], x + by[0], y + by[1], z + by[2], as[c] ?? c);
  }
}

// A frame for the human rig from a dressing of the skeleton.
function frameOf(dress: Dress, as: Record<number, number> = {}): Frame {
  const made = new Map<BodyPart, THREE.BufferGeometry>();
  return {
    part(part) {
      let geometry = made.get(part);
      if (!geometry) {
        const { size, by, paint } = dress[part];
        const grid = createGrid(size);
        bonesIn(part, grid, by, as);
        paint(grid);
        const V = HUMAN_VOXEL_SIZE;
        const pivot = BODIES.male.pivot[part];
        geometry = greedyMesh(grid, RELIQUARY_FOE_PALETTE, V, new THREE.Vector3(-(pivot[0] + by[0]) * V, -(pivot[1] + by[1]) * V, -(pivot[2] + by[2]) * V));
        made.set(part, geometry);
      }
      return geometry;
    },
    palette: RELIQUARY_FOE_PALETTE,
  };
}

// The Brother's: a deep hood, a habit to the feet, wide sleeves, a rope belt.
const BROTHER: Dress = {
  head: {
    size: [13, 13, 13],
    by: [1, 0, 1],
    paint: (g) => {
      // The hood: round the skull's back, sides and top, its point falling behind; its face open, dark within.
      for (let x = 0; x <= 12; x++) for (let y = 2; y <= 12; y++) for (let z = 0; z <= 11; z++) {
        const shell = x === 0 || x === 12 || y === 12 || z === 0 || (y === 11 && (x === 1 || x === 11));
        if (shell) fillBox(g, x, y, z, x, y, z, (x + y) % 5 === 0 ? WOOL_DARK : WOOL);
      }
      fillBox(g, 5, 9, 0, 7, 12, 0, WOOL_DARK); // (its point, behind)
      fillBox(g, 1, 11, 10, 11, 11, 11, WOOL); // the hood's brow, over the face
      fillBox(g, 3, 5, 10, 4, 6, 10, CANDLE); // the sockets, lit from within
      fillBox(g, 7, 5, 10, 8, 6, 10, CANDLE);
    },
  },
  torso: {
    size: [11, 10, 7],
    by: [1, 0, 1],
    paint: (g) => {
      fillBox(g, 0, 0, 0, 10, 9, 6, WOOL); // the habit, over the ribs
      for (let x = 0; x <= 10; x += 3) fillBox(g, x, 0, 6, x, 8, 6, WOOL_DARK); // its folds, down the front
      fillBox(g, 0, 1, 0, 10, 1, 6, ROPE); // the rope belt
      fillBox(g, 3, 0, 6, 3, 1, 6, ROPE); // its end, hanging
      fillBox(g, 4, 9, 5, 6, 9, 6, DARK); // (the hood's neck, dark)
    },
  },
  arm: {
    size: [5, 9, 5],
    by: [1, 0, 1],
    paint: (g) => {
      fillBox(g, 0, 2, 0, 4, 8, 4, WOOL); // the sleeve, wide
      fillBox(g, 0, 2, 0, 4, 2, 4, WOOL_DARK); // its cuff, the hand out of it
    },
  },
  leg: {
    size: [6, 7, 7],
    by: [1, 0, 1],
    paint: (g) => {
      for (let y = 1; y <= 6; y++) fillBox(g, 0, y, 0, 5, y, 5, y === 1 ? WOOL_DARK : WOOL); // the habit's skirt, to the feet
    },
  },
};

// The saint's: gilt bones, red silk rags, a halo.
const SAINT: Dress = {
  head: {
    size: [11, 15, 11],
    by: [0, 0, 0],
    paint: (g) => {
      for (let x = 0; x <= 10; x++) for (let z = 0; z <= 10; z++) {
        const d = Math.hypot(x - 5, z - 5);
        if (d >= 4 && d < 5.3) fillBox(g, x, 13, z, x, 13, z, (x + z) % 3 ? GILT_LIGHT : GILT); // the halo, over the skull
      }
      fillBox(g, 2, 5, 9, 3, 6, 9, CANDLE); // (its sockets lit)
      fillBox(g, 6, 5, 9, 7, 6, 9, CANDLE);
    },
  },
  torso: {
    size: [9, 9, 5],
    by: [0, 0, 0],
    paint: (g) => {
      for (let x = 1; x <= 7; x++) {
        const hem = 2 + Math.floor(hashUnit(x, 3, 461) * 3); // (ragged)
        fillBox(g, x, hem, 0, x, 7, 0, x % 3 ? SILK : SILK_DARK); // a rag of silk down the back
      }
      fillBox(g, 0, 7, 1, 2, 8, 3, SILK); // over one shoulder
      fillBox(g, 2, 4, 4, 2, 7, 4, SILK_DARK); // and across the ribs
      fillBox(g, 1, 0, 0, 7, 1, 4, SILK); // round the hips
      fillBox(g, 4, 1, 4, 4, 1, 4, GILT_LIGHT); // its brooch
    },
  },
  arm: { size: [3, 9, 3], by: [0, 0, 0], paint: () => {} },
  leg: { size: [4, 7, 5], by: [0, 0, 0], paint: () => {} },
};

// The Deacon's: a gilt skull, a dalmatic of red silk with gilt bands, arm-reliquaries for forearms.
const DEACON: Dress = {
  head: {
    size: [11, 12, 11],
    by: [0, 0, 0],
    paint: (g) => {
      fillBox(g, 2, 5, 9, 3, 6, 9, CANDLE); // (its sockets lit)
      fillBox(g, 6, 5, 9, 7, 6, 9, CANDLE);
      for (let x = 2; x <= 8; x++) fillBox(g, x, 11, 3, x, 11, 7, x % 2 ? GILT_LIGHT : GILT); // a gilt circlet's top
    },
  },
  torso: {
    size: [11, 10, 7],
    by: [1, 0, 1],
    paint: (g) => {
      fillBox(g, 0, 0, 0, 10, 9, 6, SILK); // the dalmatic
      for (let x = 0; x <= 10; x += 2) fillBox(g, x, 0, 6, x, 0, 6, SILK_DARK); // its hem, folded
      fillBox(g, 3, 0, 6, 3, 9, 6, GILT); // two gilt bands down the front
      fillBox(g, 7, 0, 6, 7, 9, 6, GILT);
      fillBox(g, 0, 7, 6, 10, 7, 6, GILT_LIGHT); // and one across the chest
      fillBox(g, 3, 0, 0, 3, 9, 0, GILT_DARK); // (down the back too)
      fillBox(g, 7, 0, 0, 7, 9, 0, GILT_DARK);
      fillBox(g, 4, 9, 2, 6, 9, 4, BONE); // the neck, bone
    },
  },
  arm: {
    size: [5, 9, 5],
    by: [1, 0, 1],
    paint: (g) => {
      fillBox(g, 0, 6, 0, 4, 8, 4, SILK); // the dalmatic's sleeve
      fillBox(g, 0, 6, 0, 4, 6, 4, GILT); // its band
      fillBox(g, 0, 1, 0, 4, 4, 4, GILT); // the forearm a gilt reliquary
      fillBox(g, 1, 2, 4, 3, 3, 4, CRYSTAL); // its window, the bone behind it
      fillBox(g, 0, 4, 0, 4, 4, 4, GILT_LIGHT);
    },
  },
  leg: {
    size: [6, 7, 7],
    by: [1, 0, 1],
    paint: (g) => {
      for (let y = 2; y <= 6; y++) fillBox(g, 0, y, 0, 5, y, 5, y === 2 ? GILT_DARK : SILK); // the dalmatic's skirt, its gilt hem
    },
  },
};

export const BROTHER_FRAME = frameOf(BROTHER);
export const SAINT_FRAME = frameOf(SAINT, GILDED);
export const DEACON_FRAME = frameOf(DEACON, GILDED);

// The head of each alone (the target's portrait).
export function reliquaryHead(who: 'brother' | 'saint' | 'deacon'): VoxelGrid {
  const dress = { brother: BROTHER, saint: SAINT, deacon: DEACON }[who];
  const grid = createGrid(dress.head.size);
  bonesIn('head', grid, dress.head.by, who === 'brother' ? {} : GILDED);
  dress.head.paint(grid);
  return grid;
}

// The reliquaries the Deacon's made of, hung on him apart (each on its joint, from its pivot), in the order they
// break off: a bone casket strapped to his back; a gilt arm-reliquary on his left arm, over the forearm; and on his
// chest, the monstrance with the finger in it, behind its crystal.
export const DEACON_RELICS: ReadonlyArray<{ joint: 'torso' | 'leftArm'; build(): VoxelGrid; at: [number, number, number] }> = [
  {
    joint: 'torso',
    at: [0, 4, -4], // (on his back)
    build: () => {
      const g = createGrid([9, 8, 5]);
      fillBox(g, 0, 0, 0, 8, 6, 4, BONE); // the casket, of bone plaques
      for (let x = 0; x <= 8; x += 2) fillBox(g, x, 0, 0, x, 6, 0, SHADE);
      fillBox(g, 0, 6, 0, 8, 7, 4, GILT); // its gilt lid
      fillBox(g, 3, 7, 1, 5, 7, 3, GILT_LIGHT); // a ridge on it
      fillBox(g, 0, 0, 0, 8, 0, 4, GILT_DARK); // its foot
      fillBox(g, 3, 2, 0, 5, 4, 0, CRYSTAL); // a window
      return g;
    },
  },
  {
    joint: 'leftArm',
    at: [0, -6, 0], // (over the forearm)
    build: () => {
      const g = createGrid([7, 9, 7]);
      fillBox(g, 0, 0, 0, 6, 8, 6, GILT); // a gilt arm's case, bigger than the arm
      fillBox(g, 0, 8, 0, 6, 8, 6, GILT_LIGHT);
      fillBox(g, 0, 0, 0, 6, 0, 6, GILT_DARK);
      fillBox(g, 1, 3, 6, 5, 6, 6, CRYSTAL); // its window
      fillBox(g, 3, 3, 6, 3, 6, 6, BONE); // the arm bone behind it
      fillBox(g, 2, 9 - 1, 2, 4, 8, 4, SILK); // a silk cuff
      return g;
    },
  },
  {
    joint: 'torso',
    at: [0, 5, 4], // (on his chest)
    build: () => {
      const g = createGrid([7, 9, 3]);
      for (let x = 0; x <= 6; x++) for (let y = 2; y <= 8; y++) if (Math.hypot(x - 3, y - 5) < 3.5) fillBox(g, x, y, 0, x, y, 1, (x + y) % 2 ? GILT_LIGHT : GILT); // the sunburst
      fillBox(g, 2, 3, 2, 4, 7, 2, CRYSTAL); // the crystal
      fillBox(g, 3, 4, 2, 3, 6, 2, BONE); // the finger in it
      fillBox(g, 3, 0, 0, 3, 2, 1, GILT_DARK); // its stem
      return g;
    },
  },
];

// A relic's mesh, centred on its grid and set at its place on the joint.
export function relicGeometry(relic: (typeof DEACON_RELICS)[number]): THREE.BufferGeometry {
  const grid = relic.build();
  const [sx, sy, sz] = grid.size;
  const V = HUMAN_VOXEL_SIZE;
  return greedyMesh(grid, RELIQUARY_FOE_PALETTE, V, new THREE.Vector3((-sx / 2 + relic.at[0]) * V, (-sy / 2 + relic.at[1]) * V, (-sz / 2 + relic.at[2]) * V));
}

// His processional cross, held forward (+Z) from the hand: a long gilt staff, a cross at its head, a red silk streamer.
export function processionalCrossGeometry(): THREE.BufferGeometry {
  const grid = createGrid([9, 2, 31]);
  fillBox(grid, 4, 0, 0, 4, 1, 22, GILT_DARK); // the staff
  for (let z = 3; z <= 21; z += 6) fillBox(grid, 3, 0, z, 5, 1, z, GILT); // its knops
  fillBox(grid, 4, 0, 23, 4, 1, 30, GILT); // the cross's upright
  fillBox(grid, 0, 0, 27, 8, 1, 27, GILT); // its arms
  fillBox(grid, 0, 0, 27, 0, 1, 27, GILT_LIGHT);
  fillBox(grid, 8, 0, 27, 8, 1, 27, GILT_LIGHT);
  fillBox(grid, 4, 0, 27, 4, 1, 27, CRYSTAL); // a crystal at the crossing
  fillBox(grid, 5, 0, 21, 6, 1, 23, SILK); // the streamer
  return greedyMesh(grid, RELIQUARY_FOE_PALETTE, HELD_VOXEL_SIZE, new THREE.Vector3(-4.5 * HELD_VOXEL_SIZE, -1 * HELD_VOXEL_SIZE, -3.5 * HELD_VOXEL_SIZE));
}
