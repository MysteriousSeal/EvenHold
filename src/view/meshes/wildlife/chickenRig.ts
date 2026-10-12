// Whoever's been turned into a chicken (model/spells/chickens.ts), drawn as one in their place (their own figure
// hidden meanwhile: enemyViews, npcViews, travellerViews): a hen strutting (her legs scissoring, her head bobbing
// forward with each step), and stood still pecking at the ground now and then. One on screen at most (the spell
// keeps one at a time), in whatever the hero's in (the world, a room, a dungeon: drawn bigger indoors, as all are).
// The turning itself, into one and back, is drawn in stages (chickenMorph.ts): hers from where their own figure
// gives way to her.
import * as THREE from 'three';
import { morphOf, type Being } from '../../../model/spells/chickens';
import type { SmokePuffs } from '../common/smokePuffs';
import { SWAP, henShape } from './chickenMorph';
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

class ChickenRig extends CreatureRig {
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
    // Part turned (chickenMorph.ts): stretched and springing back, spun, hopping, a shake of her head; no pecking yet.
    const m = being.chicken ? morphOf(being.chicken) : 1;
    const shape = henShape(m);
    this.shape.set(shape.across, shape.up, shape.across);
    this.root.rotation.y += shape.spin;
    this.root.position.y += shape.hop;
    this.head.rotation.y = shape.shake;
    if (m < 1) this.head.rotation.x = 0;
  }

  readonly shape = new THREE.Vector3(1, 1, 1); // how she's stretched just now, of her own shape
}

export class ChickenView {
  readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  private readonly rig = new ChickenRig(this.material);
  private shown: Being | null = null;
  private last: { parent: THREE.Object3D; x: number; y: number; z: number; scale: number; m: number } | null = null; // where she was last drawn, and how far turned
  private shed = 0; // seconds till the next feather flies off, mid-turning

  // Each frame: the one turned who's where the hero is (or none), drawn in `parent` at `scale`; `smoke`: the puffs and
  // feathers of it. The hen's shown from SWAP on (chickenMorph.ts: their own figure up to it); as one gives way to the
  // other, either way, a puff of smoke and a burst of feathers; a feather or two flying off all through the turning.
  update(being: Being | null, parent: THREE.Object3D, scale: number, dt: number, smoke: SmokePuffs): void {
    const { root } = this.rig;
    const was = this.last;
    if (!being?.chicken || being !== this.shown) {
      // Gone, or another in her place (turned back at a stroke: dead, or the charm cast on someone else): a puff where she stood.
      if (was && was.m >= SWAP && was.parent.parent) [smoke.puff(was.parent, was.x, was.y, was.z, was.scale), smoke.feathers(was.parent, was.x, was.y, was.z, was.scale, 8)];
      this.last = null;
    }
    if (!being?.chicken) {
      [this.shown, root.visible] = [null, false];
      return;
    }
    const m = morphOf(being.chicken);
    if (root.parent !== parent) parent.add(root);
    this.rig.update(being, this.shown === being ? dt : 0); // (another one: there at once, no walk from where the last was)
    root.scale.copy(this.rig.shape).multiplyScalar(scale);
    root.visible = m >= SWAP;
    const before = this.shown === being ? this.last?.m ?? 0 : 0;
    if (before < SWAP !== m < SWAP) [smoke.puff(parent, being.x, being.y, being.z, scale), smoke.feathers(parent, being.x, being.y, being.z, scale, 16)];
    this.shed -= dt;
    if (m > 0.12 && m < 1 && this.shed <= 0) {
      this.shed = 0.09;
      smoke.feathers(parent, being.x, being.y, being.z, scale, 1);
    }
    this.shown = being;
    this.last = { parent, x: being.x, y: being.y, z: being.z, scale, m };
  }
}
