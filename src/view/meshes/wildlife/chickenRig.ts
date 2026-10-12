// Whoever's been turned into a chicken (model/spells/chickens.ts), drawn as one in their place (their own figure
// hidden meanwhile: enemyViews, npcViews, travellerViews): a hen strutting (her legs scissoring, her head bobbing
// forward with each step), and stood still pecking at the ground now and then. One on screen at most (the spell
// keeps one at a time), in whatever the hero's in (the world, a room, a dungeon: drawn bigger indoors, as all are).
import * as THREE from 'three';
import type { Being } from '../../../model/spells/chickens';
import { CreatureRig, partMesher } from '../common/creatureRig';
import { BODY_GRID, CHICKEN_PALETTE, CHICKEN_VOXEL_SIZE, HEAD_GRID, LEG_HEIGHT, buildChickenBody, buildChickenHead, buildChickenLeg } from './chickenVoxels';

const V = CHICKEN_VOXEL_SIZE;
const TURN_RATE = 9;
const STEP = 26; // leg-swing radians per world unit strutted
const PECK_EVERY = 1.1; // seconds between pecks, stood still
const PECK_DOWN = 1.15; // radians her head dips

class ChickenRig extends CreatureRig {
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private strutted = 0;

  constructor(material: THREE.Material) {
    super(0);
    const mesh = partMesher(V);
    const [bx, , bz] = BODY_GRID;
    this.body.add(new THREE.Mesh(mesh(buildChickenBody(), CHICKEN_PALETTE, [bx / 2, 0, bz / 2]), material));
    this.body.position.y = LEG_HEIGHT * V;
    this.head.add(new THREE.Mesh(mesh(buildChickenHead(), CHICKEN_PALETTE, [HEAD_GRID[0] / 2, 0, 1.5]), material)); // pivot at the base of the neck
    this.head.position.set(0, 2.5 * V, 2.5 * V);
    this.body.add(this.head);
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.add(new THREE.Mesh(mesh(buildChickenLeg(), CHICKEN_PALETTE, [0.5, 3, 0.5]), material)); // pivot at the hip
      leg.position.set(side * 1 * V, LEG_HEIGHT * V, 0);
      this.legs.push(leg);
      this.root.add(leg);
    }
    this.root.add(this.body);
  }

  update(being: Being, dt: number): void {
    const moved = this.follow({ x: being.x, y: being.y, z: being.z, heading: being.chicken?.facing }, dt, TURN_RATE);
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

export class ChickenView {
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  private readonly rig = new ChickenRig(this.material);
  private shown: Being | null = null;

  // Each frame: the one turned who's where the hero is (or none), drawn in `parent` at `scale`.
  update(being: Being | null, parent: THREE.Object3D, scale: number, dt: number): void {
    const { root } = this.rig;
    if (!being) {
      [this.shown, root.visible] = [null, false];
      return;
    }
    if (root.parent !== parent) parent.add(root);
    root.scale.setScalar(scale);
    root.visible = true;
    this.rig.update(being, this.shown === being ? dt : 0); // (another one: there at once, no walk from where the last was)
    this.shown = being;
  }
}
