// One wolf on screen: voxel parts (wolfVoxels.ts) on joints, animated from
// its model state each frame:
// - trotting legs in diagonal pairs, paced by distance moved, a head bob,
//   a tail that wags when idle and rides high when chasing;
// - an attack: rears back, lunges forward with a snapping head and front
//   legs off the ground, then recovers;
// - a red flash while hurt, and a voxel health bar over its head;
// - on death, it rolls onto its side, then bursts into voxel cubes.

import * as THREE from 'three';
import { ENEMY_CORPSE_TIME, ENEMY_STATS } from '../../../model/constants';
import type { Enemy } from '../../../model/types';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { HealthBar, VoxelBurst } from './enemyParts';
import { BODY_GRID, HEAD_GRID, LEG_GRID, TAIL_GRID, WOLF_PALETTE, WOLF_VOXEL_SIZE, buildBody, buildHead, buildLeg, buildTail } from './wolfVoxels';

const V = WOLF_VOXEL_SIZE;
const LEG_H = LEG_GRID[1] * V;
const BODY_H = BODY_GRID[1] * V;
const BODY_L = BODY_GRID[2] * V;
const STRIDE = 6; // trot-cycle radians per world unit
const LEG_SWING = 0.6;
const TOPPLE_TIME = 0.35; // seconds to fall onto its side
export const BURST_AT = 0.7; // seconds after death when it breaks apart

export interface WolfLook {
  normal: THREE.Material;
  flash: THREE.Material;
  geometry: { body: THREE.BufferGeometry; head: THREE.BufferGeometry; leg: THREE.BufferGeometry; tail: THREE.BufferGeometry };
}

// Materials and meshed parts shared by every wolf on screen.
export function createWolfLook(flash: THREE.Material): WolfLook {
  const mesh = (grid: VoxelGrid, pivot: [number, number, number]) =>
    greedyMesh(grid, WOLF_PALETTE, V, new THREE.Vector3(-pivot[0] * V, -pivot[1] * V, -pivot[2] * V));
  return {
    normal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
    flash,
    geometry: {
      body: mesh(buildBody(), [BODY_GRID[0] / 2, 0, BODY_GRID[2] / 2]),
      head: mesh(buildHead(), [HEAD_GRID[0] / 2, 0, 0]),
      leg: mesh(buildLeg(), [LEG_GRID[0] / 2, LEG_GRID[1], LEG_GRID[2] / 2]),
      tail: mesh(buildTail(), [TAIL_GRID[0] / 2, TAIL_GRID[1] / 2, TAIL_GRID[2]]),
    },
  };
}

export class WolfRig {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly legs: THREE.Group[] = [];
  private readonly meshes: THREE.Mesh[] = [];
  private readonly bar = new HealthBar(ENEMY_STATS.wolf.hp, LEG_H + BODY_H + 0.2);
  private readonly burst = new VoxelBurst(this.root, WOLF_PALETTE.slice(0, 5), LEG_H + BODY_H);
  private readonly last = new THREE.Vector2(Number.NaN, 0);
  private heading = 0;
  private phase = 0;
  private time = 0;

  constructor(private readonly look: WolfLook) {
    const part = (group: THREE.Group, geometry: THREE.BufferGeometry, parent: THREE.Object3D, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, look.normal);
      group.add(mesh);
      group.position.set(x, y, z);
      parent.add(group);
      this.meshes.push(mesh);
      return group;
    };
    part(new THREE.Group(), look.geometry.body, this.body, 0, LEG_H, 0);
    part(this.head, look.geometry.head, this.body, 0, LEG_H + BODY_H - 3 * V, BODY_L / 2 - V);
    part(this.tail, look.geometry.tail, this.body, 0, LEG_H + BODY_H - V, -BODY_L / 2);
    for (const [x, z] of [
      [-2, 5], // front right, front left, back right, back left (its right is -X)
      [2, 5],
      [-2, -5],
      [2, -5],
    ]) {
      this.legs.push(part(new THREE.Group(), look.geometry.leg, this.body, x * V, LEG_H, z * V));
    }
    this.root.add(this.body, this.bar.group);
  }

  update(wolf: Enemy, dt: number): void {
    this.time += dt;
    this.root.position.set(wolf.x, wolf.y, wolf.z);
    const dx = Number.isNaN(this.last.x) ? 0 : wolf.x - this.last.x;
    const dz = Number.isNaN(this.last.x) ? 0 : wolf.z - this.last.y;
    this.last.set(wolf.x, wolf.z);
    const moved = Math.hypot(dx, dz);
    this.bar.update(wolf.hp, wolf.state !== 'dead', this.heading);

    if (wolf.state === 'dead') {
      this.die(wolf.deadFor, dt);
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
    const chasing = wolf.state === 'chase';
    this.tail.rotation.x = chasing ? 0.3 : -0.35; // up when running at you, low when calm
    this.tail.rotation.y = chasing ? 0 : Math.sin(this.time * 6) * 0.35; // idle wag

    if (wolf.swingFor !== null) this.lunge(wolf.swingFor / ENEMY_STATS.wolf.swing);
    else this.body.position.z = 0;

    const material = wolf.hurtFor > 0 ? this.look.flash : this.look.normal;
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
    if (t < BURST_AT) return;
    if (!this.burst.started) {
      this.body.visible = false;
      this.burst.start();
    }
    this.burst.update((t - BURST_AT) / (ENEMY_CORPSE_TIME - BURST_AT), dt);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.burst.dispose();
  }
}
