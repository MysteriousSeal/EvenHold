// The inn and the blacksmith: one voxel model each, lit and instanced as
// every building is (litBuildings.ts), on the village cobbles. (The forges'
// smoke, with every chimney's round the hero: smoke/chimneySmoke.ts.)

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import type { Building, BuildingKind } from '../../../model/types';
import type { VoxelGrid } from '../voxel/greedyMesh';
import type { VoxelPlacement } from '../voxel/voxelInstances';
import { addLitBuildings, meshLit } from './litBuildings';
import { INN_GRID, buildInnVoxels } from './innVoxels';
import { SMITHY_GRID, buildSmithyVoxels } from './smithyVoxels';

type VillageKind = Exclude<BuildingKind, 'cathedral'>; // (the cathedral at the town's own scale: town/cathedralMesh.ts)
const MODELS: Record<VillageKind, { grid: [number, number, number]; build: () => VoxelGrid }> = {
  inn: { grid: INN_GRID, build: buildInnVoxels },
  smithy: { grid: SMITHY_GRID, build: buildSmithyVoxels },
};

export function buildBuildingGeometry(kind: VillageKind, glowing: boolean, grid = MODELS[kind].build()): THREE.BufferGeometry {
  return meshLit(grid, glowing);
}

export function buildBuildings(scene: WorldSink, model: GameModel): void {
  const place = (b: Building): VoxelPlacement => ({ x: b.x, y: model.getGroundY(b.x, b.z), z: b.z, quarterTurns: b.quarterTurns });
  const village = model.buildings.filter((b): b is Building & { kind: VillageKind } => b.kind !== 'cathedral');
  addLitBuildings(scene, village, (b) => b.kind, (b) => MODELS[b.kind].build(), place);
}
