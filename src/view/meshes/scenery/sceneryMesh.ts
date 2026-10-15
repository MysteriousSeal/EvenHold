// The rocks and landmarks out in the wilds (model/scenery/scenery.ts), drawn
// in voxels (sceneryVoxels.ts): each distinct one meshed once, then
// instanced by the world's chunks, centred on its tiles, turned as it lies.
// The willows apart, swaying in the wind as the trees do.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import type { Scenery } from '../../../model/scenery/scenery';
import { TILE_HEIGHT } from '../../../model/constants';
import { addWindSway } from '../common/wind';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { SCENERY_PALETTE, SCENERY_VOXEL, buildScenery, sceneryGrid } from './sceneryVoxels';

const SINK = 0.02; // set a touch into the ground: no gap under a rounded foot
// A willow's fronds sway slow and wide, its trunk hardly at all (as the trees: treeMesh.ts).
const WILLOW_WIND = { height: sceneryGrid('willow')[1] * SCENERY_VOXEL, strength: 0.05, speed: 0.9, flutter: 0.004 };

export function buildScenery3d(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  const add = (pieces: readonly Scenery[], material: THREE.Material) =>
    addVoxelInstances(
      scene,
      pieces,
      (s) => `scenery:${s.kind}:${s.variant}`,
      (s) => {
        const [sx, , sz] = sceneryGrid(s.kind);
        return greedyMesh(buildScenery(s.kind, s.variant), SCENERY_PALETTE, SCENERY_VOXEL, new THREE.Vector3((-sx / 2) * SCENERY_VOXEL, -SINK, (-sz / 2) * SCENERY_VOXEL));
      },
      (s) => ({ x: s.x + (s.w - 1) / 2, y: model.tiles.height(s.x, s.z) * TILE_HEIGHT, z: s.z + (s.d - 1) / 2, quarterTurns: s.quarterTurns }),
      material,
    );
  add(model.scenery.filter((s) => s.kind !== 'willow'), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  const willows = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const windTime = addWindSway(willows, WILLOW_WIND);
  add(model.scenery.filter((s) => s.kind === 'willow'), willows);
  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
  };
}
