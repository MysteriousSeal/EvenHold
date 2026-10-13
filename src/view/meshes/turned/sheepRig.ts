// A sheep someone's been turned into, drawn where it is (quadruped.ts): walking, in short quick steps under its
// wool (its legs in diagonal pairs), and stood still: its head down to graze most of the while, up again to chew,
// its jaw going round, a look to one side now and then.
import type * as THREE from 'three';
import { sheepShape } from './sheepVoxels';
import { GrazerRig, createQuadruped, type Gait } from './quadruped';

const GAIT: Gait = { turn: 5, stride: 20, swing: 0.4, bob: 0.003, nod: 0.05, every: 8, grazing: 0.7, down: 1.2, ease: 2 };
const LOOK_EVERY = 5; // seconds, stood with its head up: between one look aside and the next

// The sheep's parts, put together. `coat`: which of its coats (sheepVoxels.ts).
export const createSheep = (material: THREE.Material, coat = 0) => createQuadruped(material, sheepShape(coat));

export class SheepRig extends GrazerRig {
  constructor(material: THREE.Material, coat = 0) {
    super(material, sheepShape(coat), GAIT);
  }

  // Its head up: chewing, round and round; a look aside.
  protected override idle(time: number): { head: [number, number, number]; paw: number } {
    const look = (time % LOOK_EVERY) / LOOK_EVERY;
    return { head: [Math.sin(time * 8) * 0.04, look < 0.3 ? 0.5 * Math.sin((look / 0.3) * Math.PI) : 0, Math.cos(time * 8) * 0.07], paw: 0 };
  }
}
