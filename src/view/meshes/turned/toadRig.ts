// A toad someone's been turned into (model/spells/turned.ts), drawn where it is (quadruped.ts; ownParts.ts): sat, its
// throat pulsing; and going from place to place in hops: up off its hind legs, those stretched out behind it in the
// air, its forelegs reached out to land on.
import * as THREE from 'three';
import { bell, smooth, through } from '../../cinema/easing';
import type { Hen } from '../../../model/spells/turned';
import { CreatureRig } from '../common/creatureRig';
import { hung, split, type Turned } from './ownParts';
import { createQuadruped } from './quadruped';
import { TOAD_THROAT_JOINT, TOAD_VOXEL_SIZE, isToadThroat, toadShape } from './toadVoxels';

const TURN_RATE = 10;
const HOP_LENGTH = 0.2; // world units it covers in a hop
const HOP_HEIGHT = TOAD_VOXEL_SIZE * 4.5; // how high one takes it
const LANDING = 0.32; // seconds a hop takes to end, once it's stopped going anywhere
const PULSE = 5.5; // radians a second, its throat

export interface Toad {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  legs: THREE.Group[];
  throat: THREE.Group;
}

// The toad's parts, put together: its throat a part of its own, hung under its jaw. `coat`: which of its coats.
export function createToad(material: THREE.Material, coat = 0): Toad {
  const shape = toadShape(coat);
  const [head, throat] = split(shape.head(), isToadThroat);
  const made = createQuadruped(material, { ...shape, head: () => head });
  const pouch = hung(material, shape, throat, TOAD_THROAT_JOINT, shape.pivots.head);
  made.head.add(pouch);
  return { ...made, throat: pouch };
}

// Its throat swollen (`k`: 0 as it hangs, 1 full): down and forward from where it hangs, and a little wider.
export function swollen(toad: Toad, k: number): void {
  toad.throat.scale.set(1 + 0.2 * k, 1 + 0.8 * k, 1 + 0.25 * k);
}

// It through a hop (`hop`: 0 on the ground, through 1, on it again), `high` at the top of it: up and over; its fore
// end up as it leaves the ground and down as it comes back to it; its hind legs stretched out behind it, then drawn
// up under it again; its forelegs reached forward to land on.
export function hopping(toad: Toad, hop: number, high: number): void {
  const [up, kick, reach] = [bell(hop), bell(smooth(through(hop, [0, 0.8]))), bell(through(hop, [0.45, 1]))];
  toad.root.position.y = up * high;
  toad.root.rotation.x = -0.4 * Math.cos(hop * Math.PI) * up;
  for (const [i, leg] of toad.legs.entries()) leg.rotation.x = i < 2 ? 1.35 * kick : -0.7 * reach;
}

export class ToadRig extends CreatureRig {
  private readonly toad: Toad;
  private hop = 0; // how far through a hop it is (0: on the ground)

  constructor(material: THREE.Material, coat = 0) {
    super(0);
    this.toad = createToad(material, coat);
    this.root.add(this.toad.root);
  }

  update(toad: Turned & Pick<Hen, 'hop'>, dt: number): void {
    const moved = this.follow({ x: toad.x, y: toad.y, z: toad.z, heading: toad.facing }, dt, TURN_RATE);
    // A hop: the model's own word on it, where it has one (how far through its leap it is: 0 sat, through 1 as it
    // lands: one rise and fall for each leap it makes, down as it stops). Without one, told from its having gone
    // somewhere since the last frame: one for every HOP_LENGTH it covers; and, once it's stopped, the one it's in
    // the middle of ended in its own time.
    if (toad.hop !== undefined) this.hop = toad.hop >= 1 ? 0 : toad.hop;
    else if (moved > 1e-5) this.hop = (this.hop + moved / HOP_LENGTH) % 1;
    else if (this.hop > 0) this.hop = this.hop + dt / LANDING >= 1 ? 0 : this.hop + dt / LANDING;
    hopping(this.toad, this.hop, HOP_HEIGHT);
    // Sat: its throat out and in. In the air: drawn in.
    swollen(this.toad, this.hop > 0 ? 0 : Math.max(0, Math.sin(this.time * PULSE)) * 0.7);
  }
}
