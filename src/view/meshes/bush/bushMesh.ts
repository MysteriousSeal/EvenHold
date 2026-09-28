// Voxel bushes: each (kind, shape) model is voxelized and greedy-meshed
// once, then instanced per map chunk, so only bushes near the camera are
// drawn. Rotated in quarter turns only, so voxels stay on the tile grid.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { BushKind } from '../../../model/types';
import { TILE_HEIGHT } from '../../../model/constants';
import { addWindSway } from '../common/wind';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { BUSH_GRID, BUSH_PALETTE, BUSH_VOXEL_SIZE, buildBushVoxels } from './bushVoxels';

const SINK = 0.01; // bottom slightly below the tile top, so no gap shows at the base
// Bushes rustle a little: less than grass, a touch quicker than trees.
const BUSH_WIND = { height: BUSH_GRID[1] * BUSH_VOXEL_SIZE, strength: 0.02, speed: 1.4, flutter: 0.003 };

export function buildBushGeometry(kind: BushKind, shape: number): THREE.BufferGeometry {
  const [sx, , sz] = BUSH_GRID;
  // Centered on the tile in X/Z, standing on the ground in Y.
  const origin = new THREE.Vector3((-sx * BUSH_VOXEL_SIZE) / 2, -SINK, (-sz * BUSH_VOXEL_SIZE) / 2);
  return greedyMesh(buildBushVoxels(kind, shape), BUSH_PALETTE, BUSH_VOXEL_SIZE, origin);
}

// Returns the per-frame wind animation.
export function buildBushes(scene: THREE.Scene, model: GameModel): (elapsedSeconds: number) => void {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const windTime = addWindSway(material, BUSH_WIND);
  addVoxelInstances(
    scene,
    model.bushes,
    (bush) => `${bush.kind}:${bush.shape}`,
    (bush) => buildBushGeometry(bush.kind, bush.shape),
    (bush) => ({ x: bush.x, y: bush.groundTier * TILE_HEIGHT, z: bush.z, quarterTurns: bush.quarterTurns }),
    material,
  );
  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
  };
}
