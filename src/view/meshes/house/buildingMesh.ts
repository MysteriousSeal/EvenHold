// The inn and the blacksmith: one voxel model each, meshed twice from the
// same grid like the houses (a plain mesh, and a glowing one for window
// glass, lanterns and forge coals), instanced per map chunk. Both stand on
// the village cobbles. Each forge chimney puffs voxel smoke (smoke.ts).

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { Building, BuildingKind } from '../../../model/types';
import { HOUSE_WINDOW_GLOW, WINDOW_GLOW_INTENSITY } from '../../constants';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances, type VoxelPlacement } from '../voxel/voxelInstances';
import { GLOWING, HOUSE_PALETTE } from './housePalette';
import { HOUSE_VOXEL_SIZE } from './houseVoxels';
import { INN_GRID, buildInnVoxels } from './innVoxels';
import { SMITHY_GRID, SMITHY_SMOKE_ORIGIN, buildSmithyVoxels } from './smithyVoxels';
import { addChimneySmoke } from './smoke';

const MODELS: Record<BuildingKind, { grid: [number, number, number]; build: () => VoxelGrid }> = {
  inn: { grid: INN_GRID, build: buildInnVoxels },
  smithy: { grid: SMITHY_GRID, build: buildSmithyVoxels },
};

// Grid centered on the building's center in X/Z, standing on the ground.
function originOf(kind: BuildingKind): THREE.Vector3 {
  const [sx, , sz] = MODELS[kind].grid;
  return new THREE.Vector3((-sx * HOUSE_VOXEL_SIZE) / 2, 0, (-sz * HOUSE_VOXEL_SIZE) / 2);
}

export function buildBuildingGeometry(kind: BuildingKind, glowing: boolean, grid = MODELS[kind].build()): THREE.BufferGeometry {
  return greedyMesh(grid, HOUSE_PALETTE, HOUSE_VOXEL_SIZE, originOf(kind), (color) => GLOWING.has(color) === glowing);
}

// Returns the per-frame smoke animation.
export function buildBuildings(scene: THREE.Scene, model: GameModel): (elapsedSeconds: number) => void {
  const grids = new Map<BuildingKind, VoxelGrid>();
  const gridFor = (kind: BuildingKind) => {
    let grid = grids.get(kind);
    if (!grid) {
      grid = MODELS[kind].build();
      grids.set(kind, grid);
    }
    return grid;
  };
  const place = (b: Building): VoxelPlacement => ({ x: b.x, y: model.getGroundY(b.x, b.z), z: b.z, quarterTurns: b.quarterTurns });

  addVoxelInstances(
    scene,
    model.buildings,
    (b) => b.kind,
    (b) => buildBuildingGeometry(b.kind, false, gridFor(b.kind)),
    place,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
  );
  addVoxelInstances(
    scene,
    model.buildings,
    (b) => b.kind,
    (b) => buildBuildingGeometry(b.kind, true, gridFor(b.kind)),
    place,
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: WINDOW_GLOW_INTENSITY, roughness: 0.5 }),
  );

  // Chimney tops in world space: the model's smoke origin, turned with the building.
  const [cx, cy, cz] = SMITHY_SMOKE_ORIGIN;
  const local = new THREE.Vector3(cx + 0.5, cy + 1, cz + 0.5).multiplyScalar(HOUSE_VOXEL_SIZE).add(originOf('smithy'));
  const chimneys = model.buildings
    .filter((b) => b.kind === 'smithy')
    .map((b) => {
      const p = local.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), (b.quarterTurns * Math.PI) / 2);
      return p.add(new THREE.Vector3(b.x, model.getGroundY(b.x, b.z), b.z));
    });
  return addChimneySmoke(scene, chimneys);
}
