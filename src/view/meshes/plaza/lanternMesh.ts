// Lamp posts on each square's four corners (see lanternVoxels.ts), their
// lanterns shining on all sides, meshed twice like the well: plain, and
// glowing glass that catches the bloom. Streamed with the world's chunks.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { ROAD_SURFACE_HEIGHT, TILE_HEIGHT } from '../../../model/constants';
import { squareLanterns } from '../../../model/worldgen/villages';
import { HOUSE_WINDOW_GLOW, WINDOW_GLOW_INTENSITY } from '../../constants';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { LANTERN_GLOWING, LANTERN_GRID, LANTERN_PALETTE, LANTERN_VOXEL_SIZE, buildLanternPost } from './lanternVoxels';

const ORIGIN = new THREE.Vector3((-LANTERN_GRID[0] * LANTERN_VOXEL_SIZE) / 2, 0, (-LANTERN_GRID[2] * LANTERN_VOXEL_SIZE) / 2);

export function buildLanternGeometry(glowing: boolean): THREE.BufferGeometry {
  return greedyMesh(buildLanternPost(), LANTERN_PALETTE, LANTERN_VOXEL_SIZE, ORIGIN, (c) => LANTERN_GLOWING.has(c) === glowing);
}

export function buildLanterns(scene: WorldSink, model: GameModel): void {
  const posts = model.villages.flatMap((village) =>
    squareLanterns(village).map(([x, z]) => ({
      x,
      z,
      y: village.groundTier * TILE_HEIGHT + ROAD_SURFACE_HEIGHT, // on the paving
      quarterTurns: 0, // symmetric: glass on every side
    })),
  );
  const place = (p: (typeof posts)[number]) => p;
  addVoxelInstances(scene, posts, () => 'post', () => buildLanternGeometry(false), place, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
  addVoxelInstances(
    scene,
    posts,
    () => 'glow',
    () => buildLanternGeometry(true),
    place,
    new THREE.MeshStandardMaterial({ vertexColors: true, emissive: HOUSE_WINDOW_GLOW, emissiveIntensity: WINDOW_GLOW_INTENSITY, roughness: 0.5 }),
  );
}
