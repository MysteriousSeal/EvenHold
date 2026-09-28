// Bandit camps (see campVoxels.ts): a campfire on each camp's center tile
// and a tent beside it, meshed plain plus glowing flames, streamed with the
// world's chunks.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { HOUSE_WINDOW_GLOW } from '../../constants';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { CAMP_GLOWING, CAMP_PALETTE, CAMP_VOXEL_SIZE, FIRE_GRID, TENT_GRID, buildCampfire, buildTent } from './campVoxels';

const centered = (grid: [number, number, number]) =>
  new THREE.Vector3((-grid[0] * CAMP_VOXEL_SIZE) / 2, 0, (-grid[2] * CAMP_VOXEL_SIZE) / 2);

export function buildCampGeometry(model: 'fire' | 'tent', glowing: boolean): THREE.BufferGeometry {
  const [grid, size]: [VoxelGrid, [number, number, number]] = model === 'fire' ? [buildCampfire(), FIRE_GRID] : [buildTent(), TENT_GRID];
  return greedyMesh(grid, CAMP_PALETTE, CAMP_VOXEL_SIZE, centered(size), (c) => CAMP_GLOWING.has(c) === glowing);
}

export function buildCamps(scene: WorldSink, model: GameModel): void {
  const pieces = model.camps.flatMap((camp) => [
    { model: 'fire' as const, x: camp.x, z: camp.z, y: model.heightMap[camp.x][camp.z] * TILE_HEIGHT },
    { model: 'tent' as const, x: camp.tentX, z: camp.tentZ, y: model.heightMap[camp.tentX][camp.tentZ] * TILE_HEIGHT },
  ]);
  const place = (p: (typeof pieces)[number]) => ({ x: p.x, y: p.y, z: p.z, quarterTurns: 0 });
  addVoxelInstances(scene, pieces, (p) => p.model, (p) => buildCampGeometry(p.model, false), place, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  addVoxelInstances(
    scene,
    pieces.filter((p) => p.model === 'fire'),
    () => 'flames',
    () => buildCampGeometry('fire', true),
    place,
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: 1.6, roughness: 0.5 }),
  );
}
