// The villages' livestock in their fields (model/wildlife/livestock.ts),
// round the hero: the fields near them stocked as they come near, let go as
// they're left, and every beast of them stepped and drawn each frame. They
// wear the very voxels of the beasts people are turned into (turned/*Voxels.ts:
// a sheep, a cow, a pig, a hen), but drawn as instances, a mesh to each part
// of each coat (a body, a head, and its legs, all four drawn as its hind
// leg), so a whole field of them costs three draws; walking, their legs swing in diagonal pairs and
// they nod; stood, their heads go down to graze (a hen's, to peck) and up
// again for a look about.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { Field } from '../../../model/types';
import { herdIn, stepBeast, type Beast, type LivestockKind } from '../../../model/wildlife/livestock';
import { partMesher } from '../common/creatureRig';
import type { Quadruped } from '../turned/quadruped';
import { sheepShape } from '../turned/sheepVoxels';
import { cowShape } from '../turned/cowVoxels';
import { pigShape } from '../turned/pigVoxels';
import { BODY_GRID, CHICKEN_PALETTE, CHICKEN_VOXEL_SIZE, HEAD_GRID, LEG_HEIGHT, buildChickenBody, buildChickenHead, buildChickenLeg } from '../turned/chickenVoxels';

const REACH = 26; // tiles from the hero to a field's middle, for it to be stocked
const MOST = 40; // beasts of a coat drawn, at most
const TURF = 0.04; // the pasture's turf, a voxel over the ground (field/pastureVoxels.ts)
const COATS: Record<LivestockKind, number> = { sheep: 2, cow: 3, pig: 3, hen: 1 };
// How each goes about: leg-swing radians per tile walked, how far its legs swing, its head's dip to graze, seconds
// between one grazing and the next (and of that, its head down), and how fast its head goes down and comes up.
const GAITS: Record<LivestockKind, { stride: number; swing: number; down: number; every: number; grazing: number; ease: number }> = {
  sheep: { stride: 20, swing: 0.4, down: 1.2, every: 8, grazing: 0.7, ease: 2 },
  cow: { stride: 12, swing: 0.35, down: 1.0, every: 10, grazing: 0.75, ease: 1.5 },
  pig: { stride: 22, swing: 0.45, down: 0.7, every: 6, grazing: 0.7, ease: 3 },
  hen: { stride: 26, swing: 0.6, down: 1.15, every: 1.1, grazing: 0.3, ease: 12 },
};

// A hen said as the four-legged are (but on two), for the one way of drawing them all.
const henShape = (): Quadruped => ({
  voxel: CHICKEN_VOXEL_SIZE,
  palette: CHICKEN_PALETTE,
  legHeight: LEG_HEIGHT,
  legs: [[-1, 0], [1, 0]],
  neck: [0, LEG_HEIGHT + 2.5, 2.5],
  pivots: { body: [BODY_GRID[0] / 2, 0, BODY_GRID[2] / 2], head: [HEAD_GRID[0] / 2, 0, 1.5], leg: [0.5, 3, 0.5] },
  body: buildChickenBody,
  head: buildChickenHead,
  leg: buildChickenLeg,
});
const SHAPES: Record<LivestockKind, (coat: number) => Quadruped> = { sheep: sheepShape, cow: cowShape, pig: pigShape, hen: henShape };

// One coat of one kind: its parts' meshes, and how many are drawn this frame.
interface Breed {
  shape: Quadruped;
  body: THREE.InstancedMesh;
  head: THREE.InstancedMesh;
  legs: THREE.InstancedMesh;
  count: number;
}

// A beast as it's drawn: how far it's walked (its stride), its head's dip (eased), its own clock.
interface Shown {
  beast: Beast;
  walked: number;
  lowered: number;
  time: number;
}

export class LivestockViews {
  private readonly material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  private readonly breeds = new Map<string, Breed>();
  private readonly herds = new Map<Field, { y: number; shown: Shown[] }>();
  private heroTile = '';
  private readonly m = { root: new THREE.Matrix4(), body: new THREE.Matrix4(), part: new THREE.Matrix4(), step: new THREE.Matrix4(), turn: new THREE.Matrix4() };

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly model: GameModel,
  ) {
    for (const kind of Object.keys(COATS) as LivestockKind[]) for (let coat = 0; coat < COATS[kind]; coat++) this.breedOf(kind, coat); // (all made now: none to make, nor compile, as they're first seen)
  }

  // Each frame, out in the world.
  update(dt: number, hero: { x: number; z: number }): void {
    const outdoors = !this.model.inside;
    for (const breed of this.breeds.values()) breed.body.visible = breed.head.visible = breed.legs.visible = false;
    if (!outdoors) return;
    this.near(hero);
    for (const breed of this.breeds.values()) breed.count = 0;
    for (const [field, herd] of this.herds) {
      for (const shown of herd.shown) {
        stepBeast(shown.beast, field, hero, dt);
        this.draw(shown, herd.y, dt);
      }
    }
    for (const breed of this.breeds.values()) {
      for (const mesh of [breed.body, breed.head, breed.legs]) {
        mesh.count = mesh === breed.legs ? breed.count * breed.shape.legs.length : breed.count;
        mesh.visible = breed.count > 0;
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }

  // The fields round the hero stocked, those left behind let go (looked over as the hero comes onto another tile).
  private near(hero: { x: number; z: number }): void {
    const tile = `${Math.round(hero.x)},${Math.round(hero.z)}`;
    if (tile === this.heroTile) return;
    this.heroTile = tile;
    const keep = new Set<Field>();
    for (const field of this.model.fields) {
      const [mx, mz] = [field.x0 + field.width / 2, field.z0 + field.depth / 2];
      if (Math.abs(mx - hero.x) > REACH || Math.abs(mz - hero.z) > REACH) continue;
      keep.add(field);
      if (this.herds.has(field)) continue;
      const shown = herdIn(field, this.model.seed).map((beast) => ({ beast, walked: 0, lowered: 0, time: beast.n * 2.3 + field.x0 }));
      this.herds.set(field, { y: this.model.getGroundY(mx - 0.5, mz - 0.5) + TURF, shown });
    }
    for (const field of this.herds.keys()) if (!keep.has(field)) this.herds.delete(field);
  }

  // A kind's coat's meshes (made the first time one's seen).
  private breedOf(kind: LivestockKind, coat: number): Breed {
    const key = `${kind}:${Math.min(coat, COATS[kind] - 1)}`;
    let breed = this.breeds.get(key);
    if (breed) return breed;
    const shape = SHAPES[kind](coat);
    const mesh = partMesher(shape.voxel);
    const instanced = (geometry: THREE.BufferGeometry, per: number) => {
      const m = new THREE.InstancedMesh(geometry, this.material, MOST * per);
      m.frustumCulled = false; // (spread over the fields round the hero)
      m.count = 0;
      this.scene.add(m);
      return m;
    };
    breed = {
      shape,
      body: instanced(mesh(shape.body(), shape.palette, shape.pivots.body), 1),
      head: instanced(mesh(shape.head(), shape.palette, shape.pivots.head), 1),
      legs: instanced(mesh(shape.leg(true), shape.palette, shape.pivots.leg), shape.legs.length), // (fore and hind alike: one draw the fewer)
      count: 0,
    };
    this.breeds.set(key, breed);
    return breed;
  }

  // One beast's parts into its breed's meshes: its legs swinging as it walks, its body bobbing, its head down to graze.
  private draw(shown: Shown, y: number, dt: number): void {
    const { beast } = shown;
    const breed = this.breedOf(beast.kind, beast.coat);
    if (breed.count >= MOST) return;
    const { shape } = breed;
    const gait = GAITS[beast.kind];
    const V = shape.voxel;
    shown.time += dt;
    const walking = beast.speed > 0.01;
    shown.walked += beast.speed * dt;
    const swing = walking ? Math.sin(shown.walked * gait.stride) : 0;
    const grazing = !walking && shown.time % gait.every < gait.every * gait.grazing;
    shown.lowered += ((grazing ? 1 : 0) - shown.lowered) * Math.min(1, gait.ease * dt);
    const { root, body, part, step, turn } = this.m;
    root.makeRotationY(beast.heading).setPosition(beast.x, y, beast.z);
    // Its body on its legs (rising a little with each stride), its head on its neck.
    body.multiplyMatrices(root, step.makeTranslation(0, shape.legHeight * V + Math.abs(swing) * 0.004, 0));
    const i = breed.count++;
    breed.body.setMatrixAt(i, body);
    part.multiplyMatrices(body, step.makeTranslation(shape.neck[0] * V, (shape.neck[1] - shape.legHeight) * V, shape.neck[2] * V));
    breed.head.setMatrixAt(i, part.multiply(turn.makeRotationX(shown.lowered * gait.down + swing * 0.05)));
    // Its legs: diagonal pairs (hind left with fore right); a hen's, one and then the other.
    const two = shape.legs.length === 2;
    shape.legs.forEach(([lx, lz], n) => {
      const sign = two ? (n === 0 ? 1 : -1) : n === 0 || n === 3 ? 1 : -1;
      part.multiplyMatrices(root, step.makeTranslation(lx * V, shape.legHeight * V, lz * V)).multiply(turn.makeRotationX(sign * swing * gait.swing));
      breed.legs.setMatrixAt(i * shape.legs.length + n, part);
    });
  }

  get materials(): THREE.Material[] {
    return [this.material];
  }
}
