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

// The blow, keyed over its progress (0..1): the right arm winds up overhead
// and slightly back, strikes forward and down fast, then recovers; the body
// twists into it, dips and leans in at the strike, and the legs brace.
// Arm angles: negative swings the arm forward and up (the hero faces +Z).
type Keys = Array<[number, number]>;
const ATTACK = {
  rightArm: [[0, 0], [0.35, -3.3], [0.52, -0.9], [0.75, -0.7], [1, 0]] as Keys,
  leftArm: [[0, 0], [0.35, -0.4], [0.52, 0.55], [1, 0]] as Keys,
  twist: [[0, 0], [0.35, -0.4], [0.52, 0.35], [1, 0]] as Keys, // body turn about Y: right shoulder back, then through
  dip: [[0, 0], [0.35, 0.01], [0.55, -0.018], [1, 0]] as Keys, // body rise
  lunge: [[0, 0], [0.35, -0.01], [0.55, 0.03], [1, 0]] as Keys, // body shift forward
  frontLeg: [[0, 0], [0.4, -0.35], [0.8, -0.35], [1, 0]] as Keys,
  backLeg: [[0, 0], [0.4, 0.3], [0.8, 0.3], [1, 0]] as Keys,
};

// Smoothly interpolated value of `keys` at `p`.
function key(keys: Keys, p: number): number {
  for (let i = 1; i < keys.length; i++) {
    const [p1, v1] = keys[i];
    if (p <= p1) {
      const [p0, v0] = keys[i - 1];
      const t = (p - p0) / (p1 - p0);
      return v0 + (v1 - v0) * t * t * (3 - 2 * t);
    }
  }
  return keys[keys.length - 1][1];
}

export type HeroSlot = 'head' | 'torso' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg';

// Meshes a part so that `pivot` (in voxels, within its grid) sits at the
// part's local origin: the joint it swings around.
function part(grid: VoxelGrid, palette: number[], pivot: [number, number, number], material: THREE.Material): THREE.Mesh {
  const origin = new THREE.Vector3(-pivot[0] * V, -pivot[1] * V, -pivot[2] * V);
  return new THREE.Mesh(greedyMesh(grid, palette, V, origin), material);
}

// A human body's voxel parts (same grid sizes as the hero's), so the rig
// can wear another outfit: the hero, or a bandit.
export interface HumanParts {
  palette: number[];
  leg(): VoxelGrid;
  torso(): VoxelGrid;
  arm(): VoxelGrid;
  head(): VoxelGrid;
}

export const HERO_PARTS: HumanParts = { palette: HERO_PALETTE, leg: buildLeg, torso: buildTorso, arm: buildArm, head: buildHead };

export class HeroRig {
  readonly root = new THREE.Group();
  readonly slots: Record<HeroSlot, THREE.Group>;
  readonly meshes: THREE.Mesh[] = [];
  private readonly body = new THREE.Group();
  private readonly last = new THREE.Vector3(Number.NaN, 0, 0);
  private phase = 0;
  private swing = 0; // 0 standing .. 1 full stride, eased
  private heading = 0;
  private time = 0;

  constructor(
    parts: HumanParts = HERO_PARTS,
    material: THREE.Material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  ) {
    const { palette } = parts;
    const joint = (x: number, y: number, z: number, mesh: THREE.Mesh) => {
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.add(mesh);
      this.meshes.push(mesh);
      this.body.add(group);
      return group;
    };
    const legPivot: [number, number, number] = [1.5, LEG_GRID[1], 1.5];
    const armPivot: [number, number, number] = [1, ARM_GRID[1], 1];
    this.slots = {
      torso: joint(0, HIP_Y, 0, part(parts.torso(), palette, [TORSO_GRID[0] / 2, 0, TORSO_GRID[2] / 2], material)),
      head: joint(0, NECK_Y, 0, part(parts.head(), palette, [HEAD_GRID[0] / 2, 0, HEAD_GRID[2] / 2], material)),
      // The body faces +Z, so its right side is -X.
      rightArm: joint(-4.5 * V, SHOULDER_Y, 0, part(parts.arm(), palette, armPivot, material)),
      leftArm: joint(4.5 * V, SHOULDER_Y, 0, part(parts.arm(), palette, armPivot, material)),
      rightLeg: joint(-2 * V, HIP_Y, 0, part(parts.leg(), palette, legPivot, material)),
      leftLeg: joint(2 * V, HIP_Y, 0, part(parts.leg(), palette, legPivot, material)),
    };
    this.root.add(this.body);
  }

  // Every body part drawn with `material` (e.g. a hit flash).
  setMaterial(material: THREE.Material): void {
    for (const mesh of this.meshes) mesh.material = material;
  }

  // Falls flat on its back as `progress` goes 0 -> 1 (a death), pivoting at the feet.
  fall(progress: number): void {
    const p = Math.min(1, progress);
    this.body.rotation.set(-(p * p * Math.PI) / 2, 0, 0);
    this.body.position.set(0, 0, 0);
  }

  // Places the hero at (x, y, z) and animates from how far they moved
  // since last frame (facing, walk cycle, bob, or idle breathing) and, while
  // attacking, from how far through the blow they are (0..1).
  update(x: number, y: number, z: number, dt: number, attack: number | null = null): void {
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
    this.body.position.z = 0;
    this.body.rotation.y = 0;
    this.slots.head.rotation.x = breath * 4; // the head nods slightly with it

    if (attack !== null) {
      // Blend in over the first tenth and out over the last fifth, so the
      // blow picks up from (and hands back to) the walk without a snap.
      const w = Math.min(1, attack / 0.1, (1 - attack) / 0.2);
      const mix = (from: number, to: number) => from + (to - from) * w;
      const s = this.slots;
      s.rightArm.rotation.x = mix(s.rightArm.rotation.x, key(ATTACK.rightArm, attack));
      s.leftArm.rotation.x = mix(s.leftArm.rotation.x, key(ATTACK.leftArm, attack));
      s.leftLeg.rotation.x = mix(s.leftLeg.rotation.x, key(ATTACK.frontLeg, attack));
      s.rightLeg.rotation.x = mix(s.rightLeg.rotation.x, key(ATTACK.backLeg, attack));
      this.body.rotation.y = key(ATTACK.twist, attack) * w;
      this.body.position.y += key(ATTACK.dip, attack) * w;
      this.body.position.z = key(ATTACK.lunge, attack) * w;
    }
  }
}
