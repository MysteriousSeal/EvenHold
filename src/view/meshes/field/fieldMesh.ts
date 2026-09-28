// Crop fields (see fieldVoxels.ts): wheat tiles swaying in the wind, a
// hay-and-tools corner tile, and fence segments along each field's border
// with a gap at the gate. Every model is meshed once and instanced per map
// chunk. Crops are walkable; the fences block (see GameModel).

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { fenceEdges } from '../../../model/worldgen/fields';
import { hashCell } from '../../../util/random';
import { addWindSway } from '../common/wind';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances, type VoxelPlacement } from '../voxel/voxelInstances';
import {
  FIELD_GRID,
  FIELD_PALETTE,
  FIELD_VOXEL_SIZE,
  WHEAT_VARIANTS,
  buildCornerTile,
  buildFenceSegment,
  buildWheatTile,
} from './fieldVoxels';

// Tile-centered, standing on the tile top.
const ORIGIN = new THREE.Vector3((-FIELD_GRID[0] * FIELD_VOXEL_SIZE) / 2, 0, (-FIELD_GRID[2] * FIELD_VOXEL_SIZE) / 2);
// Wheat sways a little less than meadow grass, slower.
const WHEAT_WIND = { height: FIELD_GRID[1] * FIELD_VOXEL_SIZE, strength: 0.035, speed: 1.3 };
// Quarter turns that bring the fence's local -Z edge to each NEIGHBORS_4
// side (+x, -x, +z, -z).
const FENCE_TURNS = [3, 1, 2, 0];

interface Piece {
  x: number;
  z: number;
  y: number;
  model: string;
  quarterTurns: number;
}

const mesh = (grid: VoxelGrid) => greedyMesh(grid, FIELD_PALETTE, FIELD_VOXEL_SIZE, ORIGIN);

export function buildFieldGeometry(model: string): THREE.BufferGeometry {
  if (model === 'corner') return mesh(buildCornerTile());
  if (model === 'fence') return mesh(buildFenceSegment());
  return mesh(buildWheatTile(Number(model.split(':')[1])));
}

// Returns the per-frame wind animation.
export function buildFields(scene: WorldSink, model: GameModel): (elapsedSeconds: number) => void {
  const crops: Piece[] = [];
  const fences: Piece[] = [];
  for (const field of model.fields) {
    const y = field.groundTier * TILE_HEIGHT;
    const turn = field.rowsAlongX ? 0 : 1;
    for (let x = field.x0; x < field.x0 + field.width; x++) {
      for (let z = field.z0; z < field.z0 + field.depth; z++) {
        const isCorner = x === field.corner[0] && z === field.corner[1];
        const wheat = `wheat:${hashCell(x, z, 33) % WHEAT_VARIANTS}`;
        crops.push({ x, z, y, model: isCorner ? 'corner' : wheat, quarterTurns: isCorner ? hashCell(x, z, 34) & 3 : turn });
      }
    }
    for (const { x, z, side } of fenceEdges(field)) fences.push({ x, z, y, model: 'fence', quarterTurns: FENCE_TURNS[side] });
  }

  const place = (p: Piece): VoxelPlacement => ({ x: p.x, y: p.y, z: p.z, quarterTurns: p.quarterTurns });
  const wheatMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const windTime = addWindSway(wheatMaterial, WHEAT_WIND);
  const plain = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const wheat = crops.filter((p) => p.model !== 'corner');
  addVoxelInstances(scene, wheat, (p) => p.model, (p) => buildFieldGeometry(p.model), place, wheatMaterial);
  addVoxelInstances(scene, [...crops.filter((p) => p.model === 'corner'), ...fences], (p) => p.model, (p) => buildFieldGeometry(p.model), place, plain);

  return (elapsedSeconds) => {
    windTime.value = elapsedSeconds;
  };
}
