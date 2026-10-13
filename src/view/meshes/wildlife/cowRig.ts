// A cow someone's been turned into (model/spells/chickens.ts), drawn where she is: walking, slow and heavy (her legs
// in diagonal pairs, her head nodding with each stride), and stood still: her head down to graze most of the while,
// up again to chew, her jaw going. A bull: the same, his head up more, pawing the ground and tossing his horns.
import * as THREE from 'three';
import type { Hen } from '../../../model/spells/chickens';
import { CreatureRig, partMesher } from '../common/creatureRig';
import { COW_BODY_PIVOT, COW_HEAD_PIVOT, COW_LEGS, COW_LEG_HEIGHT, COW_LEG_PIVOT, COW_NECK, COW_PALETTES, COW_VOXEL_SIZE, buildCowBody, buildCowHead, buildCowLeg } from './cowVoxels';

const V = COW_VOXEL_SIZE;
const TURN_RATE = 3;
const STRIDE = 11; // leg-swing radians per world unit walked
const GRAZE_EVERY = 9; // seconds, stood: head down for most of it, up for the rest
const GRAZE_DOWN = 0.95; // radians her neck lowers
const PAW_EVERY = 6.5; // seconds, a bull stood with his head up: between one pawing of the ground and the next

// The cow's parts, put together: her body carried on her legs, her head on its neck.
// `coat`: which of her coats. `bull`: a bull (cowVoxels.ts).
export function createCow(material: THREE.Material, coat = 0, bull = false): { root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: THREE.Group[] } {
  const [root, body, head] = [new THREE.Group(), new THREE.Group(), new THREE.Group()];
  const mesh = partMesher(V);
  const COW_PALETTE = COW_PALETTES[coat] ?? COW_PALETTES[0];
  body.add(new THREE.Mesh(mesh(buildCowBody(bull), COW_PALETTE, COW_BODY_PIVOT), material)); // (the middle of her barrel, at her hips' height)
  body.position.y = COW_LEG_HEIGHT * V;
  head.add(new THREE.Mesh(mesh(buildCowHead(bull), COW_PALETTE, COW_HEAD_PIVOT), material)); // pivot at the base of the neck
  head.position.set(COW_NECK[0] * V, (COW_NECK[1] - COW_LEG_HEIGHT) * V, COW_NECK[2] * V);
  body.add(head);
  const legs = COW_LEGS.map(([x, z], i) => {
    const leg = new THREE.Group();
    leg.add(new THREE.Mesh(mesh(buildCowLeg(i < 2), COW_PALETTE, COW_LEG_PIVOT), material)); // pivot at the hip
    leg.position.set(x * V, COW_LEG_HEIGHT * V, z * V);
    root.add(leg);
    return leg;
  });
  root.add(body);
  return { root, body, head, legs };
}

export class CowRig extends CreatureRig {
  private readonly body: THREE.Group;
  private readonly head: THREE.Group;
  private readonly legs: THREE.Group[];
  private walked = 0;
  private down = 0; // how far her head is lowered, eased

  constructor(
    material: THREE.Material,
    coat = 0,
    private readonly bull = false,
  ) {
    super(0);
    const cow = createCow(material, coat, bull);
    [this.body, this.head, this.legs] = [cow.body, cow.head, cow.legs];
    this.root.add(cow.root);
  }

  update(cow: Hen, dt: number): void {
    const moved = this.follow({ x: cow.x, y: cow.y, z: cow.z, heading: cow.facing }, dt, TURN_RATE);
    this.walked += moved;
    const walking = moved > 1e-5;
    const swing = walking ? Math.sin(this.walked * STRIDE) : 0;
    // Diagonal pairs: hind left with fore right, hind right with fore left.
    for (const [i, leg] of this.legs.entries()) leg.rotation.x = (i === 0 || i === 3 ? swing : -swing) * 0.35;
    this.body.position.y = COW_LEG_HEIGHT * V + (walking ? Math.abs(swing) * 0.004 : 0);
    // Stood: her head down to graze most of the while, then up, chewing; walking: level, nodding with her stride.
    // (A bull: his head up most of the while; now and then the ground pawed, and a toss of his horns.)
    const grazing = !walking && this.time % GRAZE_EVERY < GRAZE_EVERY * (this.bull ? 0.25 : 0.65);
    const temper = this.bull && !walking && !grazing ? (this.time % PAW_EVERY) / PAW_EVERY : 1;
    const [pawing, tossing] = [temper < 0.3 ? Math.abs(Math.sin((temper / 0.3) * Math.PI * 3)) : 0, temper > 0.3 && temper < 0.45 ? Math.sin(((temper - 0.3) / 0.15) * Math.PI) : 0];
    if (pawing) this.legs[3].rotation.x = -0.55 * pawing;
    this.down += ((grazing ? 1 : 0) - this.down) * Math.min(1, 1.6 * dt);
    const chewing = !walking && !grazing ? Math.sin(this.time * 7) * 0.04 : 0;
    this.head.rotation.set(this.down * GRAZE_DOWN + (walking ? swing * 0.06 : 0) + chewing + 0.3 * pawing - 0.5 * tossing, 0, chewing * 1.5);
  }
}
