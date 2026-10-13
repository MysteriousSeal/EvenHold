// A goat someone's been turned into, drawn where it is (quadruped.ts): walking, light and quick (its legs in
// diagonal pairs, a nod of its head with each stride), and stood still: its head down to browse about half the
// while; up, now and then a toss of its horns, up and back, and a shake of its beard after; a stamp of a foreleg.
import type * as THREE from 'three';
import { goatShape } from './goatVoxels';
import { GrazerRig, createQuadruped, type Gait } from './quadruped';

const GAIT: Gait = { turn: 6, stride: 16, swing: 0.5, bob: 0.005, nod: 0.09, every: 7, grazing: 0.5, down: 1.25, ease: 2.6 };
const TOSS_EVERY = 3.5; // seconds, stood with its head up: between one toss of its horns and the next

// The goat's parts, put together. `coat`: which of its coats (goatVoxels.ts).
export const createGoat = (material: THREE.Material, coat = 0) => createQuadruped(material, goatShape(coat));

export class GoatRig extends GrazerRig {
  constructor(material: THREE.Material, coat = 0) {
    super(material, goatShape(coat), GAIT);
  }

  // Its head up: a toss of its horns, a shake after, a stamp.
  protected override idle(time: number): { head: [number, number, number]; paw: number } {
    const temper = (time % TOSS_EVERY) / TOSS_EVERY;
    const [tossing, shaking, stamping] = [temper > 0.35 && temper < 0.55 ? Math.sin(((temper - 0.35) / 0.2) * Math.PI) : 0, temper > 0.55 && temper < 0.75 ? Math.sin(((temper - 0.55) / 0.2) * Math.PI) : 0, temper > 0.8 && temper < 0.95 ? Math.sin(((temper - 0.8) / 0.15) * Math.PI) : 0];
    return { head: [-0.55 * tossing, Math.sin(time * 30) * 0.2 * shaking, 0], paw: 0.5 * stamping };
  }
}
