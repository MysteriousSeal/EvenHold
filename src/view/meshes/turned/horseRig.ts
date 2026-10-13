// A horse someone's been turned into (model/spells/turned.ts), drawn where it is (quadruped.ts): walking (its legs
// in diagonal pairs, a nod of its head with each stride), and stood still: its head lowered to graze, raised again.
// Its neck is long and its legs longer: lowered as one piece with its head, its nose never came near the grass and
// pointed back at its knees. So its head's a part of its own on its neck (ownParts.ts), turning at its poll: its
// neck swung well down, its head let hang from it, nose to the ground.
import * as THREE from 'three';
import type { Hen } from '../../../model/spells/turned';
import { partMesher } from '../common/creatureRig';
import { HORSE_HEAD_PIVOT, HORSE_SHAPE } from './horseVoxels';
import { hung, split } from './ownParts';
import { GrazerRig, createQuadruped, type Gait } from './quadruped';

const GAIT: Gait = { turn: 5, stride: 9, swing: 0.45, bob: 0.006, nod: 0.08, every: 7, grazing: 0.7, down: 2.2, ease: 2.2 };
const POLL: [number, number, number] = [2.5, 9, 7]; // where its head turns on its neck, in its head's voxels
const HANGS = 1.15; // radians its head's let back up on its neck, lowered: hanging, not tucked
// Its head, of its head and neck: over its throat, and before it.
const skull = (_x: number, y: number, z: number) => y >= 10 || z >= 9 || (y >= 9 && z >= 7);

// The horse's parts, put together.
export const createHorse = (material: THREE.Material) => createQuadruped(material, HORSE_SHAPE);

export class HorseRig extends GrazerRig {
  private readonly skull: THREE.Group;

  constructor(material: THREE.Material) {
    super(material, HORSE_SHAPE, GAIT);
    const [neck, head] = split(HORSE_SHAPE.head(), skull);
    for (const made of [...this.head.children]) [(made as THREE.Mesh).geometry.dispose(), this.head.remove(made)];
    this.head.add(new THREE.Mesh(partMesher(HORSE_SHAPE.voxel)(neck, HORSE_SHAPE.palette, HORSE_HEAD_PIVOT), material));
    this.skull = hung(material, HORSE_SHAPE, head, POLL, HORSE_HEAD_PIVOT);
    this.head.add(this.skull);
  }

  update(beast: Hen, dt: number): void {
    super.update(beast, dt);
    this.skull.rotation.x = -this.lowered * HANGS;
  }
}
