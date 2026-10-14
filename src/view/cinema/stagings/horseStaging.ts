// Someone turned into a horse (model/spells/turned.ts), staged part by part (staging.ts; becoming.ts), each part of
// them morphing into the part of it it becomes, a horse built as big as they are:
//  1. a start, themselves;
//  2. the legs into its hind legs: long, straight, black below the knee, hooved;
//  3. the arms (a beast's forelegs) reaching forward and down to the ground: its forelegs;
//  4. the torso (a beast's trunk and tail) bent forward at the waist till it lies level: its barrel, a tail behind;
//  5. the head into its head, on a neck arched up and forward: a mane, a white blaze, ears;
//  6. and to its own size, to give way.
// Anything with no such parts (a spider, a bat, a worm): taken apart whole into its voxels and put together again as
// it (voxelMorph.ts: `cloud`). What has no voxels to take apart either (a ghost, seen through): it only dwindles, and
// that's what's said of it (`lines`). The horse then, itself: a toss of its head, a stamp.
import * as THREE from 'three';
import { createHorse } from '../../meshes/turned/horseRig';
import { HORSE_BODY, HORSE_EAR_ROWS, HORSE_HEAD, HORSE_NECK, HORSE_PALETTE, HORSE_SHAPE, HORSE_VOXEL_SIZE } from '../../meshes/turned/horseVoxels';
import { quadrupedBecoming, type Becoming } from './becoming';
import { bell, through } from '../easing';
import { hued, most, some } from '../morph/clouds';
import { type Telling } from './turning';
import { ON_ALL_FOURS, fourLeggedStaging } from './fourLegged';
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
      { on: 'body', cloud: tail, root: most(tail, 'y'), line: 'A mane, strand by strand, down the neck; a tail, behind.' }, // (behind it, from where it's seen: said with its mane)
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
  ...ON_ALL_FOURS,
  legs: 'Arms and legs lengthen and straighten, all four; black to the knee. Hands and feet close into hooves.',
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

export const horseStaging = fourLeggedStaging({
  title: "Horse-coper's word",
  becomes: 'A horse',
  // (Of what only dwindles: nothing of it to go down on all fours, none of the horse seen till it's there.)
  lines: [
    [0, '{name} hears something call it, from a long way off.'],
    [0.12, 'It thins, and draws in on itself.'],
    [0.5, 'Smaller. Fainter.'],
    [0.85, 'Almost nothing left of it.'],
  ],
  heard: '{name} hears something call it, from a long way off.',
  loosely: 'Taller. Longer. Hooved.',
  shape: HORSE_SHAPE,
  becoming: horseBecoming,
  person: PERSON,
  beast: BEAST,
  make: (material) => createHorse(material),
  height: HORSE.y,
  // Its mane shaken out; a foreleg stamped, twice; a toss of its head.
  settle(horse, j, time) {
    horse.head.rotation.set(-0.45 * bell(through(j, [0.66, 0.96])), Math.sin(time * 26) * 0.3 * bell(through(j, [0.06, 0.32])), Math.sin(time * 26 + 1) * 0.12 * bell(through(j, [0.06, 0.32])));
    horse.legs[3].rotation.x = j > 0.36 && j < 0.62 ? -0.5 * Math.abs(Math.sin(((j - 0.36) / 0.26) * Math.PI * 2)) : 0;
  },
});
