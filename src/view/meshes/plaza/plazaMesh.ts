// Village squares: each square is one voxel model (see plazaVoxels.ts),
// greedy-meshed once and drawn as a single mesh, so it's culled with its
// village. Squares are all different (their stones are laid out per
// village), so there's nothing to instance.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { inBounds } from '../../../model/grid';
import { hashCell } from '../../../util/random';
import { greedyMesh } from '../voxel/greedyMesh';
import { PLAZA_PALETTE, PLAZA_RADIUS, PLAZA_VOXEL_SIZE, buildPlaza, type TileKind } from './plazaVoxels';

export function buildPlazas(scene: THREE.Scene, model: GameModel): void {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  for (const village of model.villages) {
    const kindAt = (dx: number, dz: number): TileKind => {
      const x = village.x + dx;
      const z = village.z + dz;
      if (!inBounds(model.size, x, z)) return 'natural';
      const surface = model.surfaceMap[x][z];
      // Only this village's own square tiles (same tier, within its radius) are paved.
      if (surface === 'plaza' && Math.max(Math.abs(dx), Math.abs(dz)) <= PLAZA_RADIUS) return 'plaza';
      return surface === 'natural' ? 'natural' : 'path';
    };
    const origin = new THREE.Vector3(
      village.x - PLAZA_RADIUS - 0.5,
      village.groundTier * TILE_HEIGHT,
      village.z - PLAZA_RADIUS - 0.5,
    );
    const grid = buildPlaza(kindAt, hashCell(village.x, village.z, 21));
    scene.add(new THREE.Mesh(greedyMesh(grid, PLAZA_PALETTE, PLAZA_VOXEL_SIZE, origin), material));
  }
}
