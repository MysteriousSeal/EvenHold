// Everything the world's land is drawn with, in the order it's built: each a builder of its own (meshes/), handed a
// sink to put its layers in (chunkLayer.ts) and the world (a classic world's whole; a streamed world's one region at a
// time: worldRegions.ts), some handing back an animation run each frame (grass swaying, water rippling).

import type { GameModel } from '../../model/GameModel';
import type { WorldSink } from './chunkLayer';
import { buildTerrain } from '../meshes/terrain/terrainMesh';
import { buildTrees } from '../meshes/tree/treeMesh';
import { buildHouses } from '../meshes/building/houseMesh';
import { buildBuildings } from '../meshes/building/buildingMesh';
import { buildWells } from '../meshes/well/wellMesh';
import { buildRoads } from '../meshes/road/roadMesh';
import { buildPlazas } from '../meshes/plaza/plazaMesh';
import { buildLanterns } from '../meshes/plaza/lanternMesh';
import { buildBenches } from '../meshes/plaza/benchMesh';
import { buildNoticeBoards } from '../meshes/quest/noticeBoardMesh';
import { buildSalvageBenches } from '../meshes/plaza/salvageBenchMesh';
import { buildFields } from '../meshes/field/fieldMesh';
import { buildGroundCover } from '../meshes/cover/groundCoverMesh';
import { buildBushes } from '../meshes/bush/bushMesh';
import { buildWater } from '../meshes/water/waterMesh';
import { buildScenery3d } from '../meshes/scenery/sceneryMesh';
import { buildCamps } from '../meshes/camp/campMesh';
import { buildRuins } from '../meshes/ruin/ruinMesh';
import { buildCaveMouths } from '../meshes/cave/caveMouthMesh';
import { buildEntranceDressing } from '../meshes/entrance/entranceDressing';

export type Animation = (elapsedSeconds: number) => void;

export interface WorldBuilder {
  label: string; // what the loading screen says while it's built
  build(sink: WorldSink, model: GameModel): Animation | void;
}

export const WORLD_BUILDERS: readonly WorldBuilder[] = [
  { label: 'Laying the ground', build: buildTerrain },
  { label: 'Filling the lakes', build: buildWater },
  { label: 'Treading the roads', build: buildRoads },
  { label: 'Paving the squares', build: buildPlazas },
  { label: 'Sowing the fields', build: buildFields },
  { label: 'Growing the meadows', build: buildGroundCover },
  { label: 'Planting the forests', build: buildTrees },
  { label: 'Tending the bushes', build: buildBushes },
  { label: 'Building the houses', build: buildHouses },
  { label: 'Raising the inn and the forge', build: buildBuildings },
  { label: 'Digging the wells', build: buildWells },
  { label: 'Lighting the lanterns', build: buildLanterns },
  { label: 'Pinning up the notices', build: buildNoticeBoards },
  { label: 'Setting out the benches', build: buildBenches },
  { label: 'Setting up the salvage benches', build: buildSalvageBenches },
  { label: 'Kindling the campfires', build: buildCamps },
  { label: 'Crumbling the old ruins', build: buildRuins },
  { label: 'Hollowing the hills', build: buildCaveMouths },
  { label: 'Lighting the old braziers', build: buildEntranceDressing },
  { label: 'Setting the old stones', build: buildScenery3d },
];
