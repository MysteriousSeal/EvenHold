// What someone wears, off them as vapour (swapStaging.ts), piece by piece: each piece's voxels (read off it:
// voxelMorph.ts sampleFigure) unravelling in the piece's turn from its edges in, each lifting off in a thread,
// drifting, thinning to nothing.
import * as THREE from 'three';
import { HUMAN_VOXEL_SIZE } from '../../meshes/human/bodyVoxels';
import { PERSON_GLOW } from '../../meshes/human/humanParts';
import { smooth } from '../easing';
import type { Cloud } from './voxelMorph';

const DRIFT = HUMAN_VOXEL_SIZE; // what a thread of it's carried by: so far whatever its cubes' size
const OVERLAP = 0.35; // of a piece's turn, the next begun before it's done
const THREAD = 0.4; // of a piece's turn, each voxel's own going


export class Vapour {
  readonly mesh: THREE.InstancedMesh;
  private readonly cloud: Cloud;
  private readonly when: Array<[from: number, long: number]> = []; // each voxel's going, of the whole
  private readonly matrix = new THREE.Matrix4();
  private readonly spot = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly still = new THREE.Quaternion();
  readonly turns: Array<[from: number, to: number]> = []; // each piece's, of the whole

  // `pieces`: in the order they come off.
  constructor(pieces: readonly Cloud[]) {
    const worn = pieces.filter((piece) => piece.at.length > 0);
    this.cloud = { at: worn.flatMap((p) => p.at), color: worn.flatMap((p) => p.color), size: worn[0]?.size ?? DRIFT };
    const long = 1 / (1 + (worn.length - 1) * (1 - OVERLAP)); // (each piece's turn, of the whole)
    for (const [n, piece] of worn.entries()) {
      // From its edges in: the farthest from its middle first.
      const from = n * long * (1 - OVERLAP);
      this.turns.push([from, from + long]);
      const middle = new THREE.Box3().setFromPoints(piece.at).getCenter(new THREE.Vector3());
      const far = Math.max(1e-6, ...piece.at.map((at) => at.distanceTo(middle)));
      for (const at of piece.at) this.when.push([from + (1 - at.distanceTo(middle) / far) * long * (1 - THREAD), long * THREAD]);
    }
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: 0.85, emissive: PERSON_GLOW, polygonOffset: true, polygonOffsetFactor: 0, polygonOffsetUnits: -8 }), Math.max(1, this.cloud.at.length)); // (lit as what they wear is; over their skin, where it lies on it)
    this.mesh.frustumCulled = false;
    this.mesh.count = this.cloud.at.length; // (someone with nothing on: nothing of it drawn)
    for (const [k, color] of this.cloud.color.entries()) this.mesh.setColorAt(k, color);
    this.update(0, 0);
  }

  // `k`: 0 worn still, 1 gone.
  update(k: number, time: number): void {
    const { cloud, mesh } = this;
    for (const [i, at] of cloud.at.entries()) {
      const [from, long] = this.when[i];
      const e = smooth(Math.max(0, Math.min(1, (k - from) / long)));
      const sway = Math.sin(i * 12.9898) * 43758.5453;
      const own = sway - Math.floor(sway);
      this.spot.set(at.x + Math.sin(time * 3 + i) * DRIFT * 2 * e + (own - 0.5) * DRIFT * 6 * e, at.y + e * e * DRIFT * (10 + own * 14), at.z + Math.cos(time * 2.3 + i * 1.7) * DRIFT * 2 * e);
      this.scale.setScalar(Math.max(1e-5, cloud.size * (1 - e)));
      mesh.setMatrixAt(i, this.matrix.compose(this.spot, this.still, this.scale));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
