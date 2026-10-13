// Someone turned into a sheep, staged step by step as a cow is (turning.ts; becoming.ts; cowStaging.ts): down on
// all fours; all four legs thinned to sticks, hooved; a rounded body and a small narrow face on a short neck, the
// whole of it shorn till then: bare, pink (sheepVoxels.ts: itself, under its fleece). Then what grows on it: its
// ears, out to the sides; its wool, as a hen's feathers come (chickenStaging.ts): here and there first, on its poll
// and its throat, then everywhere, till it's twice as wide as it was.
// Anything with no such parts: taken apart whole into its voxels and put together again as it (voxelMorph.ts:
// `cloud`). The sheep then, itself: its fleece shaken out; its head lifted to bleat; then chewing.
import * as THREE from 'three';
import { createSheep } from '../../meshes/turned/sheepRig';
import { SHEEP_BODY, SHEEP_COLORS, SHEEP_HEAD, SHEEP_NECK, SHEEP_VOXEL_SIZE, sheepShape } from '../../meshes/turned/sheepVoxels';
import { quadrupedBecoming, quadrupedClouds, type Becoming } from './becoming';
import { bell, through } from '../easing';
import { hued, joined, some } from '../morph/clouds';
import type { Staging } from '../staging';
import { UNDRESSED, turningInto, type Telling } from './turning';

const V = SHEEP_VOXEL_SIZE;
const C = SHEEP_COLORS;
const BLACK_FACED = 1; // the coat with a black face and legs
// The sheep, as it stands: how wide, tall (to the tuft on its poll) and long.
export const SHEEP = new THREE.Vector3(SHEEP_BODY[0] * V, (SHEEP_NECK[1] + SHEEP_HEAD[1]) * V, (SHEEP_BODY[2] + 5) * V);

// What it is, in one of its coats, for what has parts to become it (becoming.ts).
export function sheepBecomingOf(coat = 0): Becoming {
  const shape = sheepShape(coat);
  const hue = hued(shape.palette);
  return quadrupedBecoming(shape, SHEEP, {
    // What grows on it: its ears; its wool, in no order (growth.ts: here and there, then filled in), over its head
    // and neck, then over its body (its tail's with it).
    grows({ body, head }) {
      return [
        { on: 'head', cloud: some(head, (_at, i) => hue(head, i, C.ear)), line: 'Ears, out to the sides.' },
        { on: 'head', cloud: some(head, (_at, i) => hue(head, i, C.wool, C.shade, C.light)), line: 'Wool: a tuft at the poll, a tuft at the throat.' },
        { on: 'body', cloud: some(body, (_at, i) => hue(body, i, C.wool, C.shade, C.light)), line: 'Then everywhere, thick, down to the knees.' },
      ];
    },
    // (Without them: no ears; shorn, itself only.)
    plain(sheep) {
      sheep.head = some(sheep.head, (_at, i) => !hue(sheep.head, i, C.ear, C.wool, C.shade, C.light));
      sheep.body = some(sheep.body, (_at, i) => hue(sheep.body, i, C.skin));
    },
  });
}

// Its staging, in one of its coats (SHEEP_PALETTES): the one it'll be seen in after.
export function sheepStagingOf(coat = 0): Staging {
  const shape = sheepShape(coat);
  const black = coat === BLACK_FACED;
  const becoming = sheepBecomingOf(coat);

  const PERSON: Telling = {
    start: '{name} hears a shepherd whistle, and starts.',
    ...UNDRESSED,
    stance: 'They go down on all fours, unsteady: the back level, the hands on the ground.',
    legs: black ? 'Arms and legs thin, all four, to black sticks. Hands and feet split into hooves.' : 'Arms and legs thin, all four, to sticks. Hands and feet split into hooves.',
    arms: '',
    body: 'The back lengthens; the body rounds out: bare, pink, shorn.',
    head: black ? 'The neck shortens; the face narrows, small, and goes black.' : 'The neck shortens; the face narrows, small.',
    done: 'A sheep, where they stood.',
  };
  const BEAST: Telling = {
    ...PERSON,
    start: '{name} hears a shepherd whistle, somewhere.',
    stance: 'It squares itself up on its four legs.',
    legs: black ? 'The legs thin, all four, to black sticks. Hooves, cloven.' : 'The legs thin, all four, to sticks. Hooves, cloven.',
    body: 'The body shortens and rounds out: bare, pink, shorn.',
    done: 'A sheep, where it stood.',
  };

  const staging: Staging = {
    title: "Shepherd's whistle",
    becomes: 'A sheep',
    lines: [
      [0, '{name} hears a shepherd whistle.'],
      [0.04, 'They go down on all fours.'],
      [0.27, 'The legs thin, all four. Hooves.'],
      [0.45, 'A round body, bare. A small, narrow face.'],
      [0.72, 'Ears. Wool: here and there, then everywhere.'],
      [0.92, 'A sheep, where they stood.'],
    ],
    looseLines: [
      [0, '{name} hears a shepherd whistle, somewhere.'],
      [0.08, 'It comes apart, from the ground up.'],
      [0.4, 'Every piece of it finds a new place.'],
      [0.72, 'Rounder. Woollier. Thin in the leg.'],
    ],
    cloud: () => ((sheep) => joined([sheep.body, sheep.head, ...sheep.legs], V))(quadrupedClouds(shape, 1)),
    direct: turningInto(becoming, { person: PERSON, beast: BEAST }),
    target() {
      const sheep = createSheep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), coat);
      return {
        root: sheep.root,
        height: SHEEP.y,
        // Its fleece shaken out, its head with it; its head lifted and stretched forward to bleat; then chewing.
        settle(j, time) {
          const [shaking, bleating, chewing] = [bell(through(j, [0.05, 0.3])), bell(through(j, [0.36, 0.66])), j > 0.7 ? 1 : 0];
          sheep.body.rotation.z = Math.sin(time * 28) * 0.07 * shaking;
          sheep.head.rotation.set(-0.4 * bleating + Math.sin(time * 8) * 0.04 * chewing, Math.sin(time * 28 + 1) * 0.2 * shaking, Math.cos(time * 8) * 0.07 * chewing);
        },
      };
    },
  };
  return staging;
}

export const sheepStaging = sheepStagingOf();
