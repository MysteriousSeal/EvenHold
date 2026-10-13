// Someone turned into a cow (model/spells/turned.ts), staged step by step as a horse is (turning.ts; becoming.ts):
// down on all fours; all four legs short, thick and hooved; a long deep barrel; a short neck and a broad head, its
// muzzle wide and pink; she her coat's ground all over till then. Then what grows on her: her horns, out and up; her
// ears; her patches, spreading over her head, then her shoulders, her rump, her flank; her udder (and her tail,
// behind). Anything with no such parts: taken apart whole into its voxels and put together again as her
// (voxelMorph.ts: `cloud`). What has no voxels to take apart either (a ghost, seen through): it only dwindles, and
// that's what's said of it (`lines`). The cow then, herself: her head lifted and stretched forward to low; then down
// to the grass.
import * as THREE from 'three';
import { createCow } from '../../meshes/turned/cowRig';
import { COW_BODY, COW_COLORS, COW_HEAD, COW_NECK, COW_VOXEL_SIZE, cowShape } from '../../meshes/turned/cowVoxels';
import { quadrupedBecoming, quadrupedClouds } from './becoming';
import { bell, through } from '../easing';
import { hued, joined, some } from '../morph/clouds';
import type { Staging } from '../staging';
import { UNDRESSED, turningInto, type Telling } from './turning';
import type { Cloud } from '../morph/voxelMorph';

const V = COW_VOXEL_SIZE;
const C = COW_COLORS;
// The cow, as she stands: how wide, tall (to her horns) and long.
export const COW = new THREE.Vector3(COW_BODY[0] * V, (COW_NECK[1] + COW_HEAD[1]) * V, (COW_BODY[2] + 8) * V);

// What of her's told from the rest: her tail (the rows behind her rump), her horns and ears (out past the sides of her head).
const tailOf = (body: Cloud, big: number) => ((back) => (at: THREE.Vector3) => at.z < back + V * big * 1.5)(Math.min(...body.at.map((at) => at.z)));
const outOf = (big: number) => (at: THREE.Vector3) => Math.abs(at.x) > V * big * 3;
const middle = (cloud: Cloud) => new THREE.Box3().setFromPoints(cloud.at).getCenter(new THREE.Vector3());
// What's said of each coat (COW_PALETTES, in their order): her patches spreading over her, and her whole.
const COATS: ReadonlyArray<{ spreads: string; whole: string }> = [
  { spreads: 'Red, spreading over the white', whole: 'Patched red and white.' },
  { spreads: 'Black, spreading over the white', whole: 'Patched black and white.' },
  { spreads: 'A darker brown, spreading over the dun', whole: 'Dun, patched brown.' },
  { spreads: 'A deeper black, spreading over the black', whole: 'Black all over.' },
];

// Her staging, in one of her coats (COW_PALETTES): the one she'll be seen in after.
// `bull`: a bull's (a man turned): his hump and thick neck, his longer horns, no udder; the ground pawed after.
export function cowStagingOf(coat = 0, bull = false): Staging {
  const shape = cowShape(coat, bull);
  const hue = hued(shape.palette);
  const WHITE = new THREE.Color(shape.palette[C.white - 1]);
  const told = COATS[coat] ?? COATS[0];
  const becoming = quadrupedBecoming(shape, COW, {
    // What grows on her: her horns; her ears; her patches, over her head and then her body, each spreading from its
    // middle; her udder, and her tail.
    grows({ body, head }, big) {
      const [tail, out] = [tailOf(body, big), outOf(big)];
      const horns = some(head, (at, i) => out(at) && hue(head, i, C.horn));
      const face = some(head, (at, i) => !out(at) && hue(head, i, C.red, C.redDark));
      const hide = some(body, (at, i) => !tail(at) && hue(body, i, C.red, C.redDark));
      return [
        { on: 'head', cloud: horns, root: horns.at.reduce((best, at) => (at.y < best.y ? at : best)), line: bull ? 'Horns: out from the poll, long, swept forward.' : 'Horns: out from the poll, and up.' },
        { on: 'head', cloud: some(head, (at, i) => out(at) && !hue(head, i, C.horn)), line: 'Ears, under them.' },
        { on: 'head', cloud: face, root: middle(face), line: `${told.spreads}: the cheeks, the neck.` },
        { on: 'body', cloud: hide, root: middle(hide), line: 'The shoulders, the rump, a flank.' },
        { on: 'body', cloud: joined([some(body, (_at, i) => hue(body, i, C.pink)), some(body, (at) => tail(at))], V * big), line: bull ? 'What makes a bull of him, between the hind legs; a tail, behind.' : 'An udder; a tail, behind.' },
      ];
    },
    // (Without them: no horns, no ears; no udder, no tail; white all over.)
    plain(cow, big) {
      const [tail, out] = [tailOf(cow.body, big), outOf(big)];
      const blank = (cloud: Cloud): Cloud => ({ ...cloud, color: cloud.color.map((color, i) => (hue(cloud, i, C.red, C.redDark) ? WHITE.clone() : color)) });
      cow.body = blank(some(cow.body, (at, i) => !tail(at) && !hue(cow.body, i, C.pink)));
      cow.head = blank(some(cow.head, (at) => !out(at)));
    },
  });

  const PERSON: Telling = {
    start: '{name} hears the herd called in, and starts.',
    ...UNDRESSED,
    stance: 'They go down on all fours, unsteady: the back level, the hands on the ground.',
    legs: 'Arms and legs thicken and shorten, all four. Hands and feet split into hooves.',
    arms: '',
    body: bull ? 'The back lengthens; the chest deepens; a hump of muscle rises over the shoulders.' : 'The back lengthens; the belly drops, heavy; the hips stand square.',
    head: bull ? 'The neck thickens, crested; the face broadens. A wide wet muzzle.' : 'The neck shortens; the face broadens. A wide wet muzzle.',
    done: bull ? 'A bull, where they stood.' : 'A cow, chewing, where they stood.',
  };
  const BEAST: Telling = {
    ...PERSON,
    start: '{name} hears a herd called in, somewhere.',
    stance: 'It squares itself up on its four legs.',
    legs: 'The legs thicken, all four. Hooves, cloven.',
    body: bull ? 'The body lengthens; the chest deepens; a hump of muscle rises over the shoulders.' : 'The body lengthens; the belly drops, heavy; the hips stand square.',
    done: bull ? 'A bull, where it stood.' : 'A cow, chewing, where it stood.',
  };

  const staging: Staging = {
    title: "Herdsman's call",
    becomes: bull ? 'A bull' : 'A cow',
    // (Of what only dwindles: nothing of it to go down on all fours, none of her seen till she's there.)
    lines: [
      [0, '{name} hears a herd called in, somewhere.'],
      [0.12, 'It thins, and draws in on itself.'],
      [0.5, 'Smaller. Fainter.'],
      [0.85, 'Almost nothing left of it.'],
    ],
    looseLines: [
      [0, '{name} hears a herd called in, somewhere.'],
      [0.08, 'It comes apart, from the ground up.'],
      [0.4, 'Every piece of it finds a new place.'],
      [0.72, `Heavier. Horned. ${told.whole}`],
    ],
    cloud: () => ((cow) => joined([cow.body, cow.head, ...cow.legs], V))(quadrupedClouds(shape, 1)),
    direct: turningInto(becoming, { person: PERSON, beast: BEAST }),
    target() {
      const cow = createCow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), coat, bull);
      return {
        root: cow.root,
        height: COW.y,
        // Her head lifted and stretched out, to low; then down to the grass, her jaw going.
        settle(j, time) {
          const down = j > 0.5 ? Math.min(1, (j - 0.5) / 0.25) : 0;
          if (bull) {
            // (A bull: his head lowered, the ground pawed; then a toss of his horns.)
            cow.legs[3].rotation.x = j > 0.2 && j < 0.6 ? -0.55 * Math.abs(Math.sin(((j - 0.2) / 0.4) * Math.PI * 3)) : 0;
            cow.head.rotation.set(0.35 * bell(through(j, [0.12, 0.62])) - 0.5 * bell(through(j, [0.66, 0.92])), 0, 0);
            return;
          }
          cow.head.rotation.set(-0.35 * bell(through(j, [0.08, 0.42])) + 0.9 * down * down * (3 - 2 * down) + (down >= 1 ? Math.sin(time * 7) * 0.04 : 0), 0, 0);
        },
      };
    },
  };
  return staging;
}

export const cowStaging = cowStagingOf();
export const bullStaging = cowStagingOf(0, true);
