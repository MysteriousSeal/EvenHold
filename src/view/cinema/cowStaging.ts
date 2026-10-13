// Someone turned into a cow (model/spells/chickens.ts), staged step by step as a horse is (turning.ts; becoming.ts):
// down on all fours; all four legs short, thick and hooved; a long deep barrel; a short neck and a broad head, its
// muzzle wide and pink; she white all over till then. Then what grows on her: her horns, out and up; her ears; her
// red patches, spreading over her head, then her shoulders, her rump, her flank; her udder (and her tail, behind).
// Anything with no such parts: taken apart whole into its voxels and put together again as her (voxelMorph.ts:
// `cloud`). The cow then, herself: her head lifted and stretched forward to low; then down to the grass.
import * as THREE from 'three';
import { createCow } from '../meshes/wildlife/cowRig';
import { COW_BODY, COW_BODY_PIVOT, COW_COLORS, COW_HEAD, COW_HEAD_PIVOT, COW_LEGS, COW_LEG_HEIGHT, COW_LEG_PIVOT, COW_NECK, COW_PALETTES, COW_VOXEL_SIZE, buildCowBody, buildCowHead, buildCowLeg } from '../meshes/wildlife/cowVoxels';
import { partPieces, type Becoming } from './becoming';
import { joined, some } from './clouds';
import type { Staging } from './staging';
import { turningInto, type Telling } from './turning';
import { cloudOf, type Cloud } from './voxelMorph';

const V = COW_VOXEL_SIZE;
const C = COW_COLORS;
// The cow, as she stands: how wide, tall (to her horns) and long.
export const COW = new THREE.Vector3(COW_BODY[0] * V, (COW_NECK[1] + COW_HEAD[1]) * V, (COW_BODY[2] + 8) * V);

// Her staging, in one of her coats (COW_PALETTES): the one she'll be seen in after.
export function cowStagingOf(coat = 0): Staging {
  const COW_PALETTE = COW_PALETTES[coat] ?? COW_PALETTES[0];
  const hue = (cloud: Cloud, i: number, ...roles: number[]) => roles.some((role) => cloud.color[i].getHex() === new THREE.Color(COW_PALETTE[role - 1]).getHex());
  // The cow's voxels, where createCow puts them (cowRig.ts), `big` times her size: her body (her tail and udder with
  // it), her head on its neck, her legs (hind left, hind right, fore left, fore right).
  function cowClouds(big: number): { body: Cloud; head: Cloud; legs: Cloud[] } {
    const at = (x: number, y: number, z: number) => new THREE.Vector3(x * V * big, y * V * big, z * V * big);
    return {
      body: cloudOf([{ grid: buildCowBody(), palette: COW_PALETTE, origin: at(-COW_BODY_PIVOT[0], COW_LEG_HEIGHT - COW_BODY_PIVOT[1], -COW_BODY_PIVOT[2]) }], V * big),
      head: cloudOf([{ grid: buildCowHead(), palette: COW_PALETTE, origin: at(COW_NECK[0] - COW_HEAD_PIVOT[0], COW_NECK[1] - COW_HEAD_PIVOT[1], COW_NECK[2] - COW_HEAD_PIVOT[2]) }], V * big),
      legs: COW_LEGS.map(([x, z], i) => cloudOf([{ grid: buildCowLeg(i < 2), palette: COW_PALETTE, origin: at(x - COW_LEG_PIVOT[0], COW_LEG_HEIGHT - COW_LEG_PIVOT[1], z - COW_LEG_PIVOT[2]) }], V * big)),
    };
  }
  // What of her's told from the rest: her tail (the rows behind her rump), her horns and ears (out past the sides of her head).
  const tailOf = (body: Cloud, big: number) => ((back) => (at: THREE.Vector3) => at.z < back + V * big * 1.5)(Math.min(...body.at.map((at) => at.z)));
  const outOf = (big: number) => (at: THREE.Vector3) => Math.abs(at.x) > V * big * 3;
  const middle = (cloud: Cloud) => new THREE.Box3().setFromPoints(cloud.at).getCenter(new THREE.Vector3());
  const WHITE = new THREE.Color(COW_PALETTE[C.white - 1]);

  const becoming: Becoming = {
    tall: COW.y,
    long: COW.z,
    fourLegged: true,
    // What grows on her: her horns; her ears; her patches, over her head and then her body, each spreading from its
    // middle; her udder, and her tail.
    grows(big) {
      const { body, head } = cowClouds(big);
      const [tail, out] = [tailOf(body, big), outOf(big)];
      const horns = some(head, (at, i) => out(at) && hue(head, i, C.horn));
      const face = some(head, (at, i) => !out(at) && hue(head, i, C.red, C.redDark));
      const hide = some(body, (at, i) => !tail(at) && hue(body, i, C.red, C.redDark));
      return [
        { on: 'head', cloud: horns, root: horns.at.reduce((best, at) => (at.y < best.y ? at : best)), line: 'Horns: out from the poll, and up.' },
        { on: 'head', cloud: some(head, (at, i) => out(at) && !hue(head, i, C.horn)), line: 'Ears, under them.' },
        { on: 'head', cloud: face, root: middle(face), line: 'Red, spreading over the white: the cheeks, the neck.' },
        { on: 'body', cloud: hide, root: middle(hide), line: 'The shoulders, the rump, a flank.' },
        { on: 'body', cloud: joined([some(body, (_at, i) => hue(body, i, C.pink)), some(body, (at) => tail(at))], V * big), line: 'An udder; a tail, behind.' },
      ];
    },
    parts(big, plain) {
      const cow = cowClouds(big);
      if (plain) {
        // (Without them: no horns, no ears; no udder, no tail; white all over.)
        const [tail, out] = [tailOf(cow.body, big), outOf(big)];
        const blank = (cloud: Cloud): Cloud => ({ ...cloud, color: cloud.color.map((color, i) => (hue(cloud, i, C.red, C.redDark) ? WHITE.clone() : color)) });
        cow.body = blank(some(cow.body, (at, i) => !tail(at) && !hue(cow.body, i, C.pink)));
        cow.head = blank(some(cow.head, (at) => !out(at)));
      }
      const at = (x: number, y: number, z: number) => new THREE.Vector3(x * V * big, y * V * big, z * V * big);
      const hip = (i: number) => at(COW_LEGS[i][0], COW_LEG_HEIGHT, COW_LEGS[i][1]);
      return {
        legs: [cow.legs[0], cow.legs[1]], // (her hind legs)
        arms: [cow.legs[2], cow.legs[3]], // (her forelegs)
        body: cow.body,
        head: cow.head,
        joints: { legs: [hip(0), hip(1)], arms: [hip(2), hip(3)], body: at(0, COW_LEG_HEIGHT, COW_LEGS[0][1]), head: at(COW_NECK[0], COW_NECK[1], COW_NECK[2]) },
      };
    },
    arms: () => [0, 0, 0], // (down on the ground already, once they've taken her stance)
  };

  const PERSON: Telling = {
    start: '{name} hears the herd called in, and starts.',
    bare: 'What they wear comes off them piece by piece, unravelling into threads.',
    look: '{name} looks down at their hands.',
    stance: 'They go down on all fours, unsteady: the back level, the hands on the ground.',
    legs: 'Arms and legs thicken and shorten, all four. Hands and feet split into hooves.',
    arms: '',
    body: 'The back lengthens; the belly drops, heavy; the hips stand square.',
    head: 'The neck shortens; the face broadens. A wide wet muzzle.',
    done: 'A cow, chewing, where they stood.',
  };
  const BEAST: Telling = {
    ...PERSON,
    start: '{name} hears a herd called in, somewhere.',
    stance: 'It squares itself up on its four legs.',
    legs: 'The legs thicken, all four. Hooves, cloven.',
    body: 'The body lengthens; the belly drops, heavy; the hips stand square.',
    done: 'A cow, chewing, where it stood.',
  };

  const staging: Staging = {
    title: "Dairymaid's call",
    becomes: 'A cow',
    lines: [
      [0, '{name} hears the herd called in.'],
      [0.04, 'They go down on all fours.'],
      [0.27, 'The legs thicken, all four. Hooves.'],
      [0.45, 'A long, deep barrel of a body. A broad head.'],
      [0.72, 'Horns. Red patches. An udder.'],
      [0.92, 'A cow, chewing, where they stood.'],
    ],
    looseLines: [
      [0, '{name} hears a herd called in, somewhere.'],
      [0.08, 'It comes apart, from the ground up.'],
      [0.4, 'Every piece of it finds a new place.'],
      [0.72, 'Heavier. Horned. Patched red and white.'],
    ],
    cloud() {
      const cow = cowClouds(1);
      return joined([cow.body, cow.head, ...cow.legs], V);
    },
    pieces: (actor) => partPieces(actor, becoming),
    direct: turningInto(becoming, { person: PERSON, beast: BEAST }),
    target() {
      const cow = createCow(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }), coat);
      return {
        root: cow.root,
        height: COW.y,
        // Her head lifted and stretched out, to low; then down to the grass, her jaw going.
        settle(j, time) {
          const within = (a: number, b: number) => (j > a && j < b ? Math.sin(((j - a) / (b - a)) * Math.PI) : 0);
          const down = j > 0.5 ? Math.min(1, (j - 0.5) / 0.25) : 0;
          cow.head.rotation.set(-0.35 * within(0.08, 0.42) + 0.9 * down * down * (3 - 2 * down) + (down >= 1 ? Math.sin(time * 7) * 0.04 : 0), 0, 0);
        },
      };
    },
  };
  return staging;
}

export const cowStaging = cowStagingOf();
