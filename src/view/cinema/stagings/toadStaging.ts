// Someone turned into a toad (model/spells/turned.ts), staged step by step as a cow is (turning.ts; becoming.ts):
// down on all fours; their arms short, their legs folded up long along their sides; a squat body, its back sloping
// down behind; a broad flat head set straight on it, the mouth right across it; its skin smooth till then, and its
// eyes on its face still, where theirs were. Then what comes on it: the first of its warts, on its head; its eyes,
// risen to the top of it; its throat, swelling out pale under its jaw; the rest of its warts, all down its back. A
// toad as long as they were tall, and then down to its own size (a hen's way: chickenStaging.ts).
// Anything with no such parts: taken apart whole into its voxels and put together again as it (voxelMorph.ts:
// `cloud`). The toad then, itself: its throat out and in, three times; one hop, where it sits.
import * as THREE from 'three';
import { createToad, hopping, swollen } from '../../meshes/turned/toadRig';
import { TOAD_COLORS, TOAD_FACE_EYES, TOAD_VOXEL_SIZE, toadShape } from '../../meshes/turned/toadVoxels';
import { quadrupedParts } from '../../meshes/turned/quadruped';
import { quadrupedBecoming, type Becoming } from './becoming';
import { through } from '../easing';
import { hued, most, some } from '../morph/clouds';
import type { Staging } from '../staging';
import { ON_ALL_FOURS, fourLeggedStaging } from './fourLegged';
import { type Telling } from './turning';
import type { Cloud } from '../morph/voxelMorph';

const V = TOAD_VOXEL_SIZE;
const C = TOAD_COLORS;
// The toad, as it sits: how wide (across its haunches), tall (to its eyes) and long.
export const TOAD = new THREE.Vector3(8 * V, 6 * V, 10 * V);
// How tall it's taken to stand for its turning (becoming.ts: it's built as many times its size as they are that):
// as tall as it's long, so that it's built as long as they were tall, and its broad head's seen whole, close to.
const TAKEN = TOAD.z;

// What of its head's told from the rest: its eyes (the row on top of it), its throat (the row under it).
const rowsOf = (head: Cloud, big: number) => ((ys) => ({ eyes: (at: THREE.Vector3) => at.y > Math.max(...ys) - V * big, throat: (at: THREE.Vector3) => at.y < Math.min(...ys) + V * big }))(head.at.map((at) => at.y));

// What a toad is, for what has parts to become it, in one of its coats: what grows on it once it's whole, and
// itself plain of that till then.
export function toadBecomingOf(coat = 0): Becoming {
  const shape = toadShape(coat);
  const hue = hued(shape.palette);
  const [SKIN, PUPIL] = [new THREE.Color(shape.palette[C.skin - 1]), new THREE.Color(shape.palette[C.pupil - 1])];
  // Where its eyes are before they rise (the voxels of its face they're on: toadVoxels.ts), `big` times its size.
  const face = (big: number) => ((from) => TOAD_FACE_EYES.map(([x, y, z]) => new THREE.Vector3(from[0] + x + 0.5, from[1] + y + 0.5, from[2] + z + 0.5).multiplyScalar(V * big)))(quadrupedParts(shape).head.at);
  const onFace = (big: number) => ((eyes) => (at: THREE.Vector3) => eyes.some((eye) => eye.distanceTo(at) < V * big * 0.5))(face(big));
  return quadrupedBecoming(shape, new THREE.Vector3(TOAD.x, TAKEN, TOAD.z), {
    // What comes on it: its warts, here and there on its head; its eyes, closed over on its face and risen out of
    // the top of its head; its throat, out from under its jaw; and the rest of its warts, over its back.
    grows({ body, head }, big) {
      const [rows, first] = [rowsOf(head, big), onFace(big)];
      const eyes = some(head, (at) => rows.eyes(at) || first(at));
      const throat = some(head, (at) => rows.throat(at));
      return [
        { on: 'head', cloud: some(head, (_at, i) => hue(head, i, C.wart)), line: 'Warts: one, then another.' },
        { on: 'head', cloud: eyes, root: face(big)[0].clone().lerp(face(big)[1], 0.5), line: 'The eyes go up the face, and stop on top of the head.' },
        { on: 'head', cloud: throat, root: most(throat, 'z', -1), line: 'The throat swells out, pale, under the jaw.' },
        { on: 'body', cloud: some(body, (_at, i) => hue(body, i, C.wart, C.bump)), line: 'More warts, all down the back.' }, // (last: its head's seen close till what's on that has come)
      ];
    },
    // (Without them: its skin smooth, no bump stood on its back; its eyes on its face, none on top; no throat.)
    plain(toad, big) {
      const [rows, first] = [rowsOf(toad.head, big), onFace(big)];
      const smooth = (cloud: Cloud): Cloud => ({ ...cloud, color: cloud.color.map((color, i) => (hue(cloud, i, C.wart) ? SKIN.clone() : color)) });
      toad.body = smooth(some(toad.body, (_at, i) => !hue(toad.body, i, C.bump)));
      toad.head = smooth(some(toad.head, (at) => !rows.eyes(at) && !rows.throat(at)));
      toad.head.color = toad.head.color.map((color, i) => (first(toad.head.at[i]) ? PUPIL.clone() : color));
    },
  });
}

// Its staging, in one of its coats (TOAD_PALETTES): the one it'll be seen in after.
export function toadStagingOf(coat = 0): Staging {
  const shape = toadShape(coat);
  const becoming = toadBecomingOf(coat);

  const PERSON: Telling = {
    start: '{name} feels the damp come up out of the ground, and starts.',
    ...ON_ALL_FOURS,
    legs: 'The arms shorten. The legs fold up, long, along the sides. Fingers and toes spread.',
    body: 'The body squats down, broad and low; no waist; no neck to speak of.',
    head: 'The head flattens. The mouth goes from one side of it to the other.',
    done: 'A toad as big as they were. And then smaller. Much smaller.',
  };
  const BEAST: Telling = {
    ...PERSON,
    start: '{name} feels the damp come up out of the ground.',
    stance: 'It squats down on its four legs.',
    legs: 'The forelegs shorten. The hind legs fold up, long, along its sides.',
    done: 'A toad as big as it was. And then smaller. Much smaller.',
  };

  return fourLeggedStaging({
    title: "Fen-wife's kiss",
    becomes: 'A toad',
    lines: [
      [0, '{name} feels the damp come up out of the ground.'],
      [0.04, 'They go down on all fours.'],
      [0.27, 'The arms shorten. The legs fold up along the sides.'],
      [0.45, 'A squat body. A broad flat head, all mouth.'],
      [0.72, 'Warts. The eyes, up on top. A pale throat.'],
      [0.92, 'A toad as big as a man. And then smaller. Much smaller.'],
    ],
    heard: '{name} feels the damp come up out of the ground.',
    loosely: 'Smaller. Squatter. Warted.',
    shape,
    becoming,
    person: PERSON,
    beast: BEAST,
    make: (material) => createToad(material, coat),
    height: TOAD.y,
    // Its throat out and in, three times; then one hop, where it sits; its throat again.
    settle(toad, j, time) {
      const hop = through(j, [0.5, 0.72]);
      hopping(toad, hop >= 1 ? 0 : hop, TOAD.y * 0.9);
      swollen(toad, j < 0.45 ? Math.abs(Math.sin(through(j, [0.04, 0.45]) * Math.PI * 3)) : j > 0.78 ? Math.max(0, Math.sin(time * 5.5)) * 0.7 : 0);
    },
  });
}

export const toadStaging = toadStagingOf();
