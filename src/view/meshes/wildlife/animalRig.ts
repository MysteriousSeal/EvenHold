// What every animal's rig shares (catRig, deerRig, duckRig): its parts meshed
// round their pivots, four legs set out in pairs, and, each frame, turning
// smoothly toward the model's heading (the short way round), settling onto
// its height, and how far it went.

import * as THREE from 'three';
import type { Wildlife } from '../../../model/wildlife/wildlife';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';

// Meshes a part at voxel size `v`, round its pivot (in voxels).
export const partMesher = (v: number) => (grid: VoxelGrid, palette: number[], pivot: [number, number, number]) =>
  greedyMesh(grid, palette, v, new THREE.Vector3(-pivot[0] * v, -pivot[1] * v, -pivot[2] * v));

export type Leg = { group: THREE.Group; front: boolean; left: boolean };

export abstract class AnimalRig {
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

  // Ticks its clock, turns it at `turnRate` and settles it onto the ground
  // (at `yEase`, else at once); returns how far it went since last frame.
  protected follow(animal: Wildlife, dt: number, turnRate: number, yEase?: number): number {
    this.time += dt;
    const moved = Number.isNaN(this.last.x) ? 0 : Math.hypot(animal.x - this.last.x, animal.z - this.last.z);
    this.last.x = animal.x;
    this.last.z = animal.z;
    if (this.heading === null) this.heading = animal.heading;
    this.heading += Math.atan2(Math.sin(animal.heading - this.heading), Math.cos(animal.heading - this.heading)) * Math.min(1, turnRate * dt);
    this.y = this.y === null || yEase === undefined ? animal.y : this.y + (animal.y - this.y) * Math.min(1, yEase * dt);
    this.root.position.set(animal.x, this.y, animal.z);
    this.root.rotation.y = this.heading;
    return moved;
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
