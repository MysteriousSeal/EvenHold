// Someone turned into a rat (model/spells/turned.ts), staged step by step as a cow is (turning.ts; becoming.ts):
// down on all fours; their arms and legs gone to four pink feet; a long low body, its back arched; a head drawn out
// to a point, a pink nose on the end of it. Then what grows on it: its whiskers; its ears, round and pink; its
// tail, out of its rump and along the ground, strand by strand, as long again as it is. A rat as long as they were
// tall, and then down to its own size (a hen's way: chickenStaging.ts).
// Anything with no such parts: taken apart whole into its voxels and put together again as it (voxelMorph.ts:
// `cloud`). The rat then, itself: sat up on its haunches, its nose going; and down again.
import * as THREE from 'three';
import { createRat, satUp } from '../../meshes/turned/ratRig';
import { RAT_COLORS, RAT_VOXEL_SIZE, ratShape } from '../../meshes/turned/ratVoxels';
import { quadrupedBecoming, type Becoming } from './becoming';
import { smooth, through } from '../easing';
import { hued, middleOf, most, some } from '../morph/clouds';
import type { Staging } from '../staging';
import { ON_ALL_FOURS, fourLeggedStaging } from './fourLegged';
import { type Telling } from './turning';
import type { Cloud } from '../morph/voxelMorph';

const V = RAT_VOXEL_SIZE;
const C = RAT_COLORS;
// The rat, as it stands: how wide (across its ears), tall (to the top of them) and long (its nose to the tip of its tail).
export const RAT = new THREE.Vector3(5 * V, 6 * V, 20 * V);
// How tall it's taken to stand for its turning (becoming.ts: it's built as many times its size as they are that):
// more than it does, so that it's built as long as they were tall, tail and all, and not three times that.
const TAKEN = RAT.z / 2.2;

// What of its head's told from the rest: its ears (the two rows over its skull).
const earsOf = (head: Cloud, big: number) => ((top) => (at: THREE.Vector3) => at.y > top - V * big * 2)(Math.max(...head.at.map((at) => at.y)));

// What a rat is, for what has parts to become it, in one of its coats: what grows on it once it's whole, and
// itself plain of that till then.
export function ratBecomingOf(coat = 0): Becoming {
  const shape = ratShape(coat);
  const hue = hued(shape.palette);
  return quadrupedBecoming(shape, new THREE.Vector3(RAT.x, TAKEN, RAT.z), {
    // What grows on it: its whiskers, out from its snout; its ears, up from its skull; its tail, from its rump to its tip.
    grows({ body, head }, big) {
      const ears = some(head, earsOf(head, big));
      const whiskers = some(head, (_at, i) => hue(head, i, C.whisker));
      const tail = some(body, (_at, i) => hue(body, i, C.pink));
      return [
        { on: 'head', cloud: whiskers, root: middleOf(whiskers), line: 'Whiskers.' },
        { on: 'head', cloud: ears, root: most(ears, 'y', -1), line: 'Ears: round, pink, and too big.' },
        { on: 'body', cloud: tail, root: most(tail, 'z'), line: 'A tail: bare, and longer than seems needed.' },
      ];
    },
    // (Without them: no whiskers, no ears, no tail.)
    plain(rat, big) {
      const ears = earsOf(rat.head, big);
      rat.body = some(rat.body, (_at, i) => !hue(rat.body, i, C.pink));
      rat.head = some(rat.head, (at, i) => !hue(rat.head, i, C.whisker) && !ears(at));
    },
  });
}

// Its staging, in one of its coats (RAT_PALETTES): the one it'll be seen in after.
export function ratStagingOf(coat = 0): Staging {
  const shape = ratShape(coat);
  const becoming = ratBecomingOf(coat);

  const PERSON: Telling = {
    start: '{name} smells grain, a long way off, and starts.',
    ...ON_ALL_FOURS,
    legs: 'Arms and legs draw up to almost nothing, all four. What is left of them: pink, bare, clawed.',
    body: 'The back arches, long and low.',
    head: 'The face draws out to a point. A pink nose, at the end of it.',
    done: 'A rat as long as they were tall. And then smaller. Much smaller.',
  };
  const BEAST: Telling = {
    ...PERSON,
    start: '{name} smells grain, a long way off.',
    stance: 'It crouches on its four legs.',
    legs: 'The legs draw up to almost nothing, all four. Pink feet, bare, clawed.',
    body: 'The body draws out, long and low; the back arches.',
    done: 'A rat as long as it was. And then smaller. Much smaller.',
  };

  return fourLeggedStaging({
    title: "Ratcatcher's due",
    becomes: 'A rat',
    lines: [
      [0, '{name} smells grain, a long way off.'],
      [0.04, 'They go down on all fours.'],
      [0.27, 'Arms and legs draw up to almost nothing. Pink feet.'],
      [0.45, 'The back arches, long and low. The face draws out to a point.'],
      [0.72, 'Whiskers. Ears. A tail.'],
      [0.92, 'A rat as long as a man is tall. And then smaller. Much smaller.'],
    ],
    heard: '{name} smells grain, a long way off.',
    loosely: 'Smaller. Lower. Tailed.',
    shape,
    becoming,
    person: PERSON,
    beast: BEAST,
    make: (material) => createRat(material, coat),
    height: RAT.y,
    // Sat up on its haunches, its nose going, a look to either side; and down again, its tail drawn across.
    settle(rat, j, time) {
      const up = smooth(through(j, [0.1, 0.25])) - smooth(through(j, [0.75, 0.9]));
      satUp(rat, up, Math.sin(time * 34) * 0.05 + 0.16 * up * Math.sin(time * 5));
      rat.head.rotation.y = 0.45 * up * Math.sin(through(j, [0.25, 0.75]) * Math.PI * 2);
      rat.tail[0].rotation.y = 0.3 * Math.sin(j * Math.PI * 2);
      rat.tail[1].rotation.y = 0.5 * Math.sin(j * Math.PI * 2 - 0.9);
    },
  });
}

export const ratStaging = ratStagingOf();
