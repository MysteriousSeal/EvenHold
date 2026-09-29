// One four-legged foe on screen (a wolf, a boar): voxel parts on joints
// (wolfVoxels.ts, boarVoxels.ts), laid out by its spec, animated from its
// model state each frame:
// - trotting legs in diagonal pairs, paced by distance moved, a head bob,
//   a tail that wags when idle and rides high when chasing;
// - an attack: rears back, lunges forward with a snapping head and front
//   legs off the ground, then recovers;
// - a red flash while hurt, and a voxel health bar over its head (yellow
//   on a passive one, that only fights back);
// - on death, it rolls onto its side, then bursts into voxel cubes.

import * as THREE from 'three';
import { ENEMY_STATS } from '../../../model/constants';
import type { Enemy, EnemyKind } from '../../../model/types';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { HealthBar, VoxelBurst } from './enemyParts';
import { BODY_GRID, HEAD_GRID, LEG_GRID, TAIL_GRID, WOLF_PALETTE, WOLF_VOXEL_SIZE, buildBody, buildHead, buildLeg, buildTail } from './wolfVoxels';
import { BOAR_BODY_GRID, BOAR_HEAD_GRID, BOAR_LEG_GRID, BOAR_PALETTE, BOAR_TAIL_GRID, buildBoarBody, buildBoarHead, buildBoarLeg, buildBoarTail } from './boarVoxels';

const V = WOLF_VOXEL_SIZE; // the boar's voxels are the wolf's size
const STRIDE = 6; // trot-cycle radians per world unit
const LEG_SWING = 0.6;
const TOPPLE_TIME = 0.35; // seconds to fall onto its side

type Grid3 = [number, number, number];
type Part = { grid: () => VoxelGrid; size: Grid3 };

// What a kind of beast is made of and where its parts join.
export interface BeastSpec {
  kind: EnemyKind;
  name: string;
  palette: number[];
  body: Part;
  head: Part;
  leg: Part;
  tail: Part;
  headDrop: number; // voxels below the body's top that the head sits at
  legsAt: Array<[number, number]>; // front right, front left, back right, back left (voxels, its right is -X)
  passive: boolean; // a yellow health bar: it only fights back
}

export const WOLF_SPEC: BeastSpec = {
  kind: 'wolf',
  name: 'Wolf',
  palette: WOLF_PALETTE,
  body: { grid: buildBody, size: BODY_GRID },
  head: { grid: buildHead, size: HEAD_GRID },
  leg: { grid: buildLeg, size: LEG_GRID },
  tail: { grid: buildTail, size: TAIL_GRID },
  headDrop: 3,
  legsAt: [[-2, 5], [2, 5], [-2, -5], [2, -5]],
  passive: false,
};

export const BOAR_SPEC: BeastSpec = {
  kind: 'boar',
  name: 'Boar',
  palette: BOAR_PALETTE,
  body: { grid: buildBoarBody, size: BOAR_BODY_GRID },
  head: { grid: buildBoarHead, size: BOAR_HEAD_GRID },
  leg: { grid: buildBoarLeg, size: BOAR_LEG_GRID },
  tail: { grid: buildBoarTail, size: BOAR_TAIL_GRID },
  headDrop: 5, // carried low
  legsAt: [[-2.5, 4], [2.5, 4], [-2.5, -4], [2.5, -4]],
  passive: true,
};

export interface BeastLook {
  spec: BeastSpec;
  normal: THREE.Material;
  flash: THREE.Material;
  geometry: { body: THREE.BufferGeometry; head: THREE.BufferGeometry; leg: THREE.BufferGeometry; tail: THREE.BufferGeometry };
}

// Materials and meshed parts shared by every beast of a kind on screen.
export function createBeastLook(spec: BeastSpec, flash: THREE.Material): BeastLook {
  const mesh = (part: Part, pivot: Grid3) => greedyMesh(part.grid(), spec.palette, V, new THREE.Vector3(-pivot[0] * V, -pivot[1] * V, -pivot[2] * V));
  const { body, head, leg, tail } = spec;
  return {
    spec,
    normal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    flash,
    geometry: {
      body: mesh(body, [body.size[0] / 2, 0, body.size[2] / 2]),
      head: mesh(head, [head.size[0] / 2, 0, 0]),
      leg: mesh(leg, [leg.size[0] / 2, leg.size[1], leg.size[2] / 2]),
      tail: mesh(tail, [tail.size[0] / 2, tail.size[1] / 2, tail.size[2]]),
    },
  };
}

export class BeastRig {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly bar: HealthBar;
  private readonly burst: VoxelBurst;
  private readonly last = new THREE.Vector2(Number.NaN, 0);
  private heading = 0;
  private phase = 0;
  private time = 0;

  constructor(private readonly look: BeastLook) {
    const { spec } = look;
    const [LEG_H, BODY_H, BODY_L] = [spec.leg.size[1] * V, spec.body.size[1] * V, spec.body.size[2] * V];
    this.bar = new HealthBar(LEG_H + BODY_H + 0.2, spec.name, spec.passive);
    this.burst = new VoxelBurst(this.root, spec.palette.slice(0, 5), LEG_H + BODY_H);
    const part = (group: THREE.Group, geometry: THREE.BufferGeometry, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, look.normal);
      group.add(mesh);
      group.position.set(x, y, z);
      parent.add(group);
      this.meshes.push(mesh);
      return group;
    };
    part(new THREE.Group(), look.geometry.body, this.body, 0, LEG_H, 0);
    part(this.head, look.geometry.head, this.body, 0, LEG_H + BODY_H - spec.headDrop * V, BODY_L / 2 - V);
    part(this.tail, look.geometry.tail, this.body, 0, LEG_H + BODY_H - V, -BODY_L / 2);
    for (const [x, z] of spec.legsAt) {
      this.legs.push(part(new THREE.Group(), look.geometry.leg, this.body, x * V, LEG_H, z * V));
    }
    this.root.add(this.body, this.bar.group);
  }

  update(beast: Enemy, dt: number): void {
    this.time += dt;
    this.root.position.set(beast.x, beast.y, beast.z);
    const dx = Number.isNaN(this.last.x) ? 0 : beast.x - this.last.x;
    const dz = Number.isNaN(this.last.x) ? 0 : beast.z - this.last.y;
    this.last.set(beast.x, beast.z);
    const moved = Math.hypot(dx, dz);
    this.bar.update(beast.hp, beast.maxHp, beast.state !== 'dead', this.heading);

    if (beast.state === 'dead') {
      this.die(beast.deadFor, dt);
      return;
    }
    if (moved > 1e-4) {
      const target = Math.atan2(dx, dz);
      this.heading += Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading)) * Math.min(1, 12 * dt);
      this.phase += moved * STRIDE;
    }
    this.root.rotation.y = this.heading;
    this.body.rotation.x = 0;

    // Trot: diagonal pairs swing together.
    const walking = moved > 1e-4 ? 1 : 0;
    const s = Math.sin(this.phase) * LEG_SWING * walking;
    this.legs[0].rotation.x = s;
    this.legs[3].rotation.x = s;
    this.legs[1].rotation.x = -s;
    this.legs[2].rotation.x = -s;
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.012 * walking;
    this.head.rotation.x = Math.sin(this.phase * 2) * 0.06 * walking;
    const chasing = beast.state === 'chase';
    this.tail.rotation.x = chasing ? 0.3 : -0.35; // up when running at you, low when calm
    this.tail.rotation.y = chasing ? 0 : Math.sin(this.time * 6) * 0.35; // idle wag

    if (beast.swingFor !== null) this.lunge(beast.swingFor / ENEMY_STATS[this.look.spec.kind].swing);
    else this.body.position.z = 0;

    const material = beast.hurtFor > 0 ? this.look.flash : this.look.normal;
    for (const mesh of this.meshes) mesh.material = material;
  }

  // The bite, over its progress p (0..1): crouch and draw back, spring
  // forward with the front legs up and the head snapping down, recover.
  private lunge(p: number): void {
    // From rest to `back` (wind-up), to `forward` (the bite), back to rest.
    const key = (back: number, forward: number) =>
      p < 0.35 ? back * (p / 0.35) : p < 0.6 ? back + (forward - back) * ((p - 0.35) / 0.25) : forward * (1 - (p - 0.6) / 0.4);
    this.body.position.z = key(-0.05, 0.12);
    this.body.rotation.x = key(0.12, -0.2); // rear back, then pitch into the bite
    this.body.position.y = key(-0.02, 0.03);
    this.head.rotation.x = key(-0.35, 0.45); // head up, then snaps down
    this.legs[0].rotation.x = key(0.3, -0.9); // front legs reach
    this.legs[1].rotation.x = key(0.3, -0.9);
    this.legs[2].rotation.x = key(-0.2, 0.5); // back legs push
    this.legs[3].rotation.x = key(-0.2, 0.5);
  }

  // Death: roll onto the side, then burst into voxel pieces.
  private die(t: number, dt: number): void {
    for (const mesh of this.meshes) mesh.material = this.look.normal;
    this.body.rotation.x = 0;
    this.body.position.z = 0;
    const fall = Math.min(1, t / TOPPLE_TIME);
    this.body.rotation.z = (fall * fall * Math.PI) / 2;
    this.body.position.y = -fall * 0.08;
    if (this.burst.play(t, dt)) this.body.visible = false;
  }

  dispose(): void {
    this.root.removeFromParent();
    this.burst.dispose();
  }
}
