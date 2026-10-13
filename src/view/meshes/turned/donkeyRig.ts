// A donkey someone's been turned into, drawn where it is (quadruped.ts): walking, slow and short in the stride (its
// legs in diagonal pairs, its head nodding low with each one), and stood still: its head down to graze, or up and
// let hang a little, dozing; now and then its head shaken, its long ears with it.
import type * as THREE from 'three';
import { donkeyShape } from './donkeyVoxels';
import { GrazerRig, createQuadruped, type Gait } from './quadruped';

const GAIT: Gait = { turn: 4, stride: 12, swing: 0.4, bob: 0.004, nod: 0.1, every: 8, grazing: 0.55, down: 1.3, ease: 1.8 };
const SHAKE_EVERY = 3.6; // seconds, stood with its head up: between one shake of its ears and the next

// The donkey's parts, put together. `coat`: which of its coats (donkeyVoxels.ts).
export const createDonkey = (material: THREE.Material, coat = 0) => createQuadruped(material, donkeyShape(coat));

export class DonkeyRig extends GrazerRig {
  constructor(material: THREE.Material, coat = 0) {
    super(material, donkeyShape(coat), GAIT);
  }

  // Its head up: let hang, slowly, as it dozes; then shaken, its ears flicked one way and the other.
  protected override idle(time: number): { head: [number, number, number]; paw: number } {
    const doze = (time % SHAKE_EVERY) / SHAKE_EVERY;
    const shaking = doze > 0.75 ? Math.sin(((doze - 0.75) / 0.25) * Math.PI) : 0;
    return { head: [0.22 * Math.min(1, doze / 0.75) * (1 - shaking), Math.sin(time * 24) * 0.14 * shaking, Math.sin(time * 24 + 1) * 0.22 * shaking], paw: 0 };
  }
}
