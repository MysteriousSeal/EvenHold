// Village squares (see plazaVoxels.ts). Every square is a complete 7x7 on
// flat ground, so its look depends only on which tiles just outside it are
// road (the curb opens there) and on its stone layout. Each distinct
// (roads, layout variant) square is meshed once and instanced per map
// chunk; most villages share the same few, which keeps startup fast.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { inBounds } from '../../../model/grid';
import type { Village } from '../../../model/types';
import { hashCell } from '../../../util/random';
import { greedyMesh } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { PLAZA_PALETTE, PLAZA_RADIUS, PLAZA_VOXEL_SIZE, buildPlaza, type TileKind } from './plazaVoxels';

const LAYOUT_VARIANTS = 3;
// The grid's corner, relative to the well tile's center.
const ORIGIN = new THREE.Vector3(-PLAZA_RADIUS - 0.5, 0, -PLAZA_RADIUS - 0.5);

interface Square {
  village: Village;
  kindAt: (dx: number, dz: number) => TileKind;
  key: string;
  variant: number;
}

export function buildPlazas(scene: THREE.Scene, model: GameModel): void {
  const squares = model.villages.map((village): Square => {
    const kindAt = (dx: number, dz: number): TileKind => {
      if (Math.max(Math.abs(dx), Math.abs(dz)) <= PLAZA_RADIUS) return 'plaza';
      const x = village.x + dx;
      const z = village.z + dz;
      return inBounds(model.size, x, z) && model.surfaceMap[x][z] === 'path' ? 'path' : 'natural';
    };
    // Road tiles in the ring just outside the square decide where the curb opens.
    const ring: string[] = [];
    const r = PLAZA_RADIUS + 1;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) === r && kindAt(dx, dz) === 'path') ring.push(`${dx},${dz}`);
      }
    }
    const variant = hashCell(village.x, village.z, 21) % LAYOUT_VARIANTS;
    return { village, kindAt, key: `${ring.join(';')}|${variant}`, variant };
  });

  addVoxelInstances(
    scene,
    squares,
    (s) => s.key,
    (s) => greedyMesh(buildPlaza(s.kindAt, 0x5a1a + s.variant), PLAZA_PALETTE, PLAZA_VOXEL_SIZE, ORIGIN),
    (s) => ({ x: s.village.x, y: s.village.groundTier * TILE_HEIGHT, z: s.village.z, quarterTurns: 0 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
  );
}
