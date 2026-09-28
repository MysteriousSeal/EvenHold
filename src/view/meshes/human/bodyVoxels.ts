// The one body every humanoid shares (the hero, bandits, villagers later),
// naked but for undyed linen braies (medieval underwear). Nothing is ever
// painted onto it: armor is worn over it as separate models (gear/). Only
// its look changes from person to person (model/human/humanoid.ts): the skin
// tone, the hair color and style, a beard.
//
// 0.025 voxels, finer than the world's 0.04: at world scale the 0.45-tall
// body would be 11 voxels, too coarse for a face or armor detail. Proportions
// are chunky and readable from the isometric camera: 5 voxels of legs, 6 of
// torso, a big 7-voxel head (18 = 0.45 tall). Every part faces +Z (the
// eyes and toes point that way) and is a separate grid, so each can swing on
// its own joint.

import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import type { HeldSlot } from '../../../model/human/equipment';
import { HAIR_COLOR_COUNT, SKIN_TONE_COUNT, type BodyLook } from '../../../model/human/humanoid';

export const HUMAN_VOXEL_SIZE = 0.025;

export type BodyPart = 'head' | 'torso' | 'arm' | 'leg';
export type Side = 'left' | 'right' | 'center';
export type Joint = 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

// Part sizes in voxels [x, y, z].
export const PART_GRID: Record<BodyPart, [number, number, number]> = {
  leg: [3, 5, 4], // the foot sticks out forward
  torso: [7, 6, 4],
  arm: [2, 6, 2],
  head: [7, 7, 7],
};

// The joint each part swings around, in voxels within its grid: hips at the
// bottom of the torso, the neck under the head, shoulders and hips at the
// tops of the limbs.
export const PART_PIVOT: Record<BodyPart, [number, number, number]> = {
  torso: [3.5, 0, 2],
  head: [3.5, 0, 3.5],
  arm: [1, 6, 1],
  leg: [1.5, 5, 1.5],
};

// Where each joint sits, in voxels from between the feet, and the part
// hanging from it. The body faces +Z, so its right side is -X.
export const JOINTS: Record<Joint, { part: BodyPart; side: Side; at: [number, number, number] }> = {
  torso: { part: 'torso', side: 'center', at: [0, 5, 0] },
  head: { part: 'head', side: 'center', at: [0, 11, 0] },
  rightArm: { part: 'arm', side: 'right', at: [-4.5, 10.5, 0] },
  leftArm: { part: 'arm', side: 'left', at: [4.5, 10.5, 0] },
  rightLeg: { part: 'leg', side: 'right', at: [-2, 5, 0] },
  leftLeg: { part: 'leg', side: 'left', at: [2, 5, 0] },
};
export const JOINT_NAMES = Object.keys(JOINTS) as Joint[];

// The middle of the hand, in voxels from the arm's joint (the shoulder),
// and which arm holds each hand's item.
export const HAND: [number, number, number] = [0, -5, 0];
export const HELD_BY: Record<HeldSlot, Joint> = { mainHand: 'rightArm', offHand: 'leftArm' };

// Skin tones, fair to deep, each with its shading, highlight, cheeks and mouth.
const SKIN_TONES: Array<[skin: number, shade: number, light: number, cheek: number, mouth: number]> = [
  [0xf0c49a, 0xd9a37a, 0xf8d9b6, 0xe8a58a, 0xb5705a],
  [0xe2b48c, 0xc79670, 0xeec7a2, 0xd89478, 0xa8644e],
  [0xc68e62, 0xa8724a, 0xd6a47a, 0xb87658, 0x8a4e3a],
  [0x8e5e3e, 0x74492e, 0xa2704c, 0x80503a, 0x5e3426],
];
// Hair colors with their highlight: chestnut, black, fair, red, grey.
const HAIR_COLORS: Array<[hair: number, light: number]> = [
  [0x6b4226, 0x8a5a35],
  [0x2e2420, 0x463830],
  [0xb07a3a, 0xc8944e],
  [0x8a3a22, 0xa85232],
  [0x9a948a, 0xb8b2a6],
];
if (SKIN_TONES.length !== SKIN_TONE_COUNT || HAIR_COLORS.length !== HAIR_COLOR_COUNT) throw new Error('body palettes out of step with model/human/humanoid.ts');

const EYE = 0x2b2522;
const LINEN = 0xe8dcc0;
const LINEN_SHADE = 0xcfc0a0;
const CORD = 0x8a6a45;

// Palette indices + 1, in the order bodyPalette() lists the colors.
const C = { skin: 1, skinShade: 2, skinLight: 3, hair: 4, hairLight: 5, eye: 6, cheek: 7, mouth: 8, linen: 9, linenShade: 10, cord: 11 };

export function bodyPalette(look: BodyLook): number[] {
  const [skin, shade, light, cheek, mouth] = SKIN_TONES[look.skin % SKIN_TONE_COUNT];
  const [hair, hairLight] = HAIR_COLORS[look.hair % HAIR_COLOR_COUNT];
  return [skin, shade, light, hair, hairLight, EYE, cheek, mouth, LINEN, LINEN_SHADE, CORD];
}

// A leg: linen braies over the thigh, bare shin, a foot one voxel longer
// toward the front (+Z). Shaded on its outer side so the two legs separate.
export function buildLeg(): VoxelGrid {
  const grid = createGrid(PART_GRID.leg);
  fillBox(grid, 0, 1, 0, 2, 4, 2, (x, y) => (y >= 3 ? (x === 0 ? C.linenShade : C.linen) : x === 0 ? C.skinShade : C.skin));
  fillBox(grid, 0, 0, 0, 2, 0, 3, (x, _y, z) => (z === 3 ? C.skinLight : x === 0 ? C.skinShade : C.skin)); // foot
  return grid;
}

// The torso: braies up to the waist, tied with a cord, bare chest above
// with a hint of shading at the sides, a navel and collarbones.
export function buildTorso(): VoxelGrid {
  const grid = createGrid(PART_GRID.torso);
  fillBox(grid, 0, 0, 0, 6, 5, 3, (x, y, z) => {
    if (y <= 1) return x === 0 || z === 0 ? C.linenShade : C.linen;
    if (y === 2) return C.cord;
    return x === 0 || x === 6 || z === 0 ? C.skinShade : C.skin;
  });
  setColor(grid, 3, 3, 3, C.skinShade); // navel
  fillBox(grid, 1, 5, 3, 5, 5, 3, C.skinLight); // collarbones catching the light
  return grid;
}

// An arm hanging from the shoulder, the hand a lighter voxel pair at the end.
export function buildArm(): VoxelGrid {
  const grid = createGrid(PART_GRID.arm);
  fillBox(grid, 0, 0, 0, 1, 5, 1, (x, y) => (y <= 1 ? C.skinLight : x === 0 ? C.skinShade : C.skin));
  return grid;
}

// The head: a face on the +Z side (eyes two voxels tall, rosy cheeks, a
// small mouth) and the hair in its style. Always a full 7-voxel cube, so
// anything worn on the head fits every style.
export function buildHead(look: Pick<BodyLook, 'hairStyle' | 'beard'>): VoxelGrid {
  const grid = createGrid(PART_GRID.head);
  fillBox(grid, 0, 0, 0, 6, 6, 6, (x, _y, z) => (x === 0 || x === 6 || z === 0 ? C.skinShade : C.skin));
  const style = look.hairStyle;
  if (style === 'bald') {
    fillBox(grid, 1, 6, 1, 5, 6, 5, (x, _y, z) => ((x + z) % 4 === 0 ? C.skinLight : C.skin)); // a shine on the crown
  } else {
    fillBox(grid, 0, 6, 0, 6, 6, 6, (x, _y, z) => ((x + z) % 3 === 0 ? C.hairLight : C.hair)); // crown
    if (style === 'cropped') {
      fillBox(grid, 0, 4, 0, 6, 5, 0, C.hair); // close-cropped: a band around the back
      for (const x of [0, 6]) fillBox(grid, x, 5, 0, x, 5, 3, C.hair);
    } else {
      // Down the back (to the nape, or the neck when long) and the sides.
      const long = style === 'long';
      fillBox(grid, 0, long ? 0 : 1, 0, 6, 5, 1, (x, y) => ((x + y) % 4 === 0 ? C.hairLight : C.hair));
      for (const x of [0, 6]) fillBox(grid, x, long ? 1 : 3, 0, x, 5, long ? 5 : 4, C.hair);
      fillBox(grid, 1, 5, 6, 5, 5, 6, (x) => (x === 3 ? C.skin : C.hair)); // fringe, parted
    }
  }
  // Face.
  for (const x of [2, 4]) fillBox(grid, x, 2, 6, x, 3, 6, C.eye);
  setColor(grid, 1, 1, 6, C.cheek);
  setColor(grid, 5, 1, 6, C.cheek);
  if (look.beard) {
    fillBox(grid, 1, 0, 6, 5, 1, 6, C.hair); // chin and cheeks
    for (const x of [0, 6]) fillBox(grid, x, 0, 4, x, 2, 6, C.hair); // sideburns
  }
  setColor(grid, 3, 1, 6, C.mouth);
  return grid;
}

export function buildBodyPart(part: BodyPart, look: BodyLook): VoxelGrid {
  if (part === 'head') return buildHead(look);
  if (part === 'torso') return buildTorso();
  return part === 'arm' ? buildArm() : buildLeg();
}
