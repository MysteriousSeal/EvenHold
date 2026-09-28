// The hero: voxel body parts (heroVoxels.ts) on a simple rig of joints, so
// each part swings on its own pivot. Armor goes on later by adding a piece
// to a slot: whatever is attached to a slot moves with that part.
//
//   root (at the hero's feet, turned to face where they walk)
//   └ body (bobs while walking, breathes while idle)
//     ├ torso            hips at the pivot
//     ├ head             neck at the pivot
//     ├ leftArm/rightArm shoulders at the pivots, arms hang down
//     └ leftLeg/rightLeg hips at the pivots, legs hang down
//
// Walking is driven by distance actually moved, so the stride matches any
// speed (including the dev speed boost) and stops the moment the hero does.

import * as THREE from 'three';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { ARM_GRID, HEAD_GRID, HERO_PALETTE, HERO_VOXEL_SIZE, LEG_GRID, TORSO_GRID, buildArm, buildHead, buildLeg, buildTorso } from './heroVoxels';

const V = HERO_VOXEL_SIZE;
const HIP_Y = LEG_GRID[1] * V;
const NECK_Y = HIP_Y + TORSO_GRID[1] * V;
const SHOULDER_Y = NECK_Y - 0.5 * V;
const STRIDE = 4.5; // walk-cycle radians per world unit walked: ~3 cycles a second at walking speed
const LEG_SWING = 0.7; // radians at full stride: long, loping steps
const ARM_SWING = 0.55;
const BOB = 0.012; // body rise at each step, world units
const TURN_RATE = 14; // how fast the hero turns toward where they're walking (per second)

export type HeroSlot = 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

// Meshes a part so that `pivot` (in voxels, within its grid) sits at the
// part's local origin: the joint it swings around.
function part(grid: VoxelGrid, pivot: [number, number, number], material: THREE.Material): THREE.Mesh {
  const origin = new THREE.Vector3(-pivot[0] * V, -pivot[1] * V, -pivot[2] * V);
  return new THREE.Mesh(greedyMesh(grid, HERO_PALETTE, V, origin), material);
}

export class HeroRig {
  readonly root = new THREE.Group();
  readonly slots: Record<HeroSlot, THREE.Group>;
  private readonly body = new THREE.Group();
  private readonly last = new THREE.Vector3(Number.NaN, 0, 0);
  private phase = 0;
  private swing = 0; // 0 standing .. 1 full stride, eased
  private heading = 0;
  private time = 0;

  constructor() {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const joint = (x: number, y: number, z: number, mesh: THREE.Mesh) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.add(mesh);
      this.body.add(group);
      return group;
    };
    const legPivot: [number, number, number] = [1.5, LEG_GRID[1], 1.5];
    const armPivot: [number, number, number] = [1, ARM_GRID[1], 1];
    this.slots = {
      torso: joint(0, HIP_Y, 0, part(buildTorso(), [TORSO_GRID[0] / 2, 0, TORSO_GRID[2] / 2], material)),
      head: joint(0, NECK_Y, 0, part(buildHead(), [HEAD_GRID[0] / 2, 0, HEAD_GRID[2] / 2], material)),
      leftArm: joint(-4.5 * V, SHOULDER_Y, 0, part(buildArm(), armPivot, material)),
      rightArm: joint(4.5 * V, SHOULDER_Y, 0, part(buildArm(), armPivot, material)),
      leftLeg: joint(-2 * V, HIP_Y, 0, part(buildLeg(), legPivot, material)),
      rightLeg: joint(2 * V, HIP_Y, 0, part(buildLeg(), legPivot, material)),
    };
    this.root.add(this.body);
  }

  // Places the hero at (x, y, z) and animates from how far they moved
  // since last frame: facing, walk cycle, bob, or idle breathing.
  update(x: number, y: number, z: number, dt: number): void {
    this.time += dt;
    const dx = Number.isNaN(this.last.x) ? 0 : x - this.last.x;
    const dz = Number.isNaN(this.last.x) ? 0 : z - this.last.z;
    this.last.set(x, y, z);
    this.root.position.set(x, y, z);

    const moved = Math.hypot(dx, dz);
    const walking = moved > 1e-4;
    if (walking) {
      // Turn toward the direction of travel along the shortest way round.
      const target = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(target - this.heading), Math.cos(target - this.heading));
      this.heading += diff * Math.min(1, TURN_RATE * dt);
      this.phase += moved * STRIDE;
    }
    this.root.rotation.y = this.heading;
    this.swing += ((walking ? 1 : 0) - this.swing) * Math.min(1, 12 * dt);

    const s = Math.sin(this.phase) * this.swing;
    this.slots.leftLeg.rotation.x = s * LEG_SWING;
    this.slots.rightLeg.rotation.x = -s * LEG_SWING;
    this.slots.leftArm.rotation.x = -s * ARM_SWING;
    this.slots.rightArm.rotation.x = s * ARM_SWING;
    // A rise at each footfall while walking; a slow breath while idle.
    const breath = Math.sin(this.time * 2.2) * 0.004 * (1 - this.swing);
    this.body.position.y = Math.abs(Math.sin(this.phase)) * BOB * this.swing + breath;
    this.slots.head.rotation.x = breath * 4; // the head nods slightly with it
  }
}
