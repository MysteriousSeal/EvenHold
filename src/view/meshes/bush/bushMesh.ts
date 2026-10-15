// Voxel bushes: each (kind, shape) model is voxelized and greedy-meshed
// once, then instanced per map chunk, so only bushes near the camera are
// drawn. Rotated in quarter turns only, so voxels stay on the tile grid.
// Drawn as their country has them (model/scenery/biomes.ts): on the heath a
// leafy bush is gorse, a flowering one a hawthorn, in the woods a berry bush is bramble
// (its kind itself as it was: only its look).

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import type { Bush } from '../../../model/types';
import { aroundVillages, createBiomes, type BiomeMap } from '../../../model/scenery/biomes';
import { TILE_HEIGHT } from '../../../model/constants';
import { addWindSway } from '../common/wind';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { BUSH_GRID, BUSH_PALETTE, BUSH_VOXEL_SIZE, buildBushVoxels, type BushLook } from './bushVoxels';

const SINK = 0.01; // bottom slightly below the tile top, so no gap shows at the base
// Bushes rustle a little: less than grass, a touch quicker than trees.
const BUSH_WIND = { height: BUSH_GRID[1] * BUSH_VOXEL_SIZE, strength: 0.02, speed: 1.4, flutter: 0.003 };

// How a bush is drawn, by the country it grows in.
export function bushLook(bush: Bush, biomes: BiomeMap): BushLook {
  const country = biomes.at(bush.x, bush.z);
  if (country === 'heath' && bush.kind !== 'berry') return bush.kind === 'flowering' ? 'thorn' : 'gorse';
  if (country === 'forest' && bush.kind === 'berry') return 'bramble';
  return bush.kind;
}

export function buildBushGeometry(kind: BushLook, shape: number): THREE.BufferGeometry {
  const [sx, , sz] = BUSH_GRID;
  // Centered on the tile in X/Z, standing on the ground in Y.
  const origin = new THREE.Vector3((-sx * BUSH_VOXEL_SIZE) / 2, -SINK, (-sz * BUSH_VOXEL_SIZE) / 2);
  return greedyMesh(buildBushVoxels(kind, shape), BUSH_PALETTE, BUSH_VOXEL_SIZE, origin);
}

// Returns the per-frame wind animation.
export function buildBushes(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const windTime = addWindSway(material, { ...BUSH_WIND, broadleaf: true });
  const biomes = aroundVillages(createBiomes(model.seed), model.villages);
  const looks = new Map(model.bushes.map((bush) => [bush, bushLook(bush, biomes)]));
  addVoxelInstances(
    scene,
    model.bushes,
    (bush) => `${looks.get(bush)}:${bush.shape}`,
    (bush) => buildBushGeometry(looks.get(bush)!, bush.shape),
    (bush) => ({ x: bush.x, y: bush.groundTier * TILE_HEIGHT, z: bush.z, quarterTurns: bush.quarterTurns }),
    material,
  );
  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
  };
}
