// A notice board on each village's square, beside its inn (noticeBoards.ts), instanced and streamed with the world's chunks like the lanterns.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { ROAD_SURFACE_HEIGHT, TILE_HEIGHT } from '../../../model/constants';
import { noticeBoards } from '../../../model/quests/noticeBoards';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { BOARD_GRID, BOARD_PALETTE, QUEST_VOXEL_SIZE, buildNoticeBoard } from './questVoxels';

export function buildNoticeBoards(scene: WorldSink, model: GameModel): void {
  const boards = noticeBoards(model).map((spot, i) => ({
    ...spot,
    y: model.villages[i].groundTier * TILE_HEIGHT + ROAD_SURFACE_HEIGHT, // on the paving
  }));
  const origin = new THREE.Vector3((-BOARD_GRID[0] * QUEST_VOXEL_SIZE) / 2, 0, (-BOARD_GRID[2] * QUEST_VOXEL_SIZE) / 2);
  addVoxelInstances(
    scene,
    boards,
    () => 'board',
    () => greedyMesh(buildNoticeBoard(), BOARD_PALETTE, QUEST_VOXEL_SIZE, origin),
    (b) => b,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  );
}
