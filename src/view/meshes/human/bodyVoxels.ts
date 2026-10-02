// The body humanoids have (the hero, bandits, villagers), in two builds:
// male, and a slimmer female one (a narrow torso with a waist and a bust,
// thin arms, slim legs; the same height and the same head, so what's worn
// on the head fits both). Naked but for dyed braies (medieval underwear),
// and on her a breast band of the same cloth. Nothing is ever painted onto
// it: armor is worn over it as separate models (gear/), fitted to either
// build. Only its look changes from person to person (model/human/humanoid.ts):
// the build, the skin tone, the hair color and style, a beard.
//
// 1/60 voxels, much finer than the world's 0.04: at world scale the
// 0.45-tall body would be 11 voxels, too coarse for a face or armor detail.
// 11 voxels of legs, 9 of torso, a 7-voxel head (27 = 0.45 tall). Every part faces +Z (the
// eyes and toes point that way) and is a separate grid, so each can swing on
// its own joint.

import * as THREE from 'three';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { createGrid, fillBox, setColor } from '../voxel/voxelShapes';
import type { HeldSlot } from '../../../model/human/equipment';
import { DYE_COUNT, HAIR_COLOR_COUNT, SKIN_TONE_COUNT, type BodyLook, type Build } from '../../../model/human/humanoid';

export const HUMAN_VOXEL_SIZE = 1 / 60;
export const BODY_HEIGHT = 27; // voxels, feet to crown (0.45 world units)
// What's held (weapons, shields) is modelled in coarser voxels, the body's
// before it grew finer, and keeps its size in the world.
export const HELD_VOXEL_SIZE = 0.025;

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
// hips at the tops of the limbs (the shoulders half a voxel under the
// torso's top, so nothing worn on the chest shares a face with the arm's). The body faces +Z, so its right side is -X.
// 7 voxels of legs, 9 of torso, a big 11-voxel head (27 = 0.45 tall):
// chunky, readable proportions from the isometric camera.
export const BODIES: Record<Build, BodyShape> = {
  male: {
    grid: {
      leg: [4, 7, 5], // the foot sticks out forward
      torso: [9, 9, 5],
      arm: [3, 9, 3],
      head: [11, 11, 11],
    },
    pivot: { torso: [4.5, 0, 2.5], head: [5.5, 0, 5.5], arm: [1.5, 9, 1.5], leg: [2, 7, 2] },
    joints: {
      torso: { part: 'torso', side: 'center', at: [0, 7, 0] },
      head: { part: 'head', side: 'center', at: [0, 16, 0] },
      rightArm: { part: 'arm', side: 'right', at: [-6, 15.5, 0] },
      leftArm: { part: 'arm', side: 'left', at: [6, 15.5, 0] },
      rightLeg: { part: 'leg', side: 'right', at: [-2.5, 7, 0] },
      leftLeg: { part: 'leg', side: 'left', at: [2.5, 7, 0] },
    },
    hand: [0, -8, 0],
  },
  female: {
    grid: {
      leg: [3, 7, 4], // slimmer, the foot forward
      torso: [7, 9, 5], // narrower and shallower; the bust in its front layer
      arm: [2, 9, 2], // thin
      head: [11, 11, 11],
    },
    pivot: { torso: [3.5, 0, 2], head: [5.5, 0, 5.5], arm: [1, 9, 1], leg: [1.5, 7, 1.5] },
    joints: {
      torso: { part: 'torso', side: 'center', at: [0, 7, 0] },
      head: { part: 'head', side: 'center', at: [0, 16, 0] },
      // A quarter voxel off her sides (too little to see), so what's worn on
      // her shoulders never lines up with what's on her head.
      rightArm: { part: 'arm', side: 'right', at: [-4.75, 15.5, 0] },
      leftArm: { part: 'arm', side: 'left', at: [4.75, 15.5, 0] },
      rightLeg: { part: 'leg', side: 'right', at: [-2, 7, 0] },
      leftLeg: { part: 'leg', side: 'left', at: [2, 7, 0] },
    },
    hand: [0, -8, 0.5], // half a voxel forward: what she holds (in its coarser voxels) then never shares a face with her arm, gloves or hips
  },
};
// The male build's, for what doesn't depend on who wears it.
export const PART_GRID: Sizes = BODIES.male.grid;
export const JOINTS: JointAt = BODIES.male.joints;
export const JOINT_NAMES = Object.keys(JOINTS) as Joint[];

// Which arm holds each hand's item (the hand's middle is the build's `hand`).
export const HELD_BY: Record<HeldSlot, Joint> = { mainHand: 'rightArm', offHand: 'leftArm' };

// Skin tones, each with its shading, highlight, cheeks and mouth: fair, light, tanned, deep; then (added after,
// so saves keep theirs) pale, the palest, dark, the darkest, olive, between light and tanned, and bronze, between
// tanned and deep (shown palest to darkest on the creation screen: model/human/lookTraits.ts).
const SKIN_TONES: Array<[skin: number, shade: number, light: number, cheek: number, mouth: number]> = [
  [0xf0c49a, 0xd9a37a, 0xf8d9b6, 0xe8a58a, 0xb5705a],
  [0xe2b48c, 0xc79670, 0xeec7a2, 0xd89478, 0xa8644e],
  [0xc68e62, 0xa8724a, 0xd6a47a, 0xb87658, 0x8a4e3a],
  [0x8e5e3e, 0x74492e, 0xa2704c, 0x80503a, 0x5e3426],
  [0xf8e0ca, 0xe6c3a6, 0xfdeee0, 0xf2b9a6, 0xc2806e],
  [0x5f3b27, 0x4a2c1c, 0x75492f, 0x5c3626, 0x3c2117],
  [0xd2a676, 0xb68a5c, 0xe0b98c, 0xc48868, 0x965a42],
  [0xab7448, 0x8e5c36, 0xbd8658, 0x9c6044, 0x74402e],
];
// Hair colors with their highlight: chestnut, black, fair, red, grey; then (added after, so saves keep theirs)
// platinum, auburn, white (shown light to dark on the creation screen: model/human/lookTraits.ts).
const HAIR_COLORS: Array<[hair: number, light: number]> = [
  [0x6b4226, 0x8a5a35],
  [0x2e2420, 0x463830],
  [0xb07a3a, 0xc8944e],
  [0x8a3a22, 0xa85232],
  [0x9a948a, 0xb8b2a6],
  [0xdcc896, 0xeee0b8],
  [0x5e2a1c, 0x7a3a26],
  [0xe2ded6, 0xf6f3ee],
];
// Dyes for the braies (and her breast band), each with its shading: madder
// red, woad blue, weld green, walnut brown, charcoal, EvenHold's turquoise; then (added after, so saves keep
// theirs) saffron yellow and orchil purple.
// Strong against the sandstone and grass, so people stand out from the ground.
const DYES: Array<[dye: number, shade: number]> = [
  [0x9c3b2e, 0x7e2e24],
  [0x3d5f8c, 0x2f4a6e],
  [0x6f7f34, 0x566429],
  [0x6b4a30, 0x533824],
  [0x45423f, 0x33312f],
  [0x2f8a86, 0x236a67],
  [0xc9952c, 0xa47620],
  [0x6c3866, 0x542a50],
];
if (SKIN_TONES.length !== SKIN_TONE_COUNT || HAIR_COLORS.length !== HAIR_COLOR_COUNT || DYES.length !== DYE_COUNT) {
  throw new Error('body palettes out of step with model/human/humanoid.ts');
}

// A look trait's colour, for its swatch on the character creation screen (null: a trait that isn't a colour).
export function lookSwatch(key: keyof BodyLook, value: unknown): number | null {
  const i = value as number;
  if (key === 'skin') return SKIN_TONES[i % SKIN_TONE_COUNT][0];
  if (key === 'hair') return HAIR_COLORS[i % HAIR_COLOR_COUNT][0];
  if (key === 'dye') return DYES[i % DYE_COUNT][0];
  return null;
}

const EYE = 0x2b2522;
const GLINT = 0xfdf8ee; // the light in her eyes
const CORD = 0x8a6a45;

// A color scaled toward black (< 1) or white (> 1), for the deeper and lighter tones of a ramp.
function tone(color: number, by: number): number {
  const c = new THREE.Color(color);
  return (by < 1 ? c.multiplyScalar(by) : c.lerp(new THREE.Color(0xffffff), by - 1)).getHex();
}

// Palette indices + 1, in the order bodyPalette() lists the colors: each
// material in a ramp (skin in four tones, hair in three, the cloth in three).
const C = {
  skin: 1,
  skinShade: 2,
  skinLight: 3,
  skinDeep: 4, // the deepest shade: creases, under the brows, the navel
  hair: 5,
  hairLight: 6,
  hairDark: 7, // brows, and the darker strands
  eye: 8,
  cheek: 9,
  mouth: 10,
  cloth: 11,
  clothShade: 12,
  clothLight: 13,
  cord: 14,
  glint: 15,
};

export function bodyPalette(look: BodyLook): number[] {
  const [skin, shade, light, cheek, mouth] = SKIN_TONES[look.skin % SKIN_TONE_COUNT];
  const [hair, hairLight] = HAIR_COLORS[look.hair % HAIR_COLOR_COUNT];
  const [dye, dyeShade] = DYES[look.dye % DYE_COUNT];
  return [skin, shade, light, tone(shade, 0.82), hair, hairLight, tone(hair, 0.72), EYE, cheek, mouth, dye, dyeShade, tone(dye, 1.18), CORD, GLINT];
}

// A leg: braies over the thigh (hemmed above the knee), a kneecap catching
// the light, a shaded calf, and a foot reaching forward (+Z) with a darker
// heel and toes. Shaded on its outer side so the two legs separate.
export function buildLeg(build: Build = 'male'): VoxelGrid {
  const [w, h, d] = BODIES[build].grid.leg;
  const grid = createGrid(BODIES[build].grid.leg);
  const front = d - 2; // the leg's front layer (the foot reaches one further)
  fillBox(grid, 0, 1, 0, w - 1, h - 1, front, (x, y, z) => {
    if (y >= 4) return y === 4 ? C.clothShade : x === 0 || z === 0 ? C.clothShade : y === h - 1 && z === front ? C.clothLight : C.cloth; // braies
    if (z === front && y === 3) return C.skinLight; // the kneecap
    if (z === 0 && y === 3) return C.skinDeep; // behind the knee
    if (z === 0 && y <= 2) return C.skinShade; // the calf
    return x === 0 ? C.skinShade : C.skin;
  });
  fillBox(grid, 0, 0, 0, w - 1, 0, d - 1, (x, _y, z) => (z === 0 ? C.skinShade : z === d - 1 ? (x % 2 === 1 ? C.skinShade : C.skinLight) : C.skin)); // the foot: heel, toes
  return grid;
}

// The torso: braies up to the waist, tied with a cord; above it a bare
// chest, shaded at the sides and back, with a line down the belly, the
// navel, the chest catching the light over a shaded fold, and collarbones.
// Hers: hips in braies, a narrow waist tied with the cord, the ribs
// widening to a band over the bust (standing out in front), bare shoulders.
export function buildTorso(build: Build = 'male'): VoxelGrid {
  const [w, , d] = BODIES[build].grid.torso;
  const grid = createGrid(BODIES[build].grid.torso);
  const mid = (w - 1) / 2;
  const skin = (x: number, z: number) => (x === 0 || x === w - 1 || z === 0 ? C.skinShade : C.skin); // shaded at the sides and back
  const cloth = (x: number, y: number, z: number, front: number) => (x === 0 || x === w - 1 || z === 0 ? C.clothShade : y === 2 && z === front ? C.clothLight : C.cloth);
  if (build === 'female') {
    const front = d - 2; // her front; the bust stands one further
    fillBox(grid, 0, 0, 0, w - 1, 2, front, (x, y, z) => (z === front && x === mid && y === 0 ? C.clothShade : cloth(x, y, z, front))); // hips
    fillBox(grid, 1, 3, 0, w - 2, 3, front, C.cord); // the waist, tied
    fillBox(grid, 1, 4, 0, w - 2, 4, front, (x, _y, z) => (z === front && x === mid ? C.skinDeep : x === 1 || x === w - 2 || z === 0 ? C.skinShade : C.skin)); // midriff, the navel
    fillBox(grid, 0, 5, 0, w - 1, 5, front, (x, _y, z) => skin(x, z)); // ribs
    fillBox(grid, 0, 6, 0, w - 1, 7, front, (x, y, z) => (x === 0 || x === w - 1 || z === 0 ? C.clothShade : y === 7 ? C.clothLight : C.cloth)); // the band
    fillBox(grid, 1, 6, d - 1, w - 2, 7, d - 1, (x, y) => (x === mid ? C.clothShade : y === 7 ? C.clothLight : C.cloth)); // over the bust
    fillBox(grid, 0, 8, 0, w - 1, 8, front, (x, _y, z) => (z === front && x > 0 && x < w - 1 ? C.skinLight : skin(x, z))); // shoulders, collarbones
    return grid;
  }
  const front = d - 1;
  fillBox(grid, 0, 0, 0, w - 1, 2, front, (x, y, z) => (z === front && x === mid && y === 0 ? C.clothShade : cloth(x, y, z, front))); // braies
  fillBox(grid, 0, 3, 0, w - 1, 3, front, (x, _y, z) => (z === front && x === mid ? C.clothShade : C.cord)); // the cord, knotted
  fillBox(grid, 0, 4, 0, w - 1, 8, front, (x, y, z) => {
    if (z === front) {
      if (y === 8) return x > 0 && x < w - 1 ? C.skinLight : C.skinShade; // collarbones
      if (y === 7 && x !== mid && x > 0 && x < w - 1) return C.skinLight; // the chest, lit
      if (y === 6 && x !== mid && x > 1 && x < w - 2) return C.skinShade; // its fold
      if (x === mid && y === 4) return C.skinDeep; // the navel
      if (x === mid && y === 5) return C.skinShade; // down the belly
    }
    if (y === 8 && (x === 0 || x === w - 1)) return C.skinLight; // the tops of the shoulders
    return skin(x, z);
  });
  return grid;
}

// An arm hanging from the shoulder: a lit shoulder cap, the upper arm, a
// shaded elbow, the forearm, a darker wrist, and the hand: its back lit,
// the fingers below with lines between them.
export function buildArm(build: Build = 'male'): VoxelGrid {
  const [w, h, d] = BODIES[build].grid.arm;
  const grid = createGrid(BODIES[build].grid.arm);
  fillBox(grid, 0, 0, 0, w - 1, h - 1, d - 1, (x, y, z) => {
    const outer = x === 0 && w > 1;
    if (y === 0) return z === d - 1 && x % 2 === 1 ? C.skinShade : C.skin; // fingers
    if (y === 1) return z === d - 1 ? C.skinLight : C.skin; // the back of the hand
    if (y === 2) return C.skinShade; // the wrist
    if (y === 4 && z === 0) return C.skinDeep; // the elbow
    if (y === h - 1) return C.skinLight; // the shoulder
    if (y === 6 && z === d - 1) return C.skinLight; // the upper arm, lit in front
    return outer ? C.skinShade : C.skin;
  });
  return grid;
}

// The head: the face on the +Z side (his simple: dark eyes set apart under
// short brows, a hint of a nose, a touch of blush, a small mouth, a
// moustache in a beard; hers cute: big glinting eyes with lashes, rosy
// cheeks, a tiny mouth), ears on the sides, and the hair in its style, in
// three tones. Always a full 11-voxel cube, so anything worn on
// the head fits every style.
export function buildHead(look: Pick<BodyLook, 'build' | 'hairStyle' | 'beard'>): VoxelGrid {
  const N = PART_GRID.head[0];
  const L = N - 1; // the last row: the front, the top, the far side
  const M = (N - 1) / 2; // the middle
  const grid = createGrid(PART_GRID.head);
  fillBox(grid, 0, 0, 0, L, L, L, (x, _y, z) => (x === 0 || x === L || z === 0 ? C.skinShade : C.skin));
  const strands = (a: number, b: number) => [C.hair, C.hairLight, C.hair, C.hairDark, C.hair][(a * 2 + b) % 5];
  const style = look.hairStyle;
  // Ears, a shadowed hollow with a lit rim, on either side.
  for (const x of [0, L]) {
    fillBox(grid, x, 4, 4, x, 6, 5, (_x, y, z) => (y === 5 && z === 4 ? C.skinDeep : C.skinShade));
    setColor(grid, x, 6, 5, C.skinLight);
  }
  if (style === 'bald') {
    fillBox(grid, 1, L, 1, L - 1, L, L - 1, (x, _y, z) => ((x + z) % 4 === 0 ? C.skinLight : C.skin)); // a shine on the crown
  } else if (style === 'warriorTail') {
    // The sides shaved to a stubble; a strip of hair down the middle, swept back over the crown, tied into a
    // short tail at the back (buildHairPiece).
    for (const x of [0, L]) fillBox(grid, x, 7, 0, x, L, 7, (_x, y, z) => ((y + z) % 3 === 0 ? C.hairDark : C.skinShade));
    fillBox(grid, 1, L, 0, L - 1, L, L, (x) => (x < 3 || x > L - 3 ? ((x + 1) % 2 ? C.hairDark : C.skinShade) : C.skin)); // stubble, then the strip
    fillBox(grid, 3, L, 0, L - 3, L, L, (x, _y, z) => (x === M ? (z % 3 === 0 ? C.hairLight : C.hair) : z % 2 ? C.hair : C.hairDark)); // swept back
    fillBox(grid, 3, 6, 0, L - 3, L - 1, 0, (x, y) => strands(x, y)); // down the back of the head, to the tie
    fillBox(grid, 3, L - 1, L, L - 3, L - 1, L, (x) => (x === M ? C.hairLight : C.hair)); // its front, pushed up off the brow
  } else if (style === 'shaggy') {
    // An untamed mop to the shoulders: ragged ends at the back and sides (some locks hanging lower), a ragged
    // fringe across the brow, a lock or two falling over it (clear of the eyes and brows).
    fillBox(grid, 0, L, 0, L, L, L, (x, _y, z) => strands(x, z));
    for (let x = 0; x <= L; x++) fillBox(grid, x, x % 3 === 0 ? 0 : x % 3 === 1 ? 1 : 2, 0, x, L - 1, 1, (_x, y, z) => strands(x + z, y));
    for (const x of [0, L]) for (let z = 0; z <= 7; z++) fillBox(grid, x, z % 2 ? 2 : 3, z, x, L - 1, z, (_x, y) => strands(z, y));
    fillBox(grid, 1, 9, L, L - 1, 9, L, (x) => (x % 3 === 1 ? C.hairLight : x % 2 ? C.hairDark : C.hair));
    for (const x of [3, 6, 7]) setColor(grid, x, 8, L, x === 6 ? C.hairDark : C.hair); // locks over the brow
  } else {
    fillBox(grid, 0, L, 0, L, L, L, (x, _y, z) => strands(x, z)); // the crown
    if (style === 'cropped') {
      // Close-cropped all over: a short dark nap wherever hair grows (the crown, the back down to the nape, the
      // sides above the ears to the temples), a clean straight hairline at the brow; no fringe.
      const nap = (a: number, b: number) => ((a + b) % 3 === 0 ? C.hairDark : (a * b) % 5 === 1 ? C.hairLight : C.hair);
      fillBox(grid, 0, L, 0, L, L, L, (x, _y, z) => nap(x, z));
      fillBox(grid, 0, 2, 0, L, L - 1, 0, (x, y) => nap(x, y));
      for (const x of [0, L]) fillBox(grid, x, 7, 0, x, L - 1, L - 1, (_x, y, z) => nap(z, y));
      fillBox(grid, 1, 9, L, L - 1, 9, L, C.hairDark); // the hairline
    } else if (style === 'bob') {
      // Cut straight at the chin all round, a straight fringe across the brow.
      fillBox(grid, 0, 2, 0, L, L - 1, 1, (x, y) => strands(x, y));
      for (const x of [0, L]) fillBox(grid, x, 2, 0, x, L - 1, L - 1, (_x, y, z) => (y === 2 ? C.hairDark : strands(z, y)));
      fillBox(grid, 1, 9, L, L - 1, 9, L, (x) => (x % 3 === 0 ? C.hairLight : C.hair));
    } else {
      // Down the back (to the nape, or the neck when long) and the sides.
      // Twin braids hang from hair brought down over the sides, in front of the ears.
      const long = style === 'long' || style === 'waves';
      const sides = long ? { low: 2, forward: 8 } : style === 'twinBraids' ? { low: 3, forward: 8 } : { low: 7, forward: 6 };
      fillBox(grid, 0, long ? 0 : 2, 0, L, L - 1, 1, (x, y) => strands(x, y));
      for (const x of [0, L]) fillBox(grid, x, sides.low, 0, x, L - 1, sides.forward, (_x, y, z) => strands(z, y));
      fillBox(grid, 1, 9, L, L - 1, 9, L, (x) => (x === M ? C.skinShade : x === M - 1 || x === M + 1 ? C.hairLight : C.hair)); // the fringe, parted
    }
  }
  if (look.build === 'female') {
    // Hers, cute: big eyes set low and close, a glint in each, a lash
    // flicking out at the corner, soft brows of her hair, rosy cheeks under
    // the eyes, and a tiny mouth.
    for (const side of [-1, 1]) {
      const x = M + side * 2;
      fillBox(grid, x, 4, L, x, 6, L, (_x, y) => (y === 6 ? C.glint : C.eye)); // an eye, and its glint
      setColor(grid, x + side, 6, L, C.eye); // wide at the top
      setColor(grid, x + side * 2, 7, L, C.hairDark); // a lash, flicking out
      fillBox(grid, x, 8, L, x + side, 8, L, C.hair); // a soft brow
      fillBox(grid, x + side, 3, L, x + side * 2, 3, L, C.cheek); // blush
    }
    setColor(grid, M, 2, L, C.mouth); // a tiny mouth
    return grid;
  }
  // His: kept simple, so it reads from afar.
  for (const x of [M - 3, M + 3]) {
    fillBox(grid, x, 5, L, x, 6, L, C.eye); // eyes
    setColor(grid, x, 8, L, C.hairDark); // brows
    setColor(grid, x + (x < M ? -1 : 1), 8, L, C.hairDark);
    setColor(grid, x + (x < M ? -1 : 1), 3, L, C.cheek); // a touch of blush
  }
  setColor(grid, M, 4, L, C.skinShade); // a hint of a nose
  if (look.beard) {
    fillBox(grid, 1, 0, L, L - 1, 2, L, (x, y) => (y === 2 && x >= M - 2 && x <= M + 2 ? C.hairDark : strands(x, y))); // a moustache over the beard
    for (const x of [0, L]) fillBox(grid, x, 0, 6, x, 5, L, (_x, y, z) => strands(z, y)); // sideburns
  } else {
    setColor(grid, M, 2, L, C.mouth);
  }
  return grid;
}

export function buildBodyPart(part: BodyPart, look: Pick<BodyLook, 'build' | 'hairStyle' | 'beard'>): VoxelGrid {
  if (part === 'head') return buildHead(look);
  if (part === 'torso') return buildTorso(look.build);
  return part === 'arm' ? buildArm(look.build) : buildLeg(look.build);
}

// Hair gathered up past the head (a bun, a ponytail, braids, pigtails, a
// crown braid, loose waves, a topknot, a warrior's tail, long hair to the
// shoulders, shaggy tufts), as its own piece on the head's
// joint, left off under anything worn on the head; or null for styles that
// stay within it. Its grid spans 2 either side of the head, from 9 below it
// to 5 over, and from 4 behind it to 1 in front; `pivot` is the head's
// joint in it.
export const HAIR_PIECE_GRID: [number, number, number] = [15, 25, 16];
export const HAIR_PIECE_PIVOT: [number, number, number] = [7.5, 9, 9.5];
const GATHERED = ['bun', 'ponytail', 'braid', 'twinBraids', 'crownBraid', 'waves', 'pigtails', 'topknot', 'warriorTail', 'long', 'shaggy'] as const;
export function buildHairPiece(style: BodyLook['hairStyle']): VoxelGrid | null {
  if (!(GATHERED as readonly string[]).includes(style)) return null;
  const grid = createGrid(HAIR_PIECE_GRID);
  // Head coordinates (x, y, z 0..10 across the head's cube; -1 just outside it) into the grid's.
  const at = (x: number, y: number, z: number, color: number) => {
    const [gx, gy, gz] = [x + 2, y + 9, z + 4];
    if (gx < 0 || gy < 0 || gz < 0 || gx >= HAIR_PIECE_GRID[0] || gy >= HAIR_PIECE_GRID[1] || gz >= HAIR_PIECE_GRID[2]) throw new Error(`${style} reaches past its grid`);
    setColor(grid, gx, gy, gz, color);
  };
  const strand = (y: number) => [C.hairDark, C.hair, C.hairLight][((y % 3) + 3) % 3];
  // A braid hanging from `top` down to `bottom`, thick enough to read from
  // afar (x0..x1 across, z0..z1 deep), plaited: its strands cross, light and
  // dark zigzagging down it; tied at its end.
  const braid = (x0: number, x1: number, z0: number, z1: number, top: number, bottom: number) => {
    for (let y = top; y >= bottom; y--) {
      for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) at(x, y, z, (x + z + y) % 2 === 0 ? C.hairLight : y % 2 === 0 ? C.hair : C.hairDark);
    }
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) at(x, bottom - 1, z, C.cord);
  };
  switch (style) {
    case 'bun':
      for (let x = 4; x <= 6; x++) for (let y = 8; y <= 11; y++) for (const z of [-1, -2, -3]) at(x, y, z, (x + y + z) % 3 === 0 ? C.hairLight : (x + y) % 4 === 0 ? C.hairDark : C.hair);
      for (const x of [3, 7]) for (let y = 9; y <= 10; y++) at(x, y, -2, C.hair); // rounder in the middle
      break;
    case 'ponytail':
      at(5, 8, -1, C.cord); // tied at the back of the crown
      for (let y = 8; y >= -3; y--) at(5, y, -2, strand(y)); // hanging down the back
      for (const x of [4, 6]) for (let y = 6; y >= 0; y--) at(x, y, -2, strand(y + 1)); // fuller in the middle
      break;
    case 'braid':
      braid(4, 6, -2, -1, 7, -8); // one thick braid down the back, past the shoulders
      break;
    case 'twinBraids':
      // A braid either side, from the hair at the side of the crown, falling in front of the shoulders.
      braid(-2, -1, 6, 7, 9, -6);
      braid(11, 12, 6, 7, 9, -6);
      break;
    case 'crownBraid':
      // A braid wound round the head above the brow, two rows deep, plaited.
      for (let i = -1; i <= 11; i++) {
        for (const y of [8, 9]) {
          const plait = (i + y) % 2 === 0 ? C.hairLight : C.hairDark;
          at(i, y, -1, plait);
          at(i, y, 11, plait);
          at(-1, y, i, plait);
          at(11, y, i, plait);
        }
      }
      break;
    case 'waves': {
      // Long and full, down past the shoulders at the back and over the
      // sides: its tones in diagonal bands, rolling like waves.
      const wave = (a: number, y: number) => strand(y + Math.floor(a / 2));
      for (let x = 0; x <= 10; x++) for (let y = 10; y >= -4; y--) at(x, y, -1, wave(x, y));
      for (const x of [-1, 11]) for (let y = 9; y >= 0; y--) for (let z = 0; z <= 6; z++) at(x, y, z, wave(z, y));
      break;
    }
    case 'pigtails':
      // Tied behind the ears, a full tail hanging from each.
      for (const x of [-1, 11]) {
        at(x, 7, 3, C.cord);
        for (let y = 7; y >= 1; y--) for (const z of [2, 3]) at(x < 0 ? -2 : 12, y, z, strand(y + z));
      }
      break;
    case 'warriorTail':
      // The strip of hair tied at the back of the head (the knot standing out), a short thick tail hanging from
      // the tie close against the head, narrowing to its end.
      for (const x of [4, 5, 6]) at(x, 7, -1, C.cord);
      at(5, 7, -2, C.cord);
      for (let y = 6; y >= 0; y--) for (let x = 4; x <= 6; x++) if (y > 1 || x === 5) at(x, y, -1, strand(y + x));
      break;
    case 'long':
      // Straight, falling past the head to the shoulders: a curtain down the back (its ends a little uneven),
      // and down either side behind the ears; its strands run straight down, light and dark.
      for (let x = 0; x <= 10; x++) for (let y = 9; y >= (x % 3 === 1 ? -4 : -3); y--) at(x, y, -1, strand(x));
      for (const x of [-1, 11]) for (let z = 0; z <= 3; z++) for (let y = 9; y >= (z === 3 ? 0 : -2); y--) at(x, y, z, strand(z + 1));
      break;
    case 'shaggy':
      // Untamed: tufts sticking up off the crown, ends flicking out at the sides and the back, so it's messy
      // in silhouette, not only in its colours.
      for (const [x, z, c] of [[2, 3, C.hair], [5, 1, C.hairLight], [7, 5, C.hairDark], [3, 8, C.hairLight], [8, 9, C.hair], [6, 7, C.hair]]) at(x, 11, z, c);
      at(5, 12, 1, C.hair); // (one taller)
      for (const x of [-1, 11]) {
        at(x, 3, 1, C.hair);
        at(x, 4, 0, C.hairDark);
        at(x, 2, 2, C.hairLight);
      }
      for (const [x, y] of [[1, 0], [4, 1], [6, -1], [9, 0]]) at(x, y, -1, y < 0 ? C.hairDark : C.hair);
      break;
    case 'topknot':
      // Pulled up into a knot on top of the crown.
      for (let x = 4; x <= 6; x++) for (let z = 4; z <= 6; z++) at(x, 11, z, C.cord);
      for (let x = 4; x <= 6; x++) for (let y = 12; y <= 14; y++) for (let z = 4; z <= 6; z++) at(x, y, z, (x + y + z) % 3 === 0 ? C.hairLight : C.hair);
      break;
  }
  return grid;
}
