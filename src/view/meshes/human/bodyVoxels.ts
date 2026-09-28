// The body humanoids have (the hero, bandits, villagers), in two builds:
// male, and a slimmer female one (a narrow torso with a waist and a bust,
// thin arms, slim legs; the same height and the same head, so what's worn
// on the head fits both). Naked but for undyed linen braies (medieval
// underwear), and on her a linen breast band. Nothing is ever painted onto
// it: armor is worn over it as separate models (gear/), fitted to either
// build. Only its look changes from person to person (model/human/humanoid.ts):
// the build, the skin tone, the hair color and style, a beard.
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
import { HAIR_COLOR_COUNT, SKIN_TONE_COUNT, type BodyLook, type Build } from '../../../model/human/humanoid';

export const HUMAN_VOXEL_SIZE = 0.025;

export type BodyPart = 'head' | 'torso' | 'arm' | 'leg';
export type Side = 'left' | 'right' | 'center';
export type Joint = 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

// Part sizes in voxels [x, y, z], per build.
type Sizes = Record<BodyPart, [number, number, number]>;
type JointAt = Record<Joint, { part: BodyPart; side: Side; at: [number, number, number] }>;
export interface BodyShape {
  grid: Sizes;
  pivot: Sizes; // the joint each part swings around, in voxels within its grid
  joints: JointAt; // where each joint sits, in voxels from between the feet
  hand: [number, number, number]; // the middle of the hand, from the arm's joint: where held items go
}

// Hips at the bottom of the torso, the neck under the head, shoulders and
// hips at the tops of the limbs. The body faces +Z, so its right side is -X.
export const BODIES: Record<Build, BodyShape> = {
  male: {
    grid: {
      leg: [3, 5, 4], // the foot sticks out forward
      torso: [7, 6, 4],
      arm: [2, 6, 2],
      head: [7, 7, 7],
    },
    pivot: { torso: [3.5, 0, 2], head: [3.5, 0, 3.5], arm: [1, 6, 1], leg: [1.5, 5, 1.5] },
    joints: {
      torso: { part: 'torso', side: 'center', at: [0, 5, 0] },
      head: { part: 'head', side: 'center', at: [0, 11, 0] },
      rightArm: { part: 'arm', side: 'right', at: [-4.5, 10.5, 0] },
      leftArm: { part: 'arm', side: 'left', at: [4.5, 10.5, 0] },
      rightLeg: { part: 'leg', side: 'right', at: [-2, 5, 0] },
      leftLeg: { part: 'leg', side: 'left', at: [2, 5, 0] },
    },
    hand: [0, -5, 0],
  },
  female: {
    grid: {
      leg: [2, 5, 3], // slimmer, the foot forward
      torso: [5, 6, 4], // narrower and shallower; the bust in its front layer
      arm: [1, 6, 2], // thin
      head: [7, 7, 7],
    },
    pivot: { torso: [2.5, 0, 1.5], head: [3.5, 0, 3.5], arm: [0.5, 6, 1], leg: [1, 5, 1] },
    joints: {
      torso: { part: 'torso', side: 'center', at: [0, 5, 0] },
      head: { part: 'head', side: 'center', at: [0, 11, 0] },
      // A voxel out from her sides: the layer between is where what's worn on her chest goes.
      rightArm: { part: 'arm', side: 'right', at: [-4, 10.5, 0] },
      leftArm: { part: 'arm', side: 'left', at: [4, 10.5, 0] },
      rightLeg: { part: 'leg', side: 'right', at: [-1.5, 5, 0] },
      leftLeg: { part: 'leg', side: 'left', at: [1.5, 5, 0] },
    },
    hand: [0.25, -5, 0.25], // a quarter voxel over and forward, so what she holds never shares faces with her arm or hips
  },
};
// The male build's, for what doesn't depend on who wears it.
export const PART_GRID: Sizes = BODIES.male.grid;
export const PART_PIVOT: Sizes = BODIES.male.pivot;
export const JOINTS: JointAt = BODIES.male.joints;
export const JOINT_NAMES = Object.keys(JOINTS) as Joint[];

// Which arm holds each hand's item (the hand's middle is the build's `hand`).
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
export function buildLeg(build: Build = 'male'): VoxelGrid {
  const [w, , d] = BODIES[build].grid.leg;
  const grid = createGrid(BODIES[build].grid.leg);
  fillBox(grid, 0, 1, 0, w - 1, 4, d - 2, (x, y) => (y >= 3 ? (x === 0 ? C.linenShade : C.linen) : x === 0 ? C.skinShade : C.skin));
  fillBox(grid, 0, 0, 0, w - 1, 0, d - 1, (x, _y, z) => (z === d - 1 ? C.skinLight : x === 0 ? C.skinShade : C.skin)); // foot
  return grid;
}

// The torso: braies up to the waist, tied with a cord, bare chest above
// with a hint of shading at the sides, a navel and collarbones. Hers: hips
// in braies, a narrow waist with the cord, a linen band over the bust
// (standing out in front), bare shoulders.
export function buildTorso(build: Build = 'male'): VoxelGrid {
  const grid = createGrid(BODIES[build].grid.torso);
  if (build === 'female') {
    fillBox(grid, 0, 0, 0, 4, 1, 2, (x, _y, z) => (x === 0 || z === 0 ? C.linenShade : C.linen)); // hips
    fillBox(grid, 1, 2, 0, 3, 2, 2, C.cord); // the waist, tied
    fillBox(grid, 0, 3, 0, 4, 4, 2, (x, _y, z) => (x === 0 || z === 0 ? C.linenShade : C.linen)); // the band
    fillBox(grid, 1, 3, 3, 3, 4, 3, (x, y) => (y === 4 && x === 2 ? C.linenShade : C.linen)); // over the bust
    fillBox(grid, 0, 5, 0, 4, 5, 2, (x, _y, z) => (x === 0 || x === 4 || z === 0 ? C.skinShade : C.skin)); // shoulders
    fillBox(grid, 1, 5, 2, 3, 5, 2, C.skinLight); // collarbones
    return grid;
  }
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
export function buildArm(build: Build = 'male'): VoxelGrid {
  const [w, , d] = BODIES[build].grid.arm;
  const grid = createGrid(BODIES[build].grid.arm);
  fillBox(grid, 0, 0, 0, w - 1, 5, d - 1, (x, y) => (y <= 1 ? C.skinLight : x === 0 && w > 1 ? C.skinShade : C.skin));
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

export function buildBodyPart(part: BodyPart, look: Pick<BodyLook, 'build' | 'hairStyle' | 'beard'>): VoxelGrid {
  if (part === 'head') return buildHead(look);
  if (part === 'torso') return buildTorso(look.build);
  return part === 'arm' ? buildArm(look.build) : buildLeg(look.build);
}

// Hair gathered up past the head (a bun, a ponytail, a braid), as its own
// piece on the head's joint, left off under anything worn on the head; or
// null for styles that stay within it. Its grid spans the head's width,
// from 6 below it to 2 over, and 3 behind it; `pivot` is the head's joint
// in it.
export const HAIR_PIECE_GRID: [number, number, number] = [7, 15, 3];
export const HAIR_PIECE_PIVOT: [number, number, number] = [3.5, 6, 6.5];
export function buildHairPiece(style: BodyLook['hairStyle']): VoxelGrid | null {
  if (style !== 'bun' && style !== 'ponytail' && style !== 'braid') return null;
  const grid = createGrid(HAIR_PIECE_GRID);
  // Head coordinates (y 0..6 up the head, z -1 just behind it) into the grid's.
  const at = (x: number, y: number, z: number, color: number) => setColor(grid, x, y + 6, z + 3, color);
  const strand = (y: number) => (y % 2 === 0 ? C.hair : C.hairLight);
  if (style === 'bun') {
    for (let x = 2; x <= 4; x++) for (let y = 5; y <= 7; y++) for (const z of [-1, -2]) at(x, y, z, (x + y + z) % 3 === 0 ? C.hairLight : C.hair);
  } else if (style === 'ponytail') {
    at(3, 5, -1, C.cord); // tied at the back of the crown
    for (let y = 5; y >= -2; y--) at(3, y, -2, strand(y)); // hanging down the back
    for (const x of [2, 4]) for (let y = 3; y >= 0; y--) at(x, y, -2, C.hair); // fuller in the middle
  } else {
    for (let y = 3; y >= -5; y--) at(3, y, -1, strand(y)); // a braid down past the shoulders
    at(3, -6, -1, C.cord); // tied at its end
  }
  return grid;
}
