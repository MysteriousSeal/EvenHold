// The caves' mouths out in the hills (model/caves/caves.ts; voxels: caveMouthVoxels.ts): each knoll centred on its
// three tiles by three (the mouth's row and the two behind it), its ground level at the mouth's, turned to open
// toward the spot before it; each look meshed once, streamed with the chunks.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { FACINGS } from '../../../model/map/grid';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { MOUTH_GRID, MOUTH_PALETTE, MOUTH_VOXEL, SINK, buildCaveMouth } from './caveMouthVoxels';

const ORIGIN = new THREE.Vector3((-MOUTH_GRID[0] * MOUTH_VOXEL) / 2, 0, (-MOUTH_GRID[2] * MOUTH_VOXEL) / 2);
const LOOKS = 3;

export function buildCaveMouths(scene: WorldSink, model: GameModel): void {
  const look = (c: GameModel['caves'][number]) => (c.mouth.x * 7 + c.mouth.z * 3) % LOOKS;
  const place = (c: GameModel['caves'][number]) => {
    const [ox, oz] = FACINGS[c.quarterTurns];
    return { x: c.mouth.x - ox, y: model.heightMap[c.mouth.x][c.mouth.z] * TILE_HEIGHT - SINK * MOUTH_VOXEL, z: c.mouth.z - oz, quarterTurns: c.quarterTurns }; // (the knoll's middle: a tile back from its mouth)
  };
  addVoxelInstances(
    scene,
    model.caves,
    (c) => `caveMouth:${look(c)}`,
    (c) => greedyMesh(buildCaveMouth(look(c)), MOUTH_PALETTE, MOUTH_VOXEL, ORIGIN),
    place,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
}
