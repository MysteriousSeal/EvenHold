// A kind of piece stood on the villages' paving (a notice board, a salvage bench: one voxel model, instanced and
// streamed with the world's chunks like the lanterns), each where and how its placement says.
import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { VoxelGrid } from '../voxel/greedyMesh';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances, type VoxelPlacement } from '../voxel/voxelInstances';

export function addPavingPieces(scene: WorldSink, key: string, placements: readonly VoxelPlacement[], grid: [number, number, number], palette: number[], voxel: number, build: () => VoxelGrid): void {
  const origin = new THREE.Vector3((-grid[0] * voxel) / 2, 0, (-grid[2] * voxel) / 2);
  addVoxelInstances(
    scene,
    placements,
    () => key,
    () => greedyMesh(build(), palette, voxel, origin),
    (p) => p,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  );
}
