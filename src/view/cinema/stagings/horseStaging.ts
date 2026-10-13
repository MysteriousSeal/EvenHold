// Someone turned into a horse (model/spells/turned.ts), staged part by part (staging.ts; becoming.ts), each part of
// them morphing into the part of it it becomes, a horse built as big as they are:
//  1. a start, themselves;
//  2. the legs into its hind legs: long, straight, black below the knee, hooved;
//  3. the arms (a beast's forelegs) reaching forward and down to the ground: its forelegs;
//  4. the torso (a beast's trunk and tail) bent forward at the waist till it lies level: its barrel, a tail behind;
//  5. the head into its head, on a neck arched up and forward: a mane, a white blaze, ears;
//  6. and to its own size, to give way.
// Anything with no such parts (a spider, a bat, a worm): taken apart whole into its voxels and put together again as
// it (voxelMorph.ts: `cloud`). The horse then, itself: a toss of its head, a stamp.
import * as THREE from 'three';
import { createHorse } from '../../meshes/turned/horseRig';
import { HORSE_BODY, HORSE_EAR_ROWS, HORSE_HEAD, HORSE_NECK, HORSE_PALETTE, HORSE_SHAPE, HORSE_VOXEL_SIZE } from '../../meshes/turned/horseVoxels';
import { quadrupedBecoming, quadrupedClouds, type Becoming } from './becoming';
import { bell, through } from '../easing';
import { hued, joined, some } from '../morph/clouds';
import { UNDRESSED, turningInto, type Telling } from './turning';
import type { Staging } from '../staging';
import type { Cloud } from '../morph/voxelMorph';

const V = HORSE_VOXEL_SIZE;
// The horse, as it stands: how wide, tall (to its ears) and long.
export const HORSE = new THREE.Vector3(HORSE_BODY[0] * V, (HORSE_NECK[1] + HORSE_HEAD[1]) * V, (HORSE_BODY[2] + 5) * V);

const hue = hued(HORSE_PALETTE);
const [COAT, BLACK, WHITE] = [1, 4, 6]; // (horseVoxels.ts's roles)
// Its ears (and the forelock between them): the top rows of its head.
const earsFrom = (head: Cloud, big: number) => Math.max(...head.at.map((at) => at.y)) - V * big * (HORSE_EAR_ROWS - 0.5);

export const horseBecoming: Becoming = quadrupedBecoming(HORSE_SHAPE, HORSE, {
  // What grows on it: its ears; its mane and forelock, down from its poll, and its tail; the blaze down its face.
  grows({ body, head }, big) {
    const from = earsFrom(head, big);
    const poll = head.at.find((at, i) => hue(head, i, BLACK) && at.y >= from)!; // (its forelock, between its ears)
    const tail = some(body, (_at, i) => hue(body, i, BLACK));
    return [
      { on: 'head', cloud: some(head, (at, i) => hue(head, i, COAT) && at.y >= from), line: 'Ears, pricked.' },
      { on: 'head', cloud: some(head, (_at, i) => hue(head, i, BLACK)), root: poll, line: 'A mane, strand by strand, down the neck; a tail, behind.' },
      { on: 'body', cloud: tail, root: tail.at.reduce((best, at) => (at.y > best.y ? at : best)), line: 'A mane, strand by strand, down the neck; a tail, behind.' }, // (behind it, from where it's seen: said with its mane)
      { on: 'head', cloud: some(head, (_at, i) => hue(head, i, WHITE)), root: poll, line: 'A white blaze, down the face.' },
    ];
  },
  // (Without them: no tail; no mane, no ears; its face all its coat's colour.)
  plain(horse, big) {
    const from = earsFrom(horse.head, big);
    horse.body = some(horse.body, (_at, i) => !hue(horse.body, i, BLACK));
    horse.head = some(horse.head, (at, i) => !hue(horse.head, i, BLACK) && at.y < from);
    horse.head.color = horse.head.color.map((color, i) => (hue(horse.head, i, WHITE) ? new THREE.Color(HORSE_PALETTE[COAT - 1]) : color));
  },
});

const PERSON: Telling = {
  start: '{name} hears their name called, from a long way off, and starts.',
  ...UNDRESSED,
  stance: 'They go down on all fours, unsteady: the back level, the hands on the ground.',
  legs: 'Arms and legs lengthen and straighten, all four; black to the knee. Hands and feet close into hooves.',
  arms: '',
  body: 'The back deepens into a barrel.',
  head: 'The neck arches up and forward; the face grows long.',
  done: 'A horse, standing where they stood.',
};
const BEAST: Telling = {
  ...PERSON,
  start: '{name} hears something call it, from a long way off.',
  stance: 'It squares itself up on its four legs.',
  legs: 'The legs lengthen and straighten, all four; black to the knee. Hooves.',
  body: 'The body lengthens into a barrel.',
  done: 'A horse, standing where it stood.',
};

export const horseStaging: Staging = {
  title: "Horse-coper's word",
  becomes: 'A horse',
  lines: [
    [0, '{name} hears their name called, from a long way off.'],
    [0.04, 'They go down on all fours: the back level, the hands on the ground.'],
    [0.27, 'The legs lengthen and straighten, all four. Hands and feet close into hooves.'],
    [0.45, 'The back deepens into a barrel. A tail. The neck arches up; the face grows long.'],
    [0.72, 'A mane. A white blaze.'],
    [0.92, 'A horse, standing where they stood.'],
  ],
  looseLines: [
    [0, '{name} hears something call it, from a long way off.'],
    [0.08, 'It comes apart, from the ground up.'],
    [0.4, 'Every piece of it finds a new place.'],
    [0.72, 'Taller. Longer. Hooved.'],
  ],
  cloud: () => ((horse) => joined([horse.body, horse.head, ...horse.legs], V))(quadrupedClouds(HORSE_SHAPE, 1)),
  direct: turningInto(horseBecoming, { person: PERSON, beast: BEAST }),
  target() {
    const horse = createHorse(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    return {
      root: horse.root,
      height: HORSE.y,
      // Its mane shaken out; a foreleg stamped, twice; a toss of its head.
      settle(j, time) {
        horse.head.rotation.set(-0.45 * bell(through(j, [0.66, 0.96])), Math.sin(time * 26) * 0.3 * bell(through(j, [0.06, 0.32])), Math.sin(time * 26 + 1) * 0.12 * bell(through(j, [0.06, 0.32])));
        horse.legs[3].rotation.x = j > 0.36 && j < 0.62 ? -0.5 * Math.abs(Math.sin(((j - 0.36) / 0.26) * Math.PI * 2)) : 0;
      },
    };
  },
};
