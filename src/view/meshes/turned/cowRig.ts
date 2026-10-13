// A cow someone's been turned into (model/spells/turned.ts), drawn where she is (quadruped.ts): walking, slow and
// heavy (her legs in diagonal pairs, her head nodding with each stride), and stood still: her head down to graze
// most of the while, up again to chew, her jaw going. A bull: the same, his head up more, pawing the ground and
// tossing his horns.
import type * as THREE from 'three';
import { cowShape } from './cowVoxels';
import { GrazerRig, createQuadruped, type Gait } from './quadruped';

const GAIT: Gait = { turn: 3, stride: 11, swing: 0.35, bob: 0.004, nod: 0.06, every: 9, grazing: 0.65, down: 0.95, ease: 1.6 };
const BULL_GRAZING = 0.25; // of the while he's stood, a bull's head down
const PAW_EVERY = 6.5; // seconds, a bull stood with his head up: between one pawing of the ground and the next

// The cow's parts, put together. `coat`: which of her coats. `bull`: a bull (cowVoxels.ts).
export const createCow = (material: THREE.Material, coat = 0, bull = false) => createQuadruped(material, cowShape(coat, bull));

export class CowRig extends GrazerRig {
  constructor(
    material: THREE.Material,
    coat = 0,
    private readonly bull = false,
  ) {
    super(material, cowShape(coat, bull), bull ? { ...GAIT, grazing: BULL_GRAZING } : GAIT);
  }

  // Her head up: chewing. His: now and then the ground pawed, his head lowered to it, and a toss of his horns.
  protected override idle(time: number): { head: [number, number, number]; paw: number } {
    const chewing = Math.sin(time * 7) * 0.04;
    const temper = this.bull ? (time % PAW_EVERY) / PAW_EVERY : 1;
    const [pawing, tossing] = [temper < 0.3 ? Math.abs(Math.sin((temper / 0.3) * Math.PI * 3)) : 0, temper > 0.3 && temper < 0.45 ? Math.sin(((temper - 0.3) / 0.15) * Math.PI) : 0];
    return { head: [chewing + 0.3 * pawing - 0.5 * tossing, 0, chewing * 1.5], paw: 0.55 * pawing };
  }
}
