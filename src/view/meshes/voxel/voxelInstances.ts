// Shared instancing for voxel models (trees, bushes, road tiles): items are
// grouped by which model they use, each model's geometry is built once,
// and it's drawn with one InstancedMesh per map chunk so off-screen
// chunks are frustum-culled.

import * as THREE from 'three';
import { groupByChunk } from '../common/chunks';

export interface VoxelPlacement {
  x: number;
  y: number;
  z: number;
  quarterTurns: number; // rotation about Y in 90-degree steps, keeping voxels on the grid
  tint?: THREE.Color; // optional per-instance color multiplier
}

export function addVoxelInstances<T>(
  scene: THREE.Scene,
  items: readonly T[],
  modelKey: (item: T) => string,
  buildGeometry: (item: T) => THREE.BufferGeometry, // called once per distinct model
  place: (item: T) => VoxelPlacement,
  material: THREE.Material,
): void {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = modelKey(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);

  for (const group of groups.values()) {
    const geometry = buildGeometry(group[0]);
    for (const chunk of groupByChunk(group.map(place))) {
      const mesh = new THREE.InstancedMesh(geometry, material, chunk.length);
      chunk.forEach((p, i) => {
        quaternion.setFromAxisAngle(up, (p.quarterTurns * Math.PI) / 2);
        position.set(p.x, p.y, p.z);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(i, matrix);
        if (p.tint) mesh.setColorAt(i, p.tint);
      });
      scene.add(mesh);
    }
  }
}
