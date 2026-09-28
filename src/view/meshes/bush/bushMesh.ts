// Voxel bushes: each (kind, shape) model is voxelized and greedy-meshed
// once, then instanced per map chunk (see chunks.ts), so only bushes near
// the camera are drawn. Rotated in quarter turns only, so voxels
// stay aligned with the tile grid.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { Bush, BushKind } from '../../../model/types';
import { TILE_HEIGHT } from '../../../model/constants';
import { greedyMesh } from '../voxel/greedyMesh';
import { BUSH_GRID, BUSH_PALETTE, BUSH_VOXEL_SIZE, buildBushVoxels } from './bushVoxels';
import { groupByChunk } from '../chunks';

const SINK = 0.01; // bottom slightly below the tile top, so no gap shows at the base

export function buildBushGeometry(kind: BushKind, shape: number): THREE.BufferGeometry {
  const [sx, , sz] = BUSH_GRID;
  // Centered on the tile in X/Z, standing on the ground in Y.
  const origin = new THREE.Vector3((-sx * BUSH_VOXEL_SIZE) / 2, -SINK, (-sz * BUSH_VOXEL_SIZE) / 2);
  return greedyMesh(buildBushVoxels(kind, shape), BUSH_PALETTE, BUSH_VOXEL_SIZE, origin);
}

export function buildBushes(scene: THREE.Scene, model: GameModel): void {
  const groups = new Map<string, Bush[]>();
  for (const bush of model.bushes) {
    const key = `${bush.kind}:${bush.shape}`;
    groups.set(key, [...(groups.get(key) ?? []), bush]);
  }

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3(1, 1, 1);

  for (const bushes of groups.values()) {
    const { kind, shape } = bushes[0];
    const geometry = buildBushGeometry(kind, shape);
    for (const chunk of groupByChunk(bushes)) {
      const mesh = new THREE.InstancedMesh(geometry, material, chunk.length);
      chunk.forEach((bush, i) => {
        quaternion.setFromAxisAngle(up, (bush.quarterTurns * Math.PI) / 2);
        position.set(bush.x, bush.groundTier * TILE_HEIGHT, bush.z);
        matrix.compose(position, quaternion, scale);
        mesh.setMatrixAt(i, matrix);
      });
      scene.add(mesh);
    }
  }
}
