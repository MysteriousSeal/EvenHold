// Someone turned into a donkey, staged step by step as a horse is (turning.ts; becoming.ts; horseStaging.ts): down
// on all fours; all four legs short and straight, hooved; a deep barrel, its belly pale; a thick neck carried low,
// a big heavy head, bare-polled and all its coat's colour till then. Then what grows on it: its ears, long, up from
// its poll; its mane, short, stood up along its neck; its muzzle, paling from the nose back; its tail, thin, down
// to a dark tuft.
// Anything with no such parts: taken apart whole into its voxels and put together again as it (voxelMorph.ts:
// `cloud`). The donkey then, itself: its head thrown up and forward to bray, heaving; then its ears shaken.
import * as THREE from 'three';
import { createDonkey } from '../../meshes/turned/donkeyRig';
import { DONKEY_BODY, DONKEY_COLORS, DONKEY_EAR_ROWS, DONKEY_HEAD, DONKEY_NECK, DONKEY_VOXEL_SIZE, donkeyShape } from '../../meshes/turned/donkeyVoxels';
import { quadrupedBecoming, type Becoming } from './becoming';
import { bell, through } from '../easing';
import { hued, most, some } from '../morph/clouds';
import type { Staging } from '../staging';
import { ON_ALL_FOURS, fourLeggedStaging } from './fourLegged';
import { type Telling } from './turning';
import type { Cloud } from '../morph/voxelMorph';

const V = DONKEY_VOXEL_SIZE;
const C = DONKEY_COLORS;
// The donkey, as it stands: how wide, tall (to the tips of its ears) and long.
export const DONKEY = new THREE.Vector3(DONKEY_BODY[0] * V, (DONKEY_NECK[1] + DONKEY_HEAD[1]) * V, (DONKEY_BODY[2] + 7) * V);

// What of it's told from the rest: its ears (the top rows of its head), its tail (the rows behind its quarters).
const earsFrom = (head: Cloud, big: number) => Math.max(...head.at.map((at) => at.y)) - V * big * (DONKEY_EAR_ROWS - 0.5);
const tailOf = (body: Cloud, big: number) => ((back) => (at: THREE.Vector3) => at.z < back + V * big * 1.5)(Math.min(...body.at.map((at) => at.z)));

// What it is, in one of its coats, for what has parts to become it (becoming.ts).
export function donkeyBecomingOf(coat = 0): Becoming {
  const shape = donkeyShape(coat);
  const hue = hued(shape.palette);
  const COAT = new THREE.Color(shape.palette[C.coat - 1]);
  return quadrupedBecoming(shape, DONKEY, {
    // What grows on it: its ears, up from its poll; its mane, down its neck from there; the pale of its muzzle,
    // back from its nose; its tail, down from its dock.
    grows({ body, head }, big) {
      const [from, tail] = [earsFrom(head, big), tailOf(body, big)];
      const ears = some(head, (at) => at.y >= from);
      const mane = some(head, (at, i) => at.y < from && hue(head, i, C.dark));
      const muzzle = some(head, (at, i) => at.y < from && hue(head, i, C.pale));
      const hung = some(body, (at) => tail(at));
      return [
        { on: 'head', cloud: ears, root: most(ears, 'y', -1), line: 'Ears: long. Then longer.' },
        { on: 'head', cloud: mane, root: most(mane, 'y'), line: 'A mane, short, stood up along the neck.' },
        { on: 'head', cloud: muzzle, root: most(muzzle, 'z'), line: 'The muzzle pales, as if dipped in meal.' },
        { on: 'body', cloud: hung, root: most(hung, 'y'), line: 'A thin tail, behind, a tuft at its end.' },
      ];
    },
    // (Without them: no ears, no mane; no tail; its muzzle its coat's colour.)
    plain(donkey, big) {
      const [from, tail] = [earsFrom(donkey.head, big), tailOf(donkey.body, big)];
      donkey.body = some(donkey.body, (at) => !tail(at));
      donkey.head = some(donkey.head, (at, i) => at.y < from && !hue(donkey.head, i, C.dark));
      donkey.head.color = donkey.head.color.map((color, i) => (hue(donkey.head, i, C.pale) ? COAT.clone() : color));
    },
  });
}

// Its staging, in one of its coats (DONKEY_PALETTES): the one it'll be seen in after.
export function donkeyStagingOf(coat = 0): Staging {
  const shape = donkeyShape(coat);
  const becoming = donkeyBecomingOf(coat);

  const PERSON: Telling = {
    start: "{name} hears a drover's stick on a gatepost, and starts.",
    ...ON_ALL_FOURS,
    legs: 'Arms and legs shorten and straighten, all four. Hands and feet close into hooves.',
    body: 'The back deepens into a barrel; the belly pales.',
    head: 'The neck thickens, carried low; the head grows long, and heavy.',
    done: 'A donkey, where they stood.',
  };
  const BEAST: Telling = {
    ...PERSON,
    start: "{name} hears a drover's stick on a gatepost, somewhere.",
    stance: 'It squares itself up on its four legs.',
    legs: 'The legs straighten, all four. Hooves, small and upright.',
    body: 'The body deepens into a barrel; the belly pales.',
    done: 'A donkey, where it stood.',
  };

  return fourLeggedStaging({
    title: "Drover's word",
    becomes: 'A donkey',
    lines: [
      [0, "{name} hears a drover's stick on a gatepost."],
      [0.04, 'They go down on all fours.'],
      [0.27, 'The legs shorten and straighten, all four. Hooves.'],
      [0.45, 'The back deepens into a barrel. A big, heavy head.'],
      [0.72, 'Long ears. A short mane. A pale muzzle.'],
      [0.92, 'A donkey, where they stood.'],
    ],
    heard: "{name} hears a drover's stick on a gatepost, somewhere.",
    loosely: 'Stockier. Longer in the ear. Hooved.',
    shape,
    becoming,
    person: PERSON,
    beast: BEAST,
    make: (material) => createDonkey(material, coat),
    height: DONKEY.y,
    // Its head thrown up and forward to bray, heaving with each breath of it; then shaken, its ears with it.
    settle(donkey, j, time) {
      const [braying, shaking] = [bell(through(j, [0.06, 0.56])), bell(through(j, [0.64, 0.94]))];
      donkey.head.rotation.set(-(0.42 + 0.1 * Math.sin(time * 11)) * braying, Math.sin(time * 24) * 0.14 * shaking, Math.sin(time * 24 + 1) * 0.22 * shaking);
    },
  });
}

export const donkeyStaging = donkeyStagingOf();
