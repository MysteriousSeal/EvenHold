// What every creature's rig shares, wildlife (catRig, deerRig, duckRig) and
// foes alike (beastRig: wolves, boars; ghostRig): its parts meshed round
// their pivots, four legs set out in pairs (if it has legs), and, each frame, turning smoothly
// toward its heading (the model's, or else the way it went), the short way
// round, settling onto its height, and how far it went.

import * as THREE from 'three';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';

// Meshes a part at voxel size `v`, round its pivot (in voxels).
export const partMesher = (v: number) => (grid: VoxelGrid, palette: number[], pivot: [number, number, number]) =>
  greedyMesh(grid, palette, v, new THREE.Vector3(-pivot[0] * v, -pivot[1] * v, -pivot[2] * v));

export type Leg = { group: THREE.Group; front: boolean; left: boolean };

// Where a creature is, and (wildlife) which way the model has it face.
type Walker = { x: number; y: number; z: number; heading?: number };

export abstract class CreatureRig {
  readonly root = new THREE.Group();
  private heading: number | null = null;
  private y: number | null = null;
  private readonly last = { x: Number.NaN, z: 0 };

  // `time`: its own clock, started apart so neighbours don't move in step.
  constructor(protected time: number) {}

  // Four legs of `geometry` hung `height` up, `at` (in world units) its
  // sides and front and back: front before hind, left before right.
  protected addLegs(geometry: THREE.BufferGeometry, material: THREE.Material, at: { side: number; front: number; back: number }, height: number): Leg[] {
    const legs: Leg[] = [];
    for (const front of [true, false]) {
      for (const left of [true, false]) {
        const group = new THREE.Group();
        group.position.set(left ? at.side : -at.side, height, front ? at.front : at.back);
        group.add(new THREE.Mesh(geometry, material));
        this.root.add(group);
        legs.push({ group, front, left });
      }
    }
    return legs;
  }

  // Which way it faces now.
  protected get facing(): number {
    return this.heading ?? 0;
  }

  // Ticks its clock, turns it at `turnRate` (toward its heading, or the way
  // it just went) and settles it onto the ground (at `yEase`, else at once);
  // returns how far it went since last frame.
  protected follow(animal: Walker, dt: number, turnRate: number, yEase?: number): number {
    this.time += dt;
    const [dx, dz] = Number.isNaN(this.last.x) ? [0, 0] : [animal.x - this.last.x, animal.z - this.last.z];
    const moved = Math.hypot(dx, dz);
    this.last.x = animal.x;
    this.last.z = animal.z;
    const toward = animal.heading ?? (moved > 1e-4 ? Math.atan2(dx, dz) : this.facing);
    if (this.heading === null) this.heading = toward;
    this.heading += Math.atan2(Math.sin(toward - this.heading), Math.cos(toward - this.heading)) * Math.min(1, turnRate * dt);
    this.y = this.y === null || yEase === undefined ? animal.y : this.y + (animal.y - this.y) * Math.min(1, yEase * dt);
    this.root.position.set(animal.x, this.y, animal.z);
    this.root.rotation.y = this.heading;
    return moved;
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
