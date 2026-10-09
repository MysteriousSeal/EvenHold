// A salvage bench on each village's square (worldgen/salvageBenches.ts), instanced and streamed with the world's
// chunks like the notice boards.
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { ROAD_SURFACE_HEIGHT, TILE_HEIGHT } from '../../../model/constants';
import { salvageBenches } from '../../../model/worldgen/salvageBenches';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { SALVAGE_GRID, SALVAGE_PALETTE, SALVAGE_VOXEL_SIZE, buildSalvageBench } from './salvageBenchVoxels';

export function buildSalvageBenches(scene: WorldSink, model: GameModel): void {
  const benches = salvageBenches(model).map((bench) => ({ ...bench, y: bench.village.groundTier * TILE_HEIGHT + ROAD_SURFACE_HEIGHT })); // on the paving
  const origin = new THREE.Vector3((-SALVAGE_GRID[0] * SALVAGE_VOXEL_SIZE) / 2, 0, (-SALVAGE_GRID[2] * SALVAGE_VOXEL_SIZE) / 2);
  addVoxelInstances(
    scene,
    benches,
    () => 'salvageBench',
    () => greedyMesh(buildSalvageBench(), SALVAGE_PALETTE, SALVAGE_VOXEL_SIZE, origin),
    (b) => b,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  );
}
