// A chunk's models (its trees) drawn at half their detail far from the hero, at a lower graphics quality
// (voxelInstances.ts' detail.far): its instanced mesh split in two, those near drawn as ever, those far by a second
// mesh of the simpler model (a child of the first: built, dropped and let go with it). Each item keeps whatever was
// done to it (a tree felled, gone; one shaken) as it moves from one to the other, and whoever placed it is told where
// it went.

import * as THREE from 'three';

export class FarInstances<T> {
  private farMesh: THREE.InstancedMesh | null = null;
  private readonly isFar: boolean[]; // each item's, as split now
  private readonly at: number[]; // each item's instance, in its mesh now
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();

  constructor(
    private readonly mesh: THREE.InstancedMesh,
    private readonly items: readonly T[],
    private readonly spots: ReadonlyArray<{ x: number; z: number }>, // each item's, on the ground
    private readonly farGeometry: () => THREE.BufferGeometry,
    private readonly placed?: (item: T, mesh: THREE.InstancedMesh, index: number) => void,
  ) {
    this.isFar = items.map(() => false);
    this.at = items.map((_, i) => i);
  }

  // Those more than `reach` tiles from (x, z) drawn simpler (Infinity: all as ever).
  fit(x: number, z: number, reach: number): void {
    const wanted = this.spots.map((s) => Math.hypot(s.x - x, s.z - z) > reach);
    if (wanted.every((w, i) => w === this.isFar[i])) return;
    const far = (this.farMesh ??= this.makeFar());
    // Each item's matrix and colour as they are now, wherever it's drawn.
    const now = this.items.map((_, i) => {
      const from = this.isFar[i] ? far : this.mesh;
      from.getMatrixAt(this.at[i], this.matrix);
      const color = from.instanceColor ? (from.getColorAt(this.at[i], this.color), this.color.clone()) : null;
      return { matrix: this.matrix.clone(), color };
    });
    const counts = [0, 0];
    this.items.forEach((item, i) => {
      const into = wanted[i] ? far : this.mesh;
      const index = counts[wanted[i] ? 1 : 0]++;
      into.setMatrixAt(index, now[i].matrix);
      if (now[i].color) into.setColorAt(index, now[i].color);
      this.isFar[i] = wanted[i];
      this.at[i] = index;
      this.placed?.(item, into, index);
    });
    for (const [m, count] of [[this.mesh, counts[0]], [far, counts[1]]] as const) {
      m.count = count;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      m.boundingSphere = null; // (worked out again, for those it draws now)
    }
  }

  private makeFar(): THREE.InstancedMesh {
    const far = new THREE.InstancedMesh(this.farGeometry(), this.mesh.material, this.items.length);
    far.count = 0;
    this.mesh.add(far);
    return far;
  }
}
