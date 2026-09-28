// Voxel roads. Each trail tile's layout comes from which neighbors it
// connects to (a 4-bit mask), plus a small variant number from its position
// hash. Every distinct tile is greedy-meshed once and instanced per map
// chunk, so off-screen road is culled. Village squares are plazaMesh.ts.

import * as THREE from 'three';
import type { WorldSink } from '../../world/chunkLayer';
import type { GameModel } from '../../../model/GameModel';
import { TILE_HEIGHT } from '../../../model/constants';
import { roadConnections } from '../../../model/roads';
import { hashCell } from '../../../util/random';
import { greedyMesh, type VoxelGrid } from '../voxel/greedyMesh';
import { addVoxelInstances } from '../voxel/voxelInstances';
import { NEIGHBORS_4 } from '../../../model/grid';
import { ROAD_PALETTE, ROAD_VOXEL_SIZE, buildRoadTile, roadTileOffset } from './roadVoxels';

const ROAD_VARIANTS = 3;

interface PavedTile {
  x: number;
  z: number;
  tier: number;
  model: string; // which voxel tile template it uses
  build: () => VoxelGrid;
  drops: number; // road arms stepping down to a lower neighbor (their grid is padded)
}

// Where a tile's voxel grid starts, relative to the tile center on its top
// surface: at the tile's corner, pushed out and down for stair padding.
function tileOrigin(drops: number): THREE.Vector3 {
  const { side, below } = roadTileOffset(drops);
  return new THREE.Vector3(-0.5 - side * ROAD_VOXEL_SIZE, -below * ROAD_VOXEL_SIZE, -0.5 - side * ROAD_VOXEL_SIZE);
}

function pavedTiles(model: GameModel): PavedTile[] {
  const tiles: PavedTile[] = [];
  for (let x = 0; x < model.size.width; x++) {
    for (let z = 0; z < model.size.depth; z++) {
      const surface = model.surfaceMap[x][z];
      const tier = model.heightMap[x][z];
      if (surface === 'path') {
        const mask = roadConnections(model.surfaceMap, x, z);
        const variant = hashCell(x, z, 7) % ROAD_VARIANTS;
        // Terrain smoothing keeps neighbors within one tier, so a drop is always one step.
        let drops = 0;
        NEIGHBORS_4.forEach(([dx, dz], i) => {
          if (mask & (1 << i) && model.heightMap[x + dx][z + dz] < tier) drops |= 1 << i;
        });
        tiles.push({
          x,
          z,
          tier,
          model: `road:${mask}:${variant}:${drops}`,
          build: () => buildRoadTile(mask, variant, drops),
          drops,
        });
      }
    }
  }
  return tiles;
}

export function buildRoads(scene: WorldSink, model: GameModel): void {
  addVoxelInstances(
    scene,
    pavedTiles(model),
    (tile) => tile.model,
    (tile) => greedyMesh(tile.build(), ROAD_PALETTE, ROAD_VOXEL_SIZE, tileOrigin(tile.drops)),
    (tile) => ({ x: tile.x, y: tile.tier * TILE_HEIGHT, z: tile.z, quarterTurns: 0 }),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
  );
}
