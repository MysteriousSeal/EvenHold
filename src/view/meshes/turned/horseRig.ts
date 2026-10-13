// A horse someone's been turned into (model/spells/turned.ts), drawn where it is (quadruped.ts): walking (its legs
// in diagonal pairs, a nod of its head with each stride), and stood still: its head lowered to graze, raised again.
import type * as THREE from 'three';
import { HORSE_SHAPE } from './horseVoxels';
import { GrazerRig, createQuadruped, type Gait } from './quadruped';

const GAIT: Gait = { turn: 5, stride: 9, swing: 0.45, bob: 0.006, nod: 0.08, every: 7, grazing: 0.7, down: 1.35, ease: 2.2 };

// The horse's parts, put together.
export const createHorse = (material: THREE.Material) => createQuadruped(material, HORSE_SHAPE);

export class HorseRig extends GrazerRig {
  constructor(material: THREE.Material) {
    super(material, HORSE_SHAPE, GAIT);
  }
}
