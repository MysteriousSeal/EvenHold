// The ruins (model/ruins/ruins.ts, voxels: ruinVoxels.ts) and their crypts' ways down: every piece of
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
import { SINK, STAIRS_GRID, buildCryptStairs } from './cryptStairsVoxels';

const ORIGIN = new THREE.Vector3((-RUIN_GRID[0] * RUIN_VOXEL_SIZE) / 2, 0, (-RUIN_GRID[2] * RUIN_VOXEL_SIZE) / 2);
const STAIRS_ORIGIN = new THREE.Vector3((-STAIRS_GRID[0] * RUIN_VOXEL_SIZE) / 2, 0, (-STAIRS_GRID[2] * RUIN_VOXEL_SIZE) / 2);

export function buildRuins(scene: WorldSink, model: GameModel): void {
  const pieces: RuinPiece[] = model.ruins.flatMap((ruin) => ruin.pieces);
  addVoxelInstances(
    scene,
    pieces,
    (p) => `${p.kind}:${p.variant}`,
    (p) => greedyMesh(buildRuinPiece(p.kind, p.variant), RUIN_PALETTE, RUIN_VOXEL_SIZE, ORIGIN),
    (p) => ({ x: p.x, y: model.tiles.height(p.x, p.z) * TILE_HEIGHT, z: p.z, quarterTurns: p.quarterTurns }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
  // And in each, a crypt's way down (model/crypts/crypts.ts: two tiles wide, drawn between them), turned to open toward the spot before it.
  addVoxelInstances(
    scene,
    model.crypts,
    (c) => `cryptStairs:${(c.stairs.x + c.stairs.z) % 4}`,
    (c) => greedyMesh(buildCryptStairs((c.stairs.x + c.stairs.z) % 4), RUIN_PALETTE, RUIN_VOXEL_SIZE, STAIRS_ORIGIN),
    (c) => ({ x: c.middle.x, y: model.tiles.height(c.stairs.x, c.stairs.z) * TILE_HEIGHT - SINK * RUIN_VOXEL_SIZE, z: c.middle.z, quarterTurns: c.quarterTurns }), // (its ground level at the ground's: its stairs going down below)
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
}
