// A pig someone's been turned into, drawn where it is (quadruped.ts): trotting, quick and short in the leg (its
// legs in diagonal pairs, its body barely rising), and stood still: its snout down at the ground most of the while,
// shoved along it and from side to side as it roots; up now and then, sniffing.
import type * as THREE from 'three';
import type { Hen } from '../../../model/spells/turned';
import { pigShape } from './pigVoxels';
import { GrazerRig, createQuadruped, type Gait } from './quadruped';

const GAIT: Gait = { turn: 6, stride: 24, swing: 0.5, bob: 0.003, nod: 0.05, every: 6, grazing: 0.75, down: 0.5, ease: 3 };
const ROOTING = 0.5; // of how far its head lowers: past that, it's rooting

// The pig's parts, put together. `coat`: which of its coats (pigVoxels.ts).
export const createPig = (material: THREE.Material, coat = 0) => createQuadruped(material, pigShape(coat));

export class PigRig extends GrazerRig {
  constructor(material: THREE.Material, coat = 0) {
    super(material, pigShape(coat), GAIT);
  }

  // Its head up: sniffing, its snout lifted in little jerks.
  protected override idle(time: number): { head: [number, number, number]; paw: number } {
    return { head: [-0.12 - 0.06 * Math.abs(Math.sin(time * 9)), Math.sin(time * 1.7) * 0.15, 0], paw: 0 };
  }

  // Its snout down: shoved forward along the ground and back, and from side to side.
  override update(beast: Hen, dt: number): void {
    super.update(beast, dt);
    const low = this.head.rotation.x / GAIT.down;
    if (low > ROOTING) this.head.rotation.set(this.head.rotation.x + Math.sin(this.time * 10) * 0.08 * low, Math.sin(this.time * 4.3) * 0.16 * low, 0);
  }
}
