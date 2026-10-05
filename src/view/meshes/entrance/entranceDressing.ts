// What marks the dungeons' ways in that stays put (entranceLife.ts moves the
// rest), streamed with the world's chunks: a crypt's braziers, either side of
// the head of its stairs (their fires lit from dusk to dawn: entranceLife.ts),
// their coals aglow.
// Voxels: entranceVoxels.ts.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { FACINGS } from '../../../model/map/grid';
import type { WorldSink } from '../../world/chunkLayer';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { BRAZIER_GLOW, BRAZIER_GRID, BRAZIER_PALETTE, brazierGrid } from './entranceVoxels';

const V = 0.04; // the world's voxels

// Where a crypt's braziers stand: either side of the head of its stairs, on their kerbs.
export function brazierSpots(model: GameModel): Array<{ x: number; y: number; z: number }> {
  return model.crypts.flatMap((crypt) => {
    const [ox, oz] = FACINGS[crypt.quarterTurns];
    const [ax, az] = [Math.abs(oz), Math.abs(ox)]; // across the way down
    const front = { x: crypt.middle.x + ox * 0.5, z: crypt.middle.z + oz * 0.5 }; // (the head of the stairs: the two steps' middle)
    const y = model.heightMap[crypt.stairs.x][crypt.stairs.z] * TILE_HEIGHT;
    return [-1, 1].map((side) => ({ x: front.x + ax * side * 0.86 + ox * 0.4, y, z: front.z + az * side * 0.86 + oz * 0.4 })); // (its front corners)
  });
}

export function buildEntranceDressing(scene: WorldSink, model: GameModel): void {
  const spots = brazierSpots(model).map((p) => ({ ...p, quarterTurns: 0 }));
  const origin = new THREE.Vector3((-BRAZIER_GRID[0] / 2) * V, 0, (-BRAZIER_GRID[2] / 2) * V);
  for (const glows of [false, true]) {
    addVoxelInstances(
      scene,
      spots,
      () => `brazier:${glows}`,
      () => greedyMesh(brazierGrid(), BRAZIER_PALETTE, V, origin, (c) => (c === BRAZIER_GLOW) === glows),
      (p) => p,
      glows ? new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }),
    );
  }
}
