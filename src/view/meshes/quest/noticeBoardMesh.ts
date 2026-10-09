// A notice board on each village's square, beside its inn (noticeBoards.ts), instanced and streamed with the world's chunks like the lanterns.

import type { GameModel } from '../../../model/GameModel';
import { ROAD_SURFACE_HEIGHT, TILE_HEIGHT } from '../../../model/constants';
import { noticeBoards } from '../../../model/quests/noticeBoards';
import type { WorldSink } from '../../world/chunkLayer';
import { addPavingPieces } from '../common/pavingPieces';
import { BOARD_GRID, BOARD_PALETTE, QUEST_VOXEL_SIZE, buildNoticeBoard } from './questVoxels';

export function buildNoticeBoards(scene: WorldSink, model: GameModel): void {
  const boards = noticeBoards(model).map((spot, i) => ({
    ...spot,
    y: model.villages[i].groundTier * TILE_HEIGHT + ROAD_SURFACE_HEIGHT, // on the paving
  }));
  addPavingPieces(scene, 'board', boards, BOARD_GRID, BOARD_PALETTE, QUEST_VOXEL_SIZE, buildNoticeBoard);
}
