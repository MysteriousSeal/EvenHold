// A hen someone's been turned into (model/spells/turned.ts: for good), drawn where she is: strutting (her legs
// scissoring, her head bobbing forward with each step), and stood still pecking at the ground now and then.
import * as THREE from 'three';
import type { Hen } from '../../../model/spells/turned';
import { CreatureRig, partMesher } from '../common/creatureRig';
import { BODY_GRID, CHICKEN_PALETTE, CHICKEN_VOXEL_SIZE, HEAD_GRID, LEG_HEIGHT, buildChickenBody, buildChickenHead, buildChickenLeg } from './chickenVoxels';

const V = CHICKEN_VOXEL_SIZE;
const TURN_RATE = 9;
const STEP = 26; // leg-swing radians per world unit strutted
const PECK_EVERY = 1.1; // seconds between pecks, stood still
const PECK_DOWN = 1.15; // radians her head dips

// The hen's parts, put together: her body carried on her legs, her head on its neck.
export function createHen(material: THREE.Material): { root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: THREE.Group[] } {
  const [root, body, head] = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const legs: THREE.Group[] = [];
  const mesh = partMesher(V);
  const [bx, , bz] = BODY_GRID;
  body.add(new THREE.Mesh(mesh(buildChickenBody(), CHICKEN_PALETTE, [bx / 2, 0, bz / 2]), material));
  body.position.y = LEG_HEIGHT * V;
  head.add(new THREE.Mesh(mesh(buildChickenHead(), CHICKEN_PALETTE, [HEAD_GRID[0] / 2, 0, 1.5]), material)); // pivot at the base of the neck
  head.position.set(0, 2.5 * V, 2.5 * V);
  body.add(head);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.add(new THREE.Mesh(mesh(buildChickenLeg(), CHICKEN_PALETTE, [0.5, 3, 0.5]), material)); // pivot at the hip
    leg.position.set(side * 1 * V, LEG_HEIGHT * V, 0);
    legs.push(leg);
    root.add(leg);
  }
  root.add(body);
  return { root, body, head, legs };
}

export class ChickenRig extends CreatureRig {
  private readonly body: THREE.Group;
  private readonly head: THREE.Group;
  private readonly legs: THREE.Group[];
  private strutted = 0;

  constructor(material: THREE.Material) {
    super(0);
    const hen = createHen(material);
    [this.body, this.head, this.legs] = [hen.body, hen.head, hen.legs];
    this.root.add(hen.root);
  }

  update(hen: Hen, dt: number): void {
    const moved = this.follow({ x: hen.x, y: hen.y, z: hen.z, heading: hen.facing }, dt, TURN_RATE);
    this.strutted += moved;
    const walking = moved > 1e-5;
    const swing = walking ? Math.sin(this.strutted * STEP) : 0;
    this.legs[0].rotation.x = swing * 0.6;
    this.legs[1].rotation.x = -swing * 0.6;
    this.body.position.y = LEG_HEIGHT * V + (walking ? Math.abs(swing) * 0.004 : 0);
    // Walking: her head thrust forward with each step. Stood: down to peck, and up again.
    const peck = (this.time % PECK_EVERY) / PECK_EVERY;
    this.head.rotation.x = walking ? swing * 0.18 : peck < 0.3 ? Math.sin((peck / 0.3) * Math.PI) * PECK_DOWN : 0;
  }
}
