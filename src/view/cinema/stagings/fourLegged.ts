// What every four-legged beast someone may be turned into is staged with (a horse, a cow, a pig, a goat, a donkey, a
// sheep, a rat, a cat, a toad: each its own staging), said once: someone going down on all fours (`ON_ALL_FOURS`);
// what has no parts taken apart into its voxels whole, the same two beats between its first and last (`looseLines`);
// its turning step by step (turning.ts); and it, made in its own material, settling.
import * as THREE from 'three';
import type { Quadruped } from '../../meshes/turned/quadruped';
import { joined } from '../morph/clouds';
import type { Staging } from '../staging';
import { quadrupedClouds, type Becoming } from './becoming';
import { UNDRESSED, turningInto, type Telling } from './turning';

// What's said of someone as they take its stance: the same, whatever four-legged beast they become (no arms told
// apart from the legs: all four at once).
export const ON_ALL_FOURS = { ...UNDRESSED, stance: 'They go down on all fours, unsteady: the back level, the hands on the ground.', arms: '' };

export interface FourLegged<Made extends { root: THREE.Object3D }> {
  title: string;
  becomes: string;
  lines: Staging['lines'];
  heard: string; // the first that's said of what has no parts, taken apart
  loosely: string; // and the last: what it's become
  shape: Quadruped;
  becoming: Becoming;
  person: Telling;
  beast: Telling;
  make(material: THREE.Material): Made; // it, as it'll be seen after
  height: number;
  settle(made: Made, j: number, time: number): void; // `j`: 0 just there, 1 settled
}

export function fourLeggedStaging<Made extends { root: THREE.Object3D }>(its: FourLegged<Made>): Staging {
  return {
    title: its.title,
    becomes: its.becomes,
    lines: its.lines,
    looseLines: [
      [0, its.heard],
      [0.08, 'It comes apart, from the ground up.'],
      [0.4, 'Every piece of it finds a new place.'],
      [0.72, its.loosely],
    ],
    cloud: () => ((clouds) => joined([clouds.body, clouds.head, ...clouds.legs], its.shape.voxel))(quadrupedClouds(its.shape, 1)),
    direct: turningInto(its.becoming, { person: its.person, beast: its.beast }),
    target() {
      const made = its.make(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
      return { root: made.root, height: its.height, settle: (j, time) => its.settle(made, j, time) };
    },
  };
}
