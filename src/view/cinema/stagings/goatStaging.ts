// Someone turned into a goat, staged step by step as a cow is (turning.ts; becoming.ts; cowStaging.ts): down on all
// fours; all four legs thin and straight, hooved; a lean body, its back level; a neck up and forward, a wedge of a
// face; its coat all one colour till then. Then what grows on it: its horns, up from its poll and swept back; its
// beard; its short tail; its patches, spreading over its neck, then its quarters and a shoulder, if its coat has them.
// Anything with no such parts: taken apart whole into its voxels and put together again as it (voxelMorph.ts:
// `cloud`). The goat then, itself: a toss of its horns; a stamp, twice; its beard shaken.
import * as THREE from 'three';
import { createGoat } from '../../meshes/turned/goatRig';
import { GOAT_BODY, GOAT_COLORS, GOAT_HEAD, GOAT_NECK, GOAT_PIEBALD, GOAT_VOXEL_SIZE, goatShape } from '../../meshes/turned/goatVoxels';
import { quadrupedBecoming, quadrupedClouds, type Becoming } from './becoming';
import { bell, through } from '../easing';
import { hued, joined, some } from '../morph/clouds';
import type { Staging } from '../staging';
import { UNDRESSED, turningInto, type Telling } from './turning';
import type { Cloud } from '../morph/voxelMorph';

const V = GOAT_VOXEL_SIZE;
const C = GOAT_COLORS;
// The goat, as it stands: how wide, tall (to its horns) and long.
export const GOAT = new THREE.Vector3(GOAT_BODY[0] * V, (GOAT_NECK[1] + GOAT_HEAD[1]) * V, (GOAT_BODY[2] + 8) * V);

// What of it's told from the rest: its tail (the row behind its rump).
const tailOf = (body: Cloud, big: number) => ((back) => (at: THREE.Vector3) => at.z < back + V * big * 0.5)(Math.min(...body.at.map((at) => at.z)));
const middle = (cloud: Cloud) => new THREE.Box3().setFromPoints(cloud.at).getCenter(new THREE.Vector3());

// What it is, in one of its coats, for what has parts to become it (becoming.ts).
export function goatBecomingOf(coat = 0): Becoming {
  const shape = goatShape(coat);
  const hue = hued(shape.palette);
  const [COAT, SHADE] = [new THREE.Color(shape.palette[C.coat - 1]), new THREE.Color(shape.palette[C.shade - 1])];
  const piebald = coat === GOAT_PIEBALD;
  return quadrupedBecoming(shape, GOAT, {
    // What grows on it: its horns, from its poll up and back; its beard, down from its chin; its tail, up from its
    // rump; its patches, over its neck and then its body, each spreading from its middle.
    grows({ body, head }, big) {
      const tail = tailOf(body, big);
      const horns = some(head, (_at, i) => hue(head, i, C.horn));
      const beard = some(head, (_at, i) => hue(head, i, C.beard));
      const stub = some(body, (at) => tail(at));
      const [neck, hide] = [some(head, (_at, i) => hue(head, i, C.patch, C.patchDark)), some(body, (at, i) => !tail(at) && hue(body, i, C.patch, C.patchDark))];
      return [
        { on: 'head', cloud: horns, root: horns.at.reduce((best, at) => (at.z > best.z ? at : best)), line: 'Horns: up from the poll, then swept back.' },
        { on: 'head', cloud: beard, root: beard.at.reduce((best, at) => (at.y > best.y ? at : best)), line: 'A beard, under the chin.' },
        { on: 'body', cloud: stub, root: stub.at.reduce((best, at) => (at.y < best.y ? at : best)), line: 'A short tail, held up.' },
        ...(piebald ? [{ on: 'head' as const, cloud: neck, root: middle(neck), line: 'Dark, spreading over the white: the neck.' }, { on: 'body' as const, cloud: hide, root: middle(hide), line: 'The quarters, a shoulder.' }] : []),
      ];
    },
    // (Without them: no horns, no beard; no tail; its coat all one colour.)
    plain(goat, big) {
      const tail = tailOf(goat.body, big);
      const blank = (cloud: Cloud): Cloud => ({ ...cloud, color: cloud.color.map((color, i) => (hue(cloud, i, C.patch) ? COAT.clone() : hue(cloud, i, C.patchDark) ? SHADE.clone() : color)) });
      goat.body = blank(some(goat.body, (at) => !tail(at)));
      goat.head = blank(some(goat.head, (_at, i) => !hue(goat.head, i, C.horn, C.beard)));
    },
  });
}

// Its staging, in one of its coats (GOAT_PALETTES): the one it'll be seen in after.
export function goatStagingOf(coat = 0): Staging {
  const shape = goatShape(coat);
  const piebald = coat === GOAT_PIEBALD;
  const becoming = goatBecomingOf(coat);

  const PERSON: Telling = {
    start: '{name} hears a goat-bell, close by, and starts.',
    ...UNDRESSED,
    stance: 'They go down on all fours, unsteady: the back level, the hands on the ground.',
    legs: 'Arms and legs thin and straighten, all four. Hands and feet split into hooves.',
    arms: '',
    body: 'The back straightens, level; the flanks draw in, lean.',
    head: 'The neck stretches up and forward; the face narrows to a wedge.',
    done: 'A goat, where they stood.',
  };
  const BEAST: Telling = {
    ...PERSON,
    start: '{name} hears a goat-bell, somewhere.',
    stance: 'It squares itself up on its four legs.',
    legs: 'The legs thin and straighten, all four. Hooves, cloven.',
    body: 'The body narrows, its back level; the flanks draw in, lean.',
    done: 'A goat, where it stood.',
  };

  const staging: Staging = {
    title: "Goatherd's bell",
    becomes: 'A goat',
    lines: [
      [0, '{name} hears a goat-bell, close by.'],
      [0.04, 'They go down on all fours.'],
      [0.27, 'The legs thin and straighten, all four. Hooves.'],
      [0.45, 'A lean body, its back level. A wedge of a face.'],
      [0.72, piebald ? 'Horns. A beard. Patches.' : 'Horns. A beard. A short tail.'],
      [0.92, 'A goat, where they stood.'],
    ],
    looseLines: [
      [0, '{name} hears a goat-bell, somewhere.'],
      [0.08, 'It comes apart, from the ground up.'],
      [0.4, 'Every piece of it finds a new place.'],
      [0.72, 'Leaner. Horned. Bearded.'],
    ],
    cloud: () => ((goat) => joined([goat.body, goat.head, ...goat.legs], V))(quadrupedClouds(shape, 1)),
    direct: turningInto(becoming, { person: PERSON, beast: BEAST }),
    target() {
      const goat = createGoat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), coat);
      return {
        root: goat.root,
        height: GOAT.y,
        // A toss of its horns, up and back; a foreleg stamped, twice; its beard shaken.
        settle(j, time) {
          goat.head.rotation.set(-0.55 * bell(through(j, [0.06, 0.34])), Math.sin(time * 30) * 0.2 * bell(through(j, [0.68, 0.94])), 0);
          goat.legs[3].rotation.x = j > 0.38 && j < 0.64 ? -0.5 * Math.abs(Math.sin(((j - 0.38) / 0.26) * Math.PI * 2)) : 0;
        },
      };
    },
  };
  return staging;
}

export const goatStaging = goatStagingOf();
