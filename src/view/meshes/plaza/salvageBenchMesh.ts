// A salvage bench on each village's square (worldgen/salvageBenches.ts), instanced and streamed with the world's
// chunks like the notice boards.
import type { GameModel } from '../../../model/GameModel';
import { ROAD_SURFACE_HEIGHT, TILE_HEIGHT } from '../../../model/constants';
import { salvageBenches } from '../../../model/worldgen/salvageBenches';
import type { WorldSink } from '../../world/chunkLayer';
import { addPavingPieces } from '../common/pavingPieces';
import { SALVAGE_GRID, SALVAGE_PALETTE, SALVAGE_VOXEL_SIZE, buildSalvageBench } from './salvageBenchVoxels';

export function buildSalvageBenches(scene: WorldSink, model: GameModel): void {
  const benches = salvageBenches(model).map((bench) => ({ ...bench, y: bench.village.groundTier * TILE_HEIGHT + ROAD_SURFACE_HEIGHT })); // on the paving
  addPavingPieces(scene, 'salvageBench', benches, SALVAGE_GRID, SALVAGE_PALETTE, SALVAGE_VOXEL_SIZE, buildSalvageBench);
}
