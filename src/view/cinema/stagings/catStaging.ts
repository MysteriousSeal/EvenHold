// Someone turned into a cat (model/spells/turned.ts), staged step by step as a cow is (turning.ts; becoming.ts):
// down on all fours; all four legs slim and straight, on paws; a long narrow body; a round head, a pale muzzle and
// a pink nose; its coat one colour all over till then. Then what grows on it: its ears, up from the corners of its
// head; its whiskers, either side of its muzzle; its tail, up from its rump; and its coat's markings, over its head and then its
// body (a tabby's or a ginger's stripes; a black cat's white bib; a white one's grey smudges). A cat as tall as
// they were, and then down to its own size (a hen's way: chickenStaging.ts).
// Anything with no such parts: taken apart whole into its voxels and put together again as it (voxelMorph.ts:
// `cloud`). The cat then, itself: sat down where it stands, its tail brought round; and a forepaw washed.
import * as THREE from 'three';
import { createTurnedCat, seated } from '../../meshes/turned/turnedCatRig';
import { CAT_TAIL, TURNED_CAT_COLORS, TURNED_CAT_VOXEL_SIZE, turnedCatShape } from '../../meshes/turned/turnedCatVoxels';
import { quadrupedBecoming, quadrupedClouds, type Becoming } from './becoming';
import { smooth, through } from '../easing';
import { hued, joined, some } from '../morph/clouds';
import type { Staging } from '../staging';
import { UNDRESSED, turningInto, type Telling } from './turning';
import type { Cloud } from '../morph/voxelMorph';

const V = TURNED_CAT_VOXEL_SIZE;
const C = TURNED_CAT_COLORS;
// The cat, as it stands: how wide (across its head), tall (to its ears) and long (its nose to its tail).
export const TURNED_CAT = new THREE.Vector3(5 * V, 10 * V, 14 * V);
// What's said of each coat's markings as they come (turnedCatVoxels.ts: tabby, black, ginger, white).
const MARKINGS = ['Stripes, dark, over the back and down the flanks.', 'A white bib. A white chin.', 'Stripes, darker, over the back and down the flanks.', 'A smudge of grey between the ears; another on the back.'];

// What of it's told from the rest: its tail (the rows behind its rump), its ears (the row on top of its head).
const tailOf = (body: Cloud, big: number) => ((back) => (at: THREE.Vector3) => at.z < back + V * big * (CAT_TAIL - 0.5))(Math.min(...body.at.map((at) => at.z)));
const earsOf = (head: Cloud, big: number) => ((top) => (at: THREE.Vector3) => at.y > top - V * big)(Math.max(...head.at.map((at) => at.y)));
const middle = (cloud: Cloud) => new THREE.Box3().setFromPoints(cloud.at).getCenter(new THREE.Vector3());
const lowest = (cloud: Cloud) => cloud.at.reduce((best, at) => (at.y < best.y ? at : best));

// What a cat is, for what has parts to become it, in one of its coats: what grows on it once it's whole, and
// itself plain of that till then.
export function catBecomingOf(coat = 0): Becoming {
  const shape = turnedCatShape(coat);
  const hue = hued(shape.palette);
  const COAT = new THREE.Color(shape.palette[C.coat - 1]);
  const marks = MARKINGS[coat] ?? MARKINGS[0];
  return quadrupedBecoming(shape, TURNED_CAT, {
    // What grows on it: its ears; its whiskers; its tail, from its rump up; its markings, over its head and then its
    // body, each spreading from its middle.
    grows({ body, head }, big) {
      const [tail, ears] = [tailOf(body, big), earsOf(head, big)];
      const [pricked, whiskers, raised] = [some(head, (at) => ears(at)), some(head, (_at, i) => hue(head, i, C.whisker)), some(body, (at) => tail(at))];
      const [brow, hide] = [some(head, (at, i) => !ears(at) && hue(head, i, C.mark)), some(body, (at, i) => !tail(at) && hue(body, i, C.mark))];
      return [
        { on: 'head', cloud: pricked, root: lowest(pricked), line: 'Ears: one at each corner, pointed.' },
        { on: 'head', cloud: whiskers, root: middle(whiskers), line: 'Whiskers.' },
        { on: 'body', cloud: raised, root: lowest(raised), line: 'A tail, straight up, and pleased with itself.' },
        { on: 'head', cloud: brow, root: middle(brow), line: marks },
        { on: 'body', cloud: hide, root: middle(hide), line: marks },
      ];
    },
    // (Without them: no ears, no whiskers, no tail; its coat's one colour all over.)
    plain(cat, big) {
      const [tail, ears] = [tailOf(cat.body, big), earsOf(cat.head, big)];
      const blank = (cloud: Cloud): Cloud => ({ ...cloud, color: cloud.color.map((color, i) => (hue(cloud, i, C.mark) ? COAT.clone() : color)) });
      cat.body = blank(some(cat.body, (at) => !tail(at)));
      cat.head = blank(some(cat.head, (at, i) => !ears(at) && !hue(cat.head, i, C.whisker)));
    },
  });
}

// Its staging, in one of its coats (TURNED_CAT_PALETTES): the one it'll be seen in after.
export function catStagingOf(coat = 0): Staging {
  const shape = turnedCatShape(coat);
  const becoming = catBecomingOf(coat);

  const PERSON: Telling = {
    start: '{name} hears something small move in the wall, and starts.',
    ...UNDRESSED,
    stance: 'They go down on all fours, unsteady: the back level, the hands on the ground.',
    legs: 'Arms and legs slim down, all four. Hands and feet close into paws.',
    arms: '',
    body: 'The back lengthens: narrow, loose, supple.',
    head: 'The face shortens and rounds. A small pink nose.',
    done: 'A cat as tall as they were. And then smaller.',
  };
  const BEAST: Telling = {
    ...PERSON,
    start: '{name} hears something small move, somewhere.',
    stance: 'It gathers itself on its four legs.',
    legs: 'The legs slim down, all four. Paws.',
    body: 'The body draws out: narrow, loose, supple.',
    done: 'A cat as big as it was. And then smaller.',
  };

  const staging: Staging = {
    title: "Miller's mouser",
    becomes: 'A cat',
    lines: [
      [0, '{name} hears something small move in the wall.'],
      [0.04, 'They go down on all fours.'],
      [0.27, 'Arms and legs slim down, all four. Paws.'],
      [0.45, 'A long narrow back. A round face, a pink nose.'],
      [0.72, 'Ears. Whiskers. A tail.'],
      [0.92, 'A cat as tall as a man. And then smaller.'],
    ],
    looseLines: [
      [0, '{name} hears something small move, somewhere.'],
      [0.08, 'It comes apart, from the ground up.'],
      [0.4, 'Every piece of it finds a new place.'],
      [0.72, 'Smaller. Sleeker. Whiskered.'],
    ],
    cloud: () => ((cat) => joined([cat.body, cat.head, ...cat.legs], V))(quadrupedClouds(shape, 1)),
    direct: turningInto(becoming, { person: PERSON, beast: BEAST }),
    target() {
      const cat = createTurnedCat(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), coat);
      return {
        root: cat.root,
        height: TURNED_CAT.y,
        // A look about it; sat down, its tail brought round; a forepaw lifted and washed.
        settle(j, time) {
          seated(cat, smooth(through(j, [0.12, 0.34])), smooth(through(j, [0.45, 0.58])), time);
          cat.head.rotation.y = 0.5 * Math.sin(through(j, [0, 0.14]) * Math.PI * 2);
        },
      };
    },
  };
  return staging;
}

export const catStaging = catStagingOf();
