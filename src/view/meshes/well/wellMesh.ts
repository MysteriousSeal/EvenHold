// Village wells: one voxel model (wellVoxels.ts), meshed twice from the
// same grid like the houses: everything but the lantern glass with a plain
// material, the glass with a glowing one. Instanced per map chunk, standing
// on the village cobbles, not the grass under them.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { HOUSE_WINDOW_GLOW, WINDOW_GLOW_INTENSITY } from '../../constants';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { WELL_GLOWING, WELL_GRID, WELL_PALETTE, WELL_VOXEL_SIZE, buildWellVoxels } from './wellVoxels';

const ORIGIN = new THREE.Vector3((-WELL_GRID[0] * WELL_VOXEL_SIZE) / 2, 0, (-WELL_GRID[2] * WELL_VOXEL_SIZE) / 2);

export function buildWellGeometry(glowing: boolean): THREE.BufferGeometry {
  return greedyMesh(buildWellVoxels(), WELL_PALETTE, WELL_VOXEL_SIZE, ORIGIN, (c) => WELL_GLOWING.has(c) === glowing);
}

export function buildWells(scene: THREE.Scene, model: GameModel): void {
  const place = (v: { x: number; z: number }) => ({ x: v.x, y: model.getGroundY(v.x, v.z), z: v.z, quarterTurns: 0 });
  addVoxelInstances(scene, model.villages, () => 'well', () => buildWellGeometry(false), place, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  addVoxelInstances(
    scene,
    model.villages,
    () => 'well-glow',
    () => buildWellGeometry(true),
    place,
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: WINDOW_GLOW_INTENSITY, roughness: 0.5 }),
  );
}
