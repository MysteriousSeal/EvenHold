// Hair growing out of a head, a beard coming in (or either going: the same, back), in a change played full screen
// (swapStaging.ts): its voxels (a cloud of them, set from the joint it rides on: partMorph.ts `rides`), each swelling
// out of nothing in its turn. Hair: from the crown out and down, strand by strand (each column of it a little before
// or after its neighbours); a beard: here and there first, as stubble, then filled in.
import * as THREE from 'three';
import { PERSON_GLOW } from '../meshes/human/humanParts';
import type { Cloud } from './voxelMorph';

const SPAN = 0.3; // of the whole, each voxel's swelling

const smooth = (t: number) => t * t * (3 - 2 * t);
const own = (a: number, b: number) => {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Each voxel's turn (0 the first, 1 the last). Hair: by how far from `crown` it is, each strand in its own time.
export function strands(cloud: Cloud, crown: THREE.Vector3): number[] {
  const far = Math.max(1e-6, ...cloud.at.map((at) => at.distanceTo(crown)));
  return cloud.at.map((at) => Math.min(1, (0.7 * at.distanceTo(crown)) / far + 0.3 * own(Math.round(at.x / cloud.size), Math.round(at.z / cloud.size))));
}
// A beard: no order to it.
export const stubble = (cloud: Cloud): number[] => cloud.at.map((_, i) => own(i, 7));

export class Growth {
  readonly mesh: THREE.InstancedMesh;
  private readonly matrix = new THREE.Matrix4();
  private readonly scale = new THREE.Vector3();
  private readonly still = new THREE.Quaternion();

  constructor(
    private readonly cloud: Cloud,
    private readonly order: number[],
  ) {
    // (Over the skin it lies on, where it's on the head's own voxels.)
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85, emissive: PERSON_GLOW, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -8 }), Math.max(1, cloud.at.length));
    this.mesh.count = cloud.at.length;
    this.mesh.frustumCulled = false;
    for (const [i, color] of cloud.color.entries()) this.mesh.setColorAt(i, color);
    this.update(0);
  }

  // `k`: 0 none of it, 1 all.
  update(k: number): void {
    for (const [i, at] of this.cloud.at.entries()) {
      const e = smooth(Math.max(0, Math.min(1, (k - this.order[i] * (1 - SPAN)) / SPAN)));
      this.scale.setScalar(Math.max(1e-5, this.cloud.size * e));
      this.mesh.setMatrixAt(i, this.matrix.compose(at, this.still, this.scale));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
