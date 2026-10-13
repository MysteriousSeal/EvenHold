// A horse someone's been turned into (model/spells/chickens.ts), drawn where it is: walking (its legs in diagonal
// pairs, a nod of its head with each stride), and stood still: its head lowered to graze, raised again, a flick of
// an ear's worth of a toss now and then.
import * as THREE from 'three';
import type { Hen } from '../../../model/spells/chickens';
import { CreatureRig, partMesher } from '../common/creatureRig';
import { HORSE_BODY_PIVOT, HORSE_HEAD_PIVOT, HORSE_LEGS, HORSE_LEG_HEIGHT, HORSE_LEG_PIVOT, HORSE_NECK, HORSE_PALETTE, HORSE_VOXEL_SIZE, buildHorseBody, buildHorseHead, buildHorseLeg } from './horseVoxels';

const V = HORSE_VOXEL_SIZE;
const TURN_RATE = 5;
const STRIDE = 9; // leg-swing radians per world unit walked
const GRAZE_EVERY = 7; // seconds, stood: head down for most of it, up for the rest
const GRAZE_DOWN = 1.35; // radians its neck lowers

// The horse's parts, put together: its body carried on its legs, its head on its neck.
export function createHorse(material: THREE.Material): { root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: THREE.Group[] } {
  const [root, body, head] = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const mesh = partMesher(V);
  body.add(new THREE.Mesh(mesh(buildHorseBody(), HORSE_PALETTE, HORSE_BODY_PIVOT), material)); // (the middle of its barrel, at its hips' height)
  body.position.y = HORSE_LEG_HEIGHT * V;
  head.add(new THREE.Mesh(mesh(buildHorseHead(), HORSE_PALETTE, HORSE_HEAD_PIVOT), material)); // pivot at the base of the neck
  head.position.set(HORSE_NECK[0] * V, (HORSE_NECK[1] - HORSE_LEG_HEIGHT) * V, HORSE_NECK[2] * V);
  body.add(head);
  const legs = HORSE_LEGS.map(([x, z], i) => {
    const leg = new THREE.Group();
    leg.add(new THREE.Mesh(mesh(buildHorseLeg(i < 2), HORSE_PALETTE, HORSE_LEG_PIVOT), material)); // pivot at the hip
    leg.position.set(x * V, HORSE_LEG_HEIGHT * V, z * V);
    root.add(leg);
    return leg;
  });
  root.add(body);
  return { root, body, head, legs };
}

export class HorseRig extends CreatureRig {
  private readonly body: THREE.Group;
  private readonly head: THREE.Group;
  private readonly legs: THREE.Group[];
  private walked = 0;
  private down = 0; // how far its head is lowered, eased

  constructor(material: THREE.Material) {
    super(0);
    const horse = createHorse(material);
    [this.body, this.head, this.legs] = [horse.body, horse.head, horse.legs];
    this.root.add(horse.root);
  }

  update(horse: Hen, dt: number): void {
    const moved = this.follow({ x: horse.x, y: horse.y, z: horse.z, heading: horse.facing }, dt, TURN_RATE);
    this.walked += moved;
    const walking = moved > 1e-5;
    const swing = walking ? Math.sin(this.walked * STRIDE) : 0;
    // Diagonal pairs: hind left with fore right, hind right with fore left.
    for (const [i, leg] of this.legs.entries()) leg.rotation.x = (i === 0 || i === 3 ? swing : -swing) * 0.45;
    this.body.position.y = HORSE_LEG_HEIGHT * V + (walking ? Math.abs(swing) * 0.006 : 0);
    // Stood: its head down to graze most of the while, up for a look about; walking: up, nodding with its stride.
    const grazing = !walking && this.time % GRAZE_EVERY < GRAZE_EVERY * 0.7;
    this.down += ((grazing ? 1 : 0) - this.down) * Math.min(1, 2.2 * dt);
    this.head.rotation.x = this.down * GRAZE_DOWN + (walking ? swing * 0.08 : 0);
  }
}
