// Someone turned into a pig, staged step by step as a cow is (turning.ts; becoming.ts; cowStaging.ts): down on all
// fours; all four legs shortened to almost nothing, on trotters; a long low barrel, its belly near the ground; a
// head set low into its shoulders, blunt-faced till then. Then what grows on it: its snout, pushed out to a flat
// disc; its ears, flopped forward; the curl of its tail; its spots, here and there, if its coat has them.
// Anything with no such parts: taken apart whole into its voxels and put together again as it (voxelMorph.ts:
// `cloud`). The pig then, itself: its snout lifted, sniffing; then down, rooting.
import * as THREE from 'three';
import { createPig } from '../../meshes/turned/pigRig';
import { PIG_BODY, PIG_COLORS, PIG_HEAD, PIG_NECK, PIG_SNOUT_ROWS, PIG_SPOTTED, PIG_VOXEL_SIZE, pigShape } from '../../meshes/turned/pigVoxels';
import { quadrupedBecoming, quadrupedClouds, type Becoming } from './becoming';
import { bell, through } from '../easing';
import { hued, joined, some } from '../morph/clouds';
import type { Staging } from '../staging';
import { UNDRESSED, turningInto, type Telling } from './turning';
import type { Cloud } from '../morph/voxelMorph';

const V = PIG_VOXEL_SIZE;
const C = PIG_COLORS;
// The pig, as it stands: how wide, tall (to its poll) and long.
export const PIG = new THREE.Vector3(PIG_BODY[0] * V, (PIG_NECK[1] + PIG_HEAD[1]) * V, (PIG_BODY[2] + 8) * V);

// What of it's told from the rest: its snout (the rows at the front of its head).
const snoutOf = (head: Cloud, big: number) => ((front) => (at: THREE.Vector3) => at.z > front - V * big * (PIG_SNOUT_ROWS - 0.5))(Math.max(...head.at.map((at) => at.z)));
const hindmost = (cloud: Cloud) => cloud.at.reduce((best, at) => (at.z < best.z ? at : best));
const foremost = (cloud: Cloud) => cloud.at.reduce((best, at) => (at.z > best.z ? at : best));

// What it is, in one of its coats, for what has parts to become it (becoming.ts).
export function pigBecomingOf(coat = 0): Becoming {
  const shape = pigShape(coat);
  const hue = hued(shape.palette);
  const SKIN = new THREE.Color(shape.palette[C.skin - 1]);
  const spotted = coat === PIG_SPOTTED;
  return quadrupedBecoming(shape, PIG, {
    // What grows on it: its snout, out from its face; its ears; its tail, from its hams back and round; its spots,
    // here and there.
    grows({ body, head }, big) {
      const snout = some(head, snoutOf(head, big));
      const tail = some(body, (_at, i) => hue(body, i, C.ear));
      return [
        { on: 'head', cloud: snout, root: hindmost(snout), line: 'A snout: pushed out, and flat at the end. Two nostrils.' },
        { on: 'head', cloud: some(head, (_at, i) => hue(head, i, C.ear)), line: 'Ears, flopped forward over the eyes.' },
        { on: 'body', cloud: tail, root: foremost(tail), line: 'A tail, behind: one curl.' },
        ...(spotted ? [{ on: 'body' as const, cloud: some(body, (_at, i) => hue(body, i, C.spot)), line: 'Spots, dark: here and there.' }] : []),
      ];
    },
    // (Without them: a blunt face, no ears; no tail; its skin all one colour.)
    plain(pig, big) {
      const snout = snoutOf(pig.head, big);
      pig.head = some(pig.head, (at, i) => !snout(at) && !hue(pig.head, i, C.ear));
      pig.body = some(pig.body, (_at, i) => !hue(pig.body, i, C.ear));
      pig.body.color = pig.body.color.map((color, i) => (hue(pig.body, i, C.spot) ? SKIN.clone() : color));
    },
  });
}

// Its staging, in one of its coats (PIG_PALETTES): the one it'll be seen in after.
export function pigStagingOf(coat = 0): Staging {
  const shape = pigShape(coat);
  const spotted = coat === PIG_SPOTTED;
  const becoming = pigBecomingOf(coat);

  const PERSON: Telling = {
    start: '{name} hears swill poured into a trough, and starts.',
    ...UNDRESSED,
    stance: 'They go down on all fours, unsteady: the back level, the hands on the ground.',
    legs: 'Arms and legs shorten, all four, to almost nothing. Hands and feet split into trotters.',
    arms: '',
    body: 'The back lengthens; the belly drops, near to the ground.',
    head: 'The neck goes; the head sets low into the shoulders, the face pushed forward.',
    done: 'A pig, where they stood.',
  };
  const BEAST: Telling = {
    ...PERSON,
    start: '{name} hears swill poured into a trough, somewhere.',
    stance: 'It squares itself up on its four legs.',
    legs: 'The legs shorten, all four. Trotters.',
    body: 'The body lengthens; the belly drops, near to the ground.',
    done: 'A pig, where it stood.',
  };

  const staging: Staging = {
    title: "Swineherd's call",
    becomes: 'A pig',
    lines: [
      [0, '{name} hears swill poured into a trough.'],
      [0.04, 'They go down on all fours.'],
      [0.27, 'The legs shorten, all four. Trotters.'],
      [0.45, 'A long, low barrel of a body. A head set low.'],
      [0.72, spotted ? 'A snout. Ears. A curl of tail. Spots.' : 'A snout. Ears. A curl of tail.'],
      [0.92, 'A pig, where they stood.'],
    ],
    looseLines: [
      [0, '{name} hears swill poured into a trough, somewhere.'],
      [0.08, 'It comes apart, from the ground up.'],
      [0.4, 'Every piece of it finds a new place.'],
      [0.72, 'Lower. Longer. Snouted.'],
    ],
    cloud: () => ((pig) => joined([pig.body, pig.head, ...pig.legs], V))(quadrupedClouds(shape, 1)),
    direct: turningInto(becoming, { person: PERSON, beast: BEAST }),
    target() {
      const pig = createPig(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), coat);
      return {
        root: pig.root,
        height: PIG.y,
        // Its snout lifted, sniffing, in little jerks; then down to the ground, shoved along it and from side to side.
        settle(j, time) {
          const [sniffing, down] = [bell(through(j, [0.06, 0.46])), j > 0.5 ? Math.min(1, (j - 0.5) / 0.2) : 0];
          pig.head.rotation.set(-(0.22 + 0.06 * Math.abs(Math.sin(time * 9))) * sniffing + (0.5 + Math.sin(time * 10) * 0.08) * down * down * (3 - 2 * down), Math.sin(time * 4.3) * 0.16 * down, 0);
        },
      };
    },
  };
  return staging;
}

export const pigStaging = pigStagingOf();
