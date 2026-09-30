// The inn and the blacksmith: one voxel model each, lit and instanced as
// every building is (litBuildings.ts), on the village cobbles. Each forge
// chimney puffs voxel smoke (smoke.ts).

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import type { Building, BuildingKind } from '../../../model/types';
import type { VoxelGrid } from '../voxel/greedyMesh';
import type { VoxelPlacement } from '../voxel/voxelInstances';
import { addLitBuildings, meshLit, originOf } from './litBuildings';
import { HOUSE_VOXEL_SIZE } from './houseVoxels';
import { INN_GRID, buildInnVoxels } from './innVoxels';
import { SMITHY_GRID, SMITHY_SMOKE_ORIGIN, buildSmithyVoxels } from './smithyVoxels';
import { addChimneySmoke } from './smoke';

const MODELS: Record<BuildingKind, { grid: [number, number, number]; build: () => VoxelGrid }> = {
  inn: { grid: INN_GRID, build: buildInnVoxels },
  smithy: { grid: SMITHY_GRID, build: buildSmithyVoxels },
};

export function buildBuildingGeometry(kind: BuildingKind, glowing: boolean, grid = MODELS[kind].build()): THREE.BufferGeometry {
  return meshLit(grid, glowing);
}

// Returns the per-frame smoke animation.
export function buildBuildings(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  const place = (b: Building): VoxelPlacement => ({ x: b.x, y: model.getGroundY(b.x, b.z), z: b.z, quarterTurns: b.quarterTurns });
  addLitBuildings(scene, model.buildings, (b) => b.kind, (b) => MODELS[b.kind].build(), place);

  // Chimney tops in world space: the model's smoke origin, turned with the building.
  const [cx, cy, cz] = SMITHY_SMOKE_ORIGIN;
  const local = new THREE.Vector3(cx + 0.5, cy + 1, cz + 0.5).multiplyScalar(HOUSE_VOXEL_SIZE).add(originOf(SMITHY_GRID));
  const chimneys = model.buildings
    .filter((b) => b.kind === 'smithy')
    .map((b) => {
      const p = local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (b.quarterTurns * Math.PI) / 2);
      return p.add(new THREE.Vector3(b.x, model.getGroundY(b.x, b.z), b.z));
    });
  return addChimneySmoke(scene, chimneys);
}
