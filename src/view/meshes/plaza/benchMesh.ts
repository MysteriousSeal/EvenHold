// The squares' benches (worldgen/benches.ts), each turned to face the well,
// instanced and streamed with the world's chunks like the lamp posts.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { squareBenches } from '../../../model/worldgen/benches';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { BENCH_GRID, BENCH_PALETTE, BENCH_VOXEL_SIZE, buildBench } from './benchVoxels';

export function buildBenches(scene: WorldSink, model: GameModel): void {
  const origin = new THREE.Vector3((-BENCH_GRID[0] * BENCH_VOXEL_SIZE) / 2, 0, (-BENCH_GRID[2] * BENCH_VOXEL_SIZE) / 2);
  addVoxelInstances(
    scene,
    squareBenches(model),
    () => 'bench',
    () => greedyMesh(buildBench(), BENCH_PALETTE, BENCH_VOXEL_SIZE, origin),
    ({ x, y, z, quarterTurns }) => ({ x, y, z, quarterTurns }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  );
}
