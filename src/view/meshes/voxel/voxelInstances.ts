// Shared instancing for voxel models (trees, bushes, houses, road tiles…):
// items are sorted by map chunk and by which model they use. Each model's
// geometry is built the first time a chunk needs it, and each chunk draws
// one InstancedMesh per model, so only chunks near the hero cost anything
// (see world/chunkLayer.ts).

import * as THREE from 'three';
import { bucketByChunk, type WorldSink } from '../../world/chunkLayer';

export interface VoxelPlacement {
  x: number;
  y: number;
  z: number;
  quarterTurns: number; // rotation about Y in 90-degree steps, keeping voxels on the grid
  tint?: THREE.Color; // optional per-instance color multiplier
}

export function addVoxelInstances<T>(
  sink: WorldSink,
  items: readonly T[],
  modelKey: (item: T) => string,
  buildGeometry: (item: T) => THREE.BufferGeometry, // called once per distinct model, when first needed
  place: (item: T) => VoxelPlacement,
  material: THREE.Material,
): void {
  const placed = items.map((item) => ({ item, key: modelKey(item), at: place(item) }));
  const chunks = bucketByChunk(placed, (p) => p.at);
  const geometries = new Map<string, THREE.BufferGeometry>();

  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);

  sink.layer({
    materials: [material],
    chunkKeys: () => chunks.keys(),
    build(chunkKey) {
      const byModel = new Map<string, typeof placed>();
      for (const p of chunks.get(chunkKey) ?? []) {
        const group = byModel.get(p.key);
        if (group) group.push(p);
        else byModel.set(p.key, [p]);
      }
      return [...byModel].map(([key, group]) => {
        let geometry = geometries.get(key);
        if (!geometry) {
          geometry = buildGeometry(group[0].item);
          geometries.set(key, geometry);
        }
        const mesh = new THREE.InstancedMesh(geometry, material, group.length);
        group.forEach(({ at }, i) => {
          quaternion.setFromAxisAngle(up, (at.quarterTurns * Math.PI) / 2);
          position.set(at.x, at.y, at.z);
          matrix.compose(position, quaternion, scale);
          mesh.setMatrixAt(i, matrix);
          if (at.tint) mesh.setColorAt(i, at.tint);
        });
        return mesh;
      });
    },
  });
}
