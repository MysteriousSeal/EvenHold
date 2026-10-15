// The squares' stocks (model/roads/stocks.ts), each turned to face the well, instanced and streamed with the
// world's chunks like the benches.
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { squareStocks } from '../../../model/roads/stocks';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { STOCKS_GRID, STOCKS_PALETTE, STOCKS_VOXEL_SIZE, buildStocks } from './stocksVoxels';

export function buildStocksMeshes(scene: WorldSink, model: GameModel): void {
  const origin = new THREE.Vector3((-STOCKS_GRID[0] * STOCKS_VOXEL_SIZE) / 2, 0, (-STOCKS_GRID[2] * STOCKS_VOXEL_SIZE) / 2);
  addVoxelInstances(
    scene,
    squareStocks(model),
    () => 'stocks',
    () => greedyMesh(buildStocks(), STOCKS_PALETTE, STOCKS_VOXEL_SIZE, origin),
    ({ x, y, z, quarterTurns }) => ({ x, y, z, quarterTurns }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
}
