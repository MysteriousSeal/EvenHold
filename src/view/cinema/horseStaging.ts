// Someone turned into a horse (model/spells/chickens.ts), staged part by part (staging.ts; becoming.ts), each part of
// them morphing into the part of it it becomes, a horse built as big as they are:
//  1. a start, themselves;
//  2. the legs into its hind legs: long, straight, black below the knee, hooved;
//  3. the arms (a beast's forelegs) reaching forward and down to the ground: its forelegs;
//  4. the torso (a beast's trunk and tail) bent forward at the waist till it lies level: its barrel, a tail behind;
//  5. the head into its head, on a neck arched up and forward: a mane, a white blaze, ears;
//  6. and to its own size, to give way.
// Anything with no such parts (a spider, a bat, a worm): taken apart whole into its voxels and put together again as
// it (voxelMorph.ts: `cloud`). The horse then, itself: a toss of its head, a stamp.
import * as THREE from 'three';
import { createHorse } from '../meshes/wildlife/horseRig';
import { HORSE_BODY, HORSE_HEAD, HORSE_LEGS, HORSE_LEG_HEIGHT, HORSE_NECK, HORSE_PALETTE, HORSE_VOXEL_SIZE, buildHorseBody, buildHorseHead, buildHorseLeg } from '../meshes/wildlife/horseVoxels';
import { partPieces, type Becoming } from './becoming';
import type { Staging } from './staging';
import { cloudOf, type Cloud } from './voxelMorph';

const V = HORSE_VOXEL_SIZE;
// The horse, as it stands: how wide, tall (to its ears) and long.
export const HORSE = new THREE.Vector3(HORSE_BODY[0] * V, (HORSE_NECK[1] + HORSE_HEAD[1]) * V, (HORSE_BODY[2] + 8) * V);

// The horse's voxels, where createHorse puts them (horseRig.ts), `big` times its size: its body (its tail with it),
// its head on its neck, its legs (hind left, hind right, fore left, fore right).
function horseClouds(big: number): { body: Cloud; head: Cloud; legs: Cloud[] } {
  const at = (x: number, y: number, z: number) => new THREE.Vector3(x * V * big, y * V * big, z * V * big);
  const [bx, , bz] = HORSE_BODY;
  return {
    body: cloudOf([{ grid: buildHorseBody(), palette: HORSE_PALETTE, origin: at(-bx / 2, HORSE_LEG_HEIGHT - 1, -(bz / 2 + 0.5)) }], V * big),
    head: cloudOf([{ grid: buildHorseHead(), palette: HORSE_PALETTE, origin: at(HORSE_NECK[0] - HORSE_HEAD[0] / 2, HORSE_NECK[1], HORSE_NECK[2] - 2) }], V * big),
    legs: HORSE_LEGS.map(([x, z]) => cloudOf([{ grid: buildHorseLeg(), palette: HORSE_PALETTE, origin: at(x - 1, HORSE_LEG_HEIGHT - 9, z - 1) }], V * big)),
  };
}

const becoming: Becoming = {
  tall: HORSE.y,
  parts(big) {
    const horse = horseClouds(big);
    const at = (x: number, y: number, z: number) => new THREE.Vector3(x * V * big, y * V * big, z * V * big);
    const hip = (i: number) => at(HORSE_LEGS[i][0], HORSE_LEG_HEIGHT, HORSE_LEGS[i][1]);
    return {
      legs: [horse.legs[0], horse.legs[1]], // (its hind legs)
      arms: [horse.legs[2], horse.legs[3]], // (its forelegs)
      body: horse.body,
      head: horse.head,
      joints: { legs: [hip(0), hip(1)], arms: [hip(2), hip(3)], body: at(0, HORSE_LEG_HEIGHT, HORSE_LEGS[0][1]), head: at(HORSE_NECK[0], HORSE_NECK[1], HORSE_NECK[2]) },
    };
  },
  arms: () => [0, 0, 0], // (down on the ground already, once they've taken its stance)
};

export const horseStaging: Staging = {
  title: "Horse-coper's word",
  becomes: 'A horse',
  lines: [
    [0, '{name} hears their name called, from a long way off.'],
    [0.04, 'They go down on all fours: the back level, the hands on the ground.'],
    [0.27, 'The legs lengthen and straighten, all four. Hands and feet close into hooves.'],
    [0.45, 'The back deepens into a barrel. A tail. The neck arches up; the face grows long.'],
    [0.72, 'A mane. A white blaze.'],
    [0.92, 'A horse, standing where they stood.'],
  ],
  beastLines: [
    [0, '{name} hears something call it, from a long way off.'],
    [0.04, 'It squares itself up on its four legs.'],
    [0.27, 'The legs lengthen and straighten, all four. Hooves.'],
    [0.45, 'The body lengthens into a barrel. A long tail. The neck arches up; the face grows long.'],
    [0.72, 'A mane. A white blaze.'],
    [0.92, 'A horse, standing where it stood.'],
  ],
  looseLines: [
    [0, '{name} hears something call it, from a long way off.'],
    [0.08, 'It comes apart, from the ground up.'],
    [0.4, 'Every piece of it finds a new place.'],
    [0.72, 'Taller. Longer. Hooved.'],
  ],
  cloud() {
    const horse = horseClouds(1);
    return { at: [horse.body, horse.head, ...horse.legs].flatMap((part) => part.at), color: [horse.body, horse.head, ...horse.legs].flatMap((part) => part.color), size: V };
  },
  pieces: (actor) => partPieces(actor, becoming),
  target() {
    const horse = createHorse(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    return {
      root: horse.root,
      height: HORSE.y,
      // A toss of its head; then a stamp of a foreleg.
      settle(j) {
        horse.head.rotation.x = j > 0.1 && j < 0.5 ? -0.45 * Math.sin(((j - 0.1) / 0.4) * Math.PI) : 0;
        horse.legs[3].rotation.x = j > 0.55 && j < 0.9 ? -0.5 * Math.abs(Math.sin(((j - 0.55) / 0.35) * Math.PI * 2)) : 0;
      },
    };
  },
};
