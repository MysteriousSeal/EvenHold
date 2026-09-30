// The ruins (model/ruins/ruins.ts, voxels: ruinVoxels.ts): every piece of
// every ruin on its tile, standing on that tile's ground (a ruin's pieces
// step with the ground under them), turned as it faces; each kind and
// variant meshed once, streamed with the chunks.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import type { RuinPiece } from '../../../model/ruins/ruins';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { RUIN_GRID, RUIN_PALETTE, RUIN_VOXEL_SIZE, buildRuinPiece } from './ruinVoxels';

const ORIGIN = new THREE.Vector3((-RUIN_GRID[0] * RUIN_VOXEL_SIZE) / 2, 0, (-RUIN_GRID[2] * RUIN_VOXEL_SIZE) / 2);

export function buildRuins(scene: WorldSink, model: GameModel): void {
  const pieces: RuinPiece[] = model.ruins.flatMap((ruin) => ruin.pieces);
  addVoxelInstances(
    scene,
    pieces,
    (p) => `${p.kind}:${p.variant}`,
    (p) => greedyMesh(buildRuinPiece(p.kind, p.variant), RUIN_PALETTE, RUIN_VOXEL_SIZE, ORIGIN),
    (p) => ({ x: p.x, y: model.heightMap[p.x][p.z] * TILE_HEIGHT, z: p.z, quarterTurns: p.quarterTurns }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
}
